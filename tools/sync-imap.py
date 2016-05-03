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

""" Syncronize ponymail with an imap server.

Fetches message-ids from both ponymail and an imap server, and adds or
deletes whatever is necessary from ponymail to make it match.

See usage for instructions.

"""

import argparse
import configparser
import elasticsearch
import imaplib
import os
import pwd
import subprocess
import sys
import re

# change working directory to location of this script

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# global defaults

es_list = None
imap_host = 'localhost'
imap_port = 993
imap_user = pwd.getpwuid(os.getuid()).pw_name
imap_password = None
imap_folder = 'INBOX'
html2text = False
verbose = False

# fetch config overrides

config = configparser.RawConfigParser()
config.read('ponymail.cfg')
iname = config.get("elasticsearch", "dbname")
if config.has_option('imap', 'host'):
    imap_host = config.get('imap', 'host')
if config.has_option('imap', 'port'):
    imap_port = config.getint('imap', 'port')
if config.has_option('imap', 'user'):
    imap_user = config.getint('imap', 'user')
if config.has_option('imap', 'password'):
    imap_password = config.getint('imap', 'password')

# fetch command line argument overrides

parser = argparse.ArgumentParser(description='Command line options.')
parser.add_argument('--list', dest='list', type=str, nargs=1,
                   help='ElasticSearch list')
parser.add_argument('--host', dest='host', type=str, nargs=1,
                   help='IMAP host')
parser.add_argument('--port', dest='port', type=int, nargs=1,
                   help='IMAP port')
parser.add_argument('--user', dest='user', type=str, nargs=1,
                   help='IMAP user')
parser.add_argument('--password', dest='password', type=str, nargs=1,
                   help='IMAP password')
parser.add_argument('--folder', dest='folder', type=str, nargs=1,
                   help='IMAP folder')
parser.add_argument('--html2text', dest='html2text', action='store_true',
                   help='Try to convert HTML to text if no text/plain message is found')
parser.add_argument('--verbose', dest='verbose', action='store_true', 
                   help='Output additional log messages')

args = parser.parse_args()

if args.list:
    es_list = args.list[0]
if args.host:
    imap_host = args.host[0]
if args.port:
    imap_port = args.port[0]
if args.user:
    imap_user = args.user[0]
if args.password:
    imap_password = args.password[0]
if args.folder:
    imap_folder = args.folder[0]
if args.html2text:
    html2text = True
if args.verbose:
    verbose = True

if not es_list or not imap_password:
    parser.print_help()
    sys.exit(-1)

es_list = "<%s>" % es_list.strip("<>") # We need <> around it!

# fetch message-id => _id pairs from elasticsearch

es = elasticsearch.Elasticsearch()
result = es.search(scroll = '5m', 
    body = {
        'size': 1024, 
        'fields': ['message-id'], 
        'query': {'match': {'list': es_list}}
    }
)

db = {}
while len(result['hits']['hits']) > 0:
    for hit in result['hits']['hits']:
        db[hit['fields']['message-id'][0]] = hit['_id']
    result = es.scroll(scroll='5m', scroll_id=result['_scroll_id'])

# fetch message-id => uid pairs from imap

imap = imaplib.IMAP4_SSL(imap_host, imap_port)
imap.login(imap_user, imap_password)
imap.select(imap_folder, readonly=True)
results = imap.uid('search', None, 'ALL')
uids = b','.join(results[1][0].split())
results = imap.uid('fetch', uids, '(BODY[HEADER.FIELDS (MESSAGE-ID)])')

mail = {}
uid_re = re.compile(b'^\d+ \(UID (\d+) BODY\[')
mid_re = re.compile(b'^Message-ID:\s*(.*?)\s*$', re.I)
uid = None
for result in results[1]:
    for line in result:
        if isinstance(line, bytes):
            match = uid_re.match(line)
            if match:
                uid = match.group(1)
            else:
                 match = mid_re.match(line)
                 if match:
                     try:
                         mail[match.group(1).decode('utf-8')] = uid
                         uid = None
                     except ValueError:
                         pass

# delete items from elasticsearch that are not present in imap

for mid, _id in db.items():
    if not mid in mail:
        es.delete(index=iname, id=_id, doc_type='mbox')
        es.delete(index=iname, id=_id, doc_type='mbox_source')
        print("deleted: " + mid)

# add new items to elasticsearch from imap

for mid, uid in mail.items():
    if not mid in db:
        argv = [sys.executable, 'archiver.py', '--lid=%s' % es_list]
        if verbose: argv.append('--verbose')
        if html2text: argv.append('--html2text')
        child = subprocess.Popen(argv, stdin=subprocess.PIPE)
        child.stdin.write(imap.uid('fetch', uid, '(RFC822)')[1][0][1])
        child.stdin.close()
        rc = child.wait()
        print("inserted: %s, rc = %d" % (mid, rc))

