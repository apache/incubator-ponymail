#!/usr/bin/env python3.4
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
import configparser
import argparse

try:
    from elasticsearch import Elasticsearch, helpers
except:
    print("Sorry, you need to install the elasticsearch and formatflowed modules from pip first.")
    sys.exit(-1)
    

# Fetch config
config = configparser.RawConfigParser()
config.read('ponymail.cfg')

sourceLID = None
targetLID = None
wildcard = None
debug = False
notag = False
newdb = None

ssl = False
dbname = config.get("elasticsearch", "dbname")
if config.has_option("elasticsearch", "ssl") and config.get("elasticsearch", "ssl").lower() == 'true':
    ssl = True
uri = ""
if config.has_option("elasticsearch", "uri") and config.get("elasticsearch", "uri") != "":
    uri = config.get("elasticsearch", "uri")
es = Elasticsearch([
    {
        'host': config.get("elasticsearch", "hostname"),
        'port': int(config.get("elasticsearch", "port")),
        'use_ssl': ssl,
        'url_prefix': uri
    }],
    max_retries=5,
    retry_on_timeout=True
    )

rootURL = ""

parser = argparse.ArgumentParser(description='Command line options.')
parser.add_argument('--source', dest='source', type=str, nargs=1,
                   help='Source list to edit')
parser.add_argument('--rename', dest='target', type=str, nargs=1,
                   help='(optional) new list ID')
parser.add_argument('--newdb', dest='newdb', type=str, nargs=1,
                   help='(optional) new ES database name')
parser.add_argument('--wildcard', dest='glob', action='store_true', 
                   help='Allow wildcards in --source')
parser.add_argument('--notag', dest='notag', action='store_true', 
                   help='List IDs do not have <> in them')

args = parser.parse_args()

if args.source:
    sourceLID = args.source[0]
if args.target:
    targetLID = args.target[0]
if args.newdb:
    newdb = args.newdb[0]
if args.glob:
    wildcard = args.glob
if args.notag:
    notag = args.notag

    
if not sourceLID:
    print("No source list ID specified!")
    parser.print_help()
    sys.exit(-1)
if not (targetLID or newdb):
    print("Nothing to do! No target list ID or DB name specified")
    parser.print_help()
    sys.exit(-1)

sourceLID = ("%s" if notag else "<%s>")  % sourceLID.replace("@", ".").strip("<>")
if newdb and not targetLID:
    targetLID = sourceLID

if targetLID:
    targetLID = "<%s>" % targetLID.replace("@", ".").strip("<>")
    
print("Beginning list copy:")
print("  - List ID: %s" % sourceLID)
if targetLID:
    print("  - Target ID: %s" % targetLID)
if newdb:
    print("  - Target DB: %s" % newdb)

count = 0

    
if targetLID or newdb:
    print("Updating docs...")
    then = time.time()
    page = es.search(
        index=dbname,
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
            body = es.get(index = dbname, doc_type = 'mbox', id = doc)
            source = None
            try:
                source = es.get(index = dbname, doc_type = 'mbox_source', id = doc)
            except:
                print("Source for %s not found, hmm..." % doc)
            if targetLID:
                if not newdb:
                    body['list_raw'] = targetLID
                    body['list'] = targetLID
            js_arr.append({
                '_op_type': 'index',
                '_index': newdb if newdb else dbname,
                '_type': 'mbox',
                '_id': doc,
                '_source': body['_source']
            })
            if source:
                js_arr.append({
                    '_op_type': 'index',
                    '_index': newdb if newdb else dbname,
                    '_type': 'mbox_source',
                    '_id': doc,
                    '_source': source['_source']
                })
            
            count += 1
            if (count % 50 == 0):
                print("Processed %u emails..." % count)
                helpers.bulk(es, js_arr)
                js_arr = []
    
    if len(js_arr) > 0:
        helpers.bulk(es, js_arr)
                
    print("All done, processed %u docs in %u seconds" % (count, time.time() - then))
