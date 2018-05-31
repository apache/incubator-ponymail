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

import time
import argparse
import json

from elastic import Elastic

dbname=None

parser = argparse.ArgumentParser(description='Command line options.')
parser.add_argument('--dbname', dest='dbname', type=str,
                   help='Override index name')
parser.add_argument('--pretty', dest='pretty', action='store_true',
                   help='Convert List IDs to email addresses')
parser.add_argument('--debug', dest='debug', action='store_true',
                   help='Output the result JSON instead, very noisy!')
parser.add_argument('--counts', dest='counts', action='store_true',
                   help='Show the count of messages for each list')

args = parser.parse_args()

dbname = args.dbname

then = time.time()

# get config and set up default database
# If dbname is None, the config setting will be used
es = Elastic(dbname=dbname)

page = es.search(
    doc_type="mbox",
    size = 0,
    body = {
        'aggs': {
            'lists': {
                'terms': {
                    'field': "list_raw",
                    'size': 500000
                },
                'aggs': {
                    'privacy' : {
                        'filter' : {# are there any private messages?
                            'term': {
                                 'private': True
                            }
                        }
                    }
                }
            }
        },
        'query': {
            'bool': {
                'must': [
                    {
                        'range': {
                            'date': {
                                'lt': "now+2d"
                            }
                        }
                    }
                ]
            }
        }
    }
    )

plist = {}
total_private = 0
if args.debug:
    print(json.dumps(page))
else:
    for domain in page['aggregations']['lists']['buckets']:
        listid = domain['key']
        msgcount = domain['doc_count']
        prvcount = domain['privacy']['doc_count']
        total_private += prvcount
        if args.pretty:
            if listid.find(".") != -1:
                l, d = listid.strip("<>").split(".", 1)
                plist[d] = plist[d] if d in plist else {}
                plist[d][l]=[msgcount, prvcount]
        else:
            if args.counts:
                print(listid, msgcount, prvcount)
            else:
                print(listid)

    for dom in sorted(plist):
        for ln in sorted(plist[dom]):
            if args.counts:
                print("%s@%s %d %d" % (ln, dom, plist[dom][ln][0], plist[dom][ln][1]))
            else:
                print("%s@%s" % (ln, dom))
    if args.counts:
        print("Total messages %d of which private %d" % (page['hits']['total'], total_private))
