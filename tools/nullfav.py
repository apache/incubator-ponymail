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

"""

Scan accounts to drop null entries from favorites

"""

import argparse
from elastic import Elastic

parser = argparse.ArgumentParser(description='Command line options.')

parser.add_argument('--apply', dest='apply', action='store_true',
                   help='Update the account favorites. Default is list ids only')

args = parser.parse_args()

FAVES='favorites'
TARGET=None

elastic = Elastic()
scroll = '5m'
page = elastic.scan(doc_type='account',
    scroll = scroll,
    body = {
        "_source" : [FAVES],
    }
)
sid = page['_scroll_id']
scroll_size = page['hits']['total']
print("Found %d accounts" % scroll_size)

updated=0
failed=0
while (scroll_size > 0):
    page = elastic.scroll(scroll_id = sid, scroll = scroll)
    sid = page['_scroll_id']
    scroll_size = len(page['hits']['hits'])
    for hit in page['hits']['hits']:
        mid = hit['_id']
        source = hit['_source']
        if FAVES in source:
            favorites = source[FAVES]
            if TARGET in favorites:
                newfav = [x for x in favorites if x != TARGET]
                if not args.apply:
                    print("Would update account mid %s" % mid)
                    continue
                print("Updating account mid %s" % mid)
                try:
                    elastic.update(doc_type='account',
                        id = mid,
                        body = {
                          'doc': {
                            FAVES: newfav
                          }
                        }
                    )
                    updated +=1
                except Exception as e:
                    print("Error updating mid %s: %s" % (mid,e))
                    failed += 1

if args.apply:
    print("Updated %d account(s) with %d failures" % (updated, failed))
