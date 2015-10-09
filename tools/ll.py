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
import configparser
import argparse

try:
    from elasticsearch import Elasticsearch, helpers
except:
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
    size = 100,
    body = {
        'aggs': {
            'lists': {
                'terms': {
                    'field': "list_raw",
                    'size': 500000
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

args = parser.parse_args()
pretty = args.pretty
plist = {}

for domain in page['aggregations']['lists']['buckets']:
    if pretty:
        l, d = domain['key'].strip("<>").split(".", 1)
        plist[d] = plist[d] if d in plist else []
        plist[d].append(l)
    else:
        print(domain['key'])

for dom in sorted(plist):
    for ln in sorted(plist[dom]):
        print("%s@%s" % (ln, dom))
        