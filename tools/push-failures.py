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

""" Utility for retrying docs that we failed to index earlier.
"""

import sys
import time
import configparser
import argparse
import json
import os
import certifi

try:
    from elasticsearch import Elasticsearch, helpers
except:
    print("Sorry, you need to install the elasticsearch and formatflowed modules from pip first.")
    sys.exit(-1)


# Fetch config
config = configparser.RawConfigParser()
config.read('ponymail.cfg')

dbname = config.get("elasticsearch", "dbname")
ssl = config.get("elasticsearch", "ssl", fallback="false").lower() == 'true'
uri = config.get("elasticsearch", "uri", fallback="")

es = Elasticsearch([
    {
        'host': config.get("elasticsearch", "hostname"),
        'port': int(config.get("elasticsearch", "port")),
        'use_ssl': ssl,
        'url_prefix': uri,
        'ca_certs': certifi.where()
    }],
    max_retries=5,
    retry_on_timeout=True
    )

parser = argparse.ArgumentParser(description='Command line options.')
# Cannot have both source and mid as input
parser.add_argument('--source', dest='dumpdir',
                   help='Path to the directory containing the JSON documents that failed to index')

args = parser.parse_args()

dumpDir = args.dumpdir if args.dumpdir else '.'

files = [f for f in os.listdir(dumpDir) if os.path.isfile(os.path.join(dumpDir, f)) and f.endswith('.json')]

for f in files:
    fpath = os.path.join(dumpDir, f)
    print("Processing %s" % fpath)
    with open(fpath, "r") as f:
        ojson = json.load(f)
        if 'mbox' in ojson and 'mbox_source' in ojson:
            es.index(
                index=dbname,
                doc_type="mbox",
                id=ojson['id'],
                body = ojson['mbox']
            )
            
            es.index(
                index=dbname,
                doc_type="mbox_source",
                id=ojson['id'],
                body = ojson['mbox_source']
            )
            
            if 'attachments' in ojson and ojson['attachments']:
                for k, v in ojson['attachments'].items():
                    es.index(
                        index=dbname,
                        doc_type="attachment",
                        id=k,
                        body = {
                            'source': v
                        }
                    )
        f.close()
    os.unlink(fpath)
print ("All done! Pushed %u documents to ES." % len(files))
