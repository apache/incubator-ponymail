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
    common elasticsearch database setup
    also adds defaults for most methods
"""

import configparser
import sys
import logging

try:
    from elasticsearch import Elasticsearch, helpers
except Exception as e:
    sys.exit("Sorry, you need to install the elasticsearch module from pip first. (%s)" % str(e))

class Elastic:
    def __init__(self, dbname=None, **kwargs):
        # Fetch config
        config = configparser.RawConfigParser()
        config.read('ponymail.cfg')
        self.dbname = dbname or config.get("elasticsearch", "dbname")
        ssl = config.get("elasticsearch", "ssl", fallback="false").lower() == 'true'
        uri = config.get("elasticsearch", "uri", fallback="")
        auth = None
        if config.has_option('elasticsearch', 'user'):
            auth = (config.get('elasticsearch','user'), config.get('elasticsearch','password'))

    
        # elasticsearch logs lots of warnings on retries/connection failure
        logging.getLogger("elasticsearch").setLevel(logging.ERROR)

#         # add debug
#         trace = logging.getLogger("elasticsearch.trace")
#         trace.setLevel(logging.DEBUG)
#         # create console handler
#         consoleHandler = logging.StreamHandler()
#         trace.addHandler(consoleHandler)

        self.es = Elasticsearch([
            {
                'host': config.get("elasticsearch", "hostname"),
                'port': int(config.get("elasticsearch", "port")),
                'use_ssl': ssl,
                'url_prefix': uri,
                'auth': auth
            }],
            max_retries=5,
            retry_on_timeout=True
            )
    
    def search(self, doc_type='mbox', **kwargs):
        return self.es.search(
            index=self.dbname,
            doc_type=doc_type,
            **kwargs
        )

    def index(self, **kwargs):
        return self.es.index(
            index=self.dbname,
            **kwargs
        )
    
    def scan(self, doc_type='mbox', scroll='3m', size = 100, **kwargs):
        return self.es.search(
            index=self.dbname,
            doc_type=doc_type,
            search_type = 'scan',
            size = size,
            scroll = scroll,
            **kwargs
        )
    
    def scroll(self, **kwargs):
        return self.es.scroll(**kwargs)
    
    def bulk(self, actions, **kwargs):
        return helpers.bulk(self.es, actions, **kwargs)
