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

""" Copy lists

This utility can be used to:
- copy a list within a database
- copy a list to a new database

"""

import sys
import time
import argparse

from elastic import Elastic

sourceLID = None
targetLID = None
wildcard = None
debug = False
notag = False
newdb = None

# get config and set up default databas
es = Elastic()
# default database name
dbname = es.getdbname()

rootURL = ""

parser = argparse.ArgumentParser(description='Command line options.')
parser.add_argument('--source', dest='source', type=str, required=True,
                   metavar='<list id>', help='Source list to edit')
parser.add_argument('--target', dest='target', type=str,
                   metavar='<list id>', help='(optional) new list ID')
parser.add_argument('--newdb', dest='newdb', type=str,
                   metavar='<index name>', help='(optional) new ES database name')
parser.add_argument('--wildcard', dest='glob', action='store_true',
                   help='Allow wildcards in --source')
parser.add_argument('--notag', dest='notag', action='store_true',
                   help='List IDs do not have <> in them')

args = parser.parse_args()

sourceLID = args.source
targetLID = args.target
newdb = args.newdb
wildcard = args.glob
notag = args.notag

if not (targetLID or newdb):
    print("Nothing to do! No target list ID or DB name specified")
    parser.print_help()
    sys.exit(-1)

sourceLID = ("%s" if notag else "<%s>")  % sourceLID.replace("@", ".").strip("<>")
if newdb and not targetLID:
    targetLID = sourceLID

if targetLID:
    targetLID = "<%s>" % targetLID.replace("@", ".").strip("<>")

if targetLID == sourceLID and not newdb:
    print("Nothing to do! Target same as source")
    parser.print_help()
    sys.exit(-1)

print("Beginning list copy:")
print("  - Source ID: %s" % sourceLID)
if targetLID:
    print("  - Target ID: %s" % targetLID)
if newdb:
    print("  - Target DB: %s" % newdb)
    if not es.indices.exists(newdb):
        print("Target database does not exist!")
        sys.exit(-1)

count = 0


print("Updating docs...")
then = time.time()
page = es.search(
    doc_type="mbox",
    scroll = '30m',
    search_type = 'scan',
    size = 100,
    body = {
        'query': {
            'bool': {
                'must': [
                    {
                        'wildcard' if wildcard else 'term': {
                            'list_raw': sourceLID
                        }
                    }
                ]
            }
        }
    }
    )
sid = page['_scroll_id']
scroll_size = page['hits']['total']
js_arr = []
while (scroll_size > 0):
    page = es.scroll(scroll_id = sid, scroll = '30m')
    sid = page['_scroll_id']
    scroll_size = len(page['hits']['hits'])
    for hit in page['hits']['hits']:
        doc = hit['_id']
        body = es.get(doc_type = 'mbox', id = doc)
        if targetLID != sourceLID:
            doc = hit['_id'].replace(sourceLID,targetLID)
            body['_source']['mid'] = doc
            body['_source']['list_raw'] = targetLID
            body['_source']['list'] = targetLID
        js_arr.append({
            '_op_type': 'index',
            '_index': newdb if newdb else dbname,
            '_type': 'mbox',
            '_id': doc,
            '_source': body['_source']
        })
        source = es.get(doc_type = 'mbox_source', id = doc, ignore=404)
        if source['found']:
            js_arr.append({
                '_op_type': 'index',
                '_index': newdb if newdb else dbname,
                '_type': 'mbox_source',
                '_id': doc,
                '_source': source['_source']
            })
        else:
            print("Source for %s not found, hmm..." % doc)

        count += 1
        if (count % 50 == 0):
            print("Processed %u emails..." % count)
            es.bulk(js_arr)
            js_arr = []

if len(js_arr) > 0:
    es.bulk(js_arr)

print("All done, processed %u docs in %u seconds" % (count, time.time() - then))
