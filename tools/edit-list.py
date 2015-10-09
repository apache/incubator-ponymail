#!/usr/bin/env python3.4
# -*- coding: utf-8 -*-
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
 #the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import sys
import random, time
import os
from threading import Thread, Lock
import configparser
import argparse
from os import listdir
from os.path import isfile, join, isdir
import json

try:
    from elasticsearch import Elasticsearch, helpers
    from formatflowed import convertToWrapped
except:
    print("Sorry, you need to install the elasticsearch and formatflowed modules from pip first.")
    sys.exit(-1)
    

# Fetch config
config = configparser.RawConfigParser()
config.read('ponymail.cfg')

makePublic = None
makePrivate = None
sourceLID = None
targetLID = None
deleteEmails = None
wildcard = None
debug = False
notag = False

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
parser.add_argument('--private', dest='private', action='store_true', 
                   help='Make all emails in list private')
parser.add_argument('--public', dest='public', action='store_true', 
                   help='Make all emails in list public')
parser.add_argument('--delete', dest='delete', action='store_true', 
                   help='Delete emails from this list')
parser.add_argument('--wildcard', dest='glob', action='store_true', 
                   help='Allow wildcards in --source')
parser.add_argument('--debug', dest='debug', action='store_true', 
                   help='Debug output - very noisy!')
parser.add_argument('--notag', dest='notag', action='store_true', 
                   help='List IDs do not have <> in them')

args = parser.parse_args()

if args.source:
    sourceLID = args.source[0]
if args.target:
    targetLID = args.target[0]
if args.private:
    makePrivate = args.private
if args.public:
    makePublic = args.public
if args.delete:
    deleteEmails = args.delete
if args.glob:
    wildcard = args.glob
if args.debug:
    debug = args.debug
if args.notag:
    notag = args.notag
    
if not sourceLID:
    print("No source list ID specified!")
    parser.print_help()
    sys.exit(-1)
if not (targetLID or makePrivate or makePublic or deleteEmails):
    print("Nothing to do! No target list ID or action specified")
    parser.print_help()
    sys.exit(-1)
if makePublic and makePrivate:
    print("You can either make a list public or private, not both!")
    parser.print_help()
    sys.exit(-1)

sourceLID = ("%s" if notag else "<%s>")  % sourceLID.replace("@", ".").strip("<>")
if targetLID:
    targetLID = "<%s>" % targetLID.replace("@", ".").strip("<>")
    
print("Beginning list edit:")
print("  - List ID: %s" % sourceLID)
if targetLID:
    print("  - Target ID: %s" % targetLID)
if makePublic:
    print("  - Action: Mark all emails public")
if makePrivate:
    print("  - Action: Mark all emails private")
if deleteEmails:
    print("  - Action: Delete emails (sources will be kept!)")

count = 0


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
if debug:
        print(json.dumps(page))
js_arr = []
while (scroll_size > 0):
    page = es.scroll(scroll_id = sid, scroll = '30m')
    if debug:
        print(json.dumps(page))
    sid = page['_scroll_id']
    scroll_size = len(page['hits']['hits'])
    for hit in page['hits']['hits']:
        doc = hit['_id']
        body = {}
        if targetLID:
            body['list_raw'] = targetLID
            body['list'] = targetLID
        if makePrivate:
            body['private'] = True
        if makePublic:
            body['private'] = False
        js_arr.append({
            '_op_type': 'delete' if deleteEmails else 'update',
            '_index': dbname,
            '_type': 'mbox',
            '_id': doc,
            'doc': body
        })
        
        count += 1
        if (count % 500 == 0):
            print("Processed %u emails..." % count)
            helpers.bulk(es, js_arr)
            js_arr = []

if len(js_arr) > 0:
    helpers.bulk(es, js_arr)
            
print("All done, processed %u docs in %u seconds" % (count, time.time() - then))
