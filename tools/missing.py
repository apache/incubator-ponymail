#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

""" Scan messages to find and optionally fix missing fields

"""

import argparse
import time
from elastic import Elastic

parser = argparse.ArgumentParser(description='Command line options.')
# Cannot have both source and mid as input
source_group = parser.add_mutually_exclusive_group(required=True)
source_group.add_argument('--source', dest='source', type=str, metavar='list-name',
                   help='Source list to edit')
source_group.add_argument('--mid', dest='mid', type=str, metavar='message-id',
                   help='Source Message-ID to edit')

action_group = parser.add_mutually_exclusive_group(required=True)
# N.B. Use nargs=1 below, because the same field is used for get and set
action_group.add_argument('--listmissing', dest='missing', type=str, nargs=1, metavar='fieldname',
                   help='list missing fields')
action_group.add_argument('--setmissing', dest='missing', type=str, nargs=2, metavar=('fieldname', 'value'),
                   help='set missing fields')

# Generic arguments
parser.add_argument('--notag', dest='notag', action='store_true',
                   help='List IDs do not have <> in them')
parser.add_argument('--wildcard', dest='wildcard', action='store_true',
                   help='Allow wildcards in --source')
parser.add_argument('--debug', dest='debug', action='store_true',
                   help='Debug output - very noisy!')
parser.add_argument('--test', dest='test', action='store_true',
                   help='Only test for occurrences, do not run the chosen action (dry run)')

args = parser.parse_args()

if args.wildcard and args.mid:
    parser.error("Cannot use --mid and --wildcard together")

def getField(src,name):
    try:
        return src[name]
    except KeyError:
        return '(Uknown)'

def update(elastic, js_arr):
    if args.debug:
        print(js_arr)
    if not args.test:
        elastic.bulk(js_arr)

setField = len(args.missing) > 1
field = args.missing[0]
value = None
if setField:
    value = args.missing[1]
    print("Set missing/null field %s to '%s'" %(field, value))
else:
    print("List missing/null field %s" % field)
count = 0
scroll = '30m'
then = time.time()
elastic = Elastic()
if args.source:
    sourceLID = ("%s" if args.notag else "<%s>")  % args.source.replace("@", ".").strip("<>")
    page = elastic.scan(# defaults to mbox
            scroll = scroll,
            body = {
                "_source" : ['subject','message-id'],
                "query" : {
                    "bool" : {
                        "must" : {
                            'wildcard' if args.wildcard else 'term': {
                                'list_raw': sourceLID
                                }
                            },
                        # missing is not supported in ES 5.x
                        "must_not": {
                            "exists" : {
                                "field" : field
                            }
                        }
                    }
                }
            }
        )
    print(page)
    sid = page['_scroll_id']
    scroll_size = page['hits']['total']
    print("Found %d matches" % scroll_size)
    if args.debug:
        print(page)
    js_arr = []
    while (scroll_size > 0):
        page = elastic.scroll(scroll_id = sid, scroll = scroll)
        if args.debug:
            print(page)
        sid = page['_scroll_id']
        scroll_size = len(page['hits']['hits'])
        for hit in page['hits']['hits']:
            doc = hit['_id']
            body = {}
            if setField:
                body[field] = value
            js_arr.append({
                '_op_type': 'update',
                '_index': elastic.dbname,
                '_type': 'mbox',
                '_id': doc,
                'doc': body
            })
            count += 1
            source = hit['_source']
            print("Id: %s Msg-id: %s Subject: %s" %(doc, getField(source, 'message-id'), getField(source,'subject')))
            if (count % 500 == 0):
                print("Processed %u emails..." % count)
                if setField:
                    update(elastic, js_arr)
                js_arr = []

    print("Processed %u emails." % count)
    if len(js_arr) > 0:
        if setField:
            update(elastic, js_arr)

if args.mid:
    parser.error("--mid: not yet implemented")

print("All done, processed %u docs in %u seconds" % (count, time.time() - then))
