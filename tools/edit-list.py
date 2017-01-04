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

""" Modify lists and messages

This utility can be used to:
- rename a list
- make a list private
- make a list public
- update the description for a list
- delete mails from a list (does not delete mbox_source entries)
- obfuscate some fields (from, subject, body) in an mbox entry (does not obfuscate the raw source document)

"""

import sys
import time
import configparser
import argparse
import json

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
        'url_prefix': uri
    }],
    max_retries=5,
    retry_on_timeout=True
    )

parser = argparse.ArgumentParser(description='Command line options.')
# Cannot have both source and mid as input
source_group = parser.add_mutually_exclusive_group()
source_group.add_argument('--source', dest='source', type=str, nargs=1,
                   help='Source list to edit')
source_group.add_argument('--mid', dest='mid', type=str, nargs=1,
                   help='Source Message-ID to edit')
parser.add_argument('--rename', dest='target', type=str, nargs=1,
                   help='(optional) new list ID')
parser.add_argument('--desc', dest='desc', type=str, nargs=1,
                   help='(optional) new list description')
parser.add_argument('--obfuscate', dest='obfuscate', type=str, nargs=1,
                   help='Things to obfuscate in body, if any')
# private and public are mutually exclusive
privacy_group = parser.add_mutually_exclusive_group()
privacy_group.add_argument('--private', dest='private', action='store_true',
                   help='Make all emails in list private')
privacy_group.add_argument('--public', dest='public', action='store_true',
                   help='Make all emails in list public')
parser.add_argument('--delete', dest='delete', action='store_true',
                   help='Delete emails from this list')
parser.add_argument('--wildcard', dest='glob', action='store_true',
                   help='Allow wildcards in --source')
parser.add_argument('--debug', dest='debug', action='store_true',
                   help='Debug output - very noisy!')
parser.add_argument('--notag', dest='notag', action='store_true',
                   help='List IDs do not have <> in them')
parser.add_argument('--test', dest='test', action='store_true',
                   help='Only test for occurrences, do not run the chosen action (dry run)')

args = parser.parse_args()

sourceLID = args.source and args.source[0]
targetLID = args.target and args.target[0]
desc = args.desc and args.desc[0]
makePrivate = args.private
makePublic = args.public
deleteEmails = args.delete
wildcard = args.glob
debug = args.debug
notag = args.notag
mid = args.mid and args.mid[0]
obfuscate = args.obfuscate and args.obfuscate[0]
dryrun = args.test

privacyChange = makePrivate or makePublic
otherChange = targetLID or desc or obfuscate
anyChange = privacyChange or otherChange
    
if not sourceLID and not mid:
    print("No source list ID specified!")
    parser.print_help()
    sys.exit(-1)
if not (anyChange or deleteEmails):
    print("Nothing to do! No target list ID or action specified")
    parser.print_help()
    sys.exit(-1)
if desc and not sourceLID:
    print("No source list ID specified for description!")
    parser.print_help()
    sys.exit(-1)
if anyChange and deleteEmails:
    print("Cannot both change and delete emails in the same run")
    parser.print_help()
    sys.exit(-1)

# TODO does it make sense to allow --rename with --mid?
# i.e. rename the list for a single mid?

if sourceLID:
    sourceLID = ("%s" if notag else "<%s>")  % sourceLID.replace("@", ".").strip("<>")
if targetLID:
    targetLID = "<%s>" % targetLID.replace("@", ".").strip("<>")

print("Beginning list edit:")
print("  - List ID: %s" % (sourceLID if sourceLID else mid))
if targetLID:
    print("  - Target ID: %s" % targetLID)
if makePublic:
    print("  - Action: Mark all emails public")
if makePrivate:
    print("  - Action: Mark all emails private")
if deleteEmails:
    print("  - Action: Delete emails (sources will be kept!)")
if obfuscate:
    print("  - Action: Obfuscate parts of email containing: %s" % obfuscate)
count = 0

if desc:
    if dryrun:
        print("DRY RUN - NO CHANGES WILL BE MADE")
    else:
        LID = sourceLID
        if targetLID:
            LID = targetLID
        es.index(
            index=dbname,
            doc_type="mailinglists",
            id=LID,
            body = {
                'list': LID,
                'name': LID,
                'description': desc
            }
        )

if targetLID or makePrivate or makePublic or deleteEmails or mid or obfuscate:
    if dryrun:
        print("DRY RUN - NO CHANGES WILL BE MADE")
    print("Updating docs...")
    then = time.time()
    terms = {
        'wildcard' if wildcard else 'term': {
            'list_raw': sourceLID
        }
    }
    if mid:
        terms = {
            'term': {
                'mid': mid
            }
        }
    page = es.search(
        index=dbname,
        doc_type="mbox",
        scroll = '30m',
        search_type = 'scan',
        size = 100,
        body = {
            '_source': ['body', 'subject', 'from'] if  obfuscate else False,
            'query': {
                'bool': {
                    'must': [
                        terms
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
            if obfuscate:
                body['body'] = hit['_source']['body'].replace(obfuscate, "...")
                body['subject'] = hit['_source']['subject'].replace(obfuscate, "...")
                body['from'] = hit['_source']['from'].replace(obfuscate, "...")
            if targetLID:
                body['list_raw'] = targetLID
                body['list'] = targetLID
            if makePrivate:
                body['private'] = True
            if makePublic:
                body['private'] = False
            if not dryrun:
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
                if not dryrun:
                    helpers.bulk(es, js_arr)
                    js_arr = []

    if len(js_arr) > 0:
        if not dryrun:
            helpers.bulk(es, js_arr)

    print("All done, processed %u docs in %u seconds" % (count, time.time() - then))
