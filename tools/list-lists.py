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

import sys
import time
import configparser
import argparse
import json

try:
    from elasticsearch import Elasticsearch
except ImportError:
    print("Sorry, you need to install the elasticsearch module from pip first.")
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

then = time.time()
page = es.search(
    index=dbname,
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

parser = argparse.ArgumentParser(description='Command line options.')
parser.add_argument('--pretty', dest='pretty', action='store_true', 
                   help='Convert List IDs to email addresses')
parser.add_argument('--debug', dest='debug', action='store_true', 
                   help='Output the result JSON instead, very noisy!')
parser.add_argument('--counts', dest='counts', action='store_true', 
                   help='Show the count of messages for each list')

args = parser.parse_args()
pretty = args.pretty
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
        if pretty:
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
