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

import sys
import random
import time
import hashlib
import os
from threading import Thread, Lock
import mailbox
import email.errors, email.utils, email.header
from urllib.request import urlopen
import re
import configparser
import argparse
from os import listdir
from os.path import isfile, join, isdir
import glob
import multiprocessing
import tempfile
import gzip
import archiver

try:
    from elasticsearch import Elasticsearch, helpers
    from formatflowed import convertToWrapped
except:
    print("Sorry, you need to install the elasticsearch and formatflowed modules from pip first.")
    sys.exit(-1)
    
y = 0
baddies = 0
block = Lock()
lists = []
start = time.time()
quickmode = False
private = False
appender = "apache.org"


source = "./"
maildir = False
imap = False
list_override = None
project = ""
filebased = False
fileToLID = {}
interactive = False
extension = ".mbox"
piperWeirdness = False
parseHTML = False
resendTo = None
timeout = 600
fromFilter = None
dedup = False
dedupped = 0

# Fetch config
path = os.path.dirname(os.path.realpath(__file__))
config = configparser.RawConfigParser()
config.read("%s/ponymail.cfg" % path)
auth = None
if config.has_option('elasticsearch', 'user'):
    auth = (config.get('elasticsearch','user'), config.get('elasticsearch','password'))



dbname = config.get("elasticsearch", "dbname")
ssl = config.get("elasticsearch", "ssl", fallback = "False").lower() == 'true'
    
uri = config.get("elasticsearch", "uri", fallback = "")
es = Elasticsearch([
    {
        'host': config.get("elasticsearch", "hostname"),
        'port': int(config.get("elasticsearch", "port")),
        'use_ssl': ssl,
        'url_prefix': uri,
        'http_auth': auth
    }],
    max_retries=5,
    retry_on_timeout=True
    )

rootURL = ""

class BulkThread(Thread):
    def assign(self, json, xes, dtype = 'mbox', wc = 'quorum'):
        self.json = json
        self.xes = xes
        self.dtype = dtype
        self.wc = wc

    def insert(self):
        global config
        sys.stderr.flush()
        if not self.xes.indices.exists(dbname):
            self.xes.indices.create(index = dbname)

        js_arr = []
        i = 0
        for entry in self.json:
            js = entry
            js['@version'] = 1
            #js['@import_timestamp'] = time.strftime("%Y/%m/%d %H:%M:%S", time.gmtime())
            js_arr.append({
                '_op_type': 'index',
                '_consistency': self.wc,
                '_index': dbname,
                '_type': self.dtype,
                '_id': js['mid'],
                'doc': js,
                '_source': js
            })
        try:
            helpers.bulk(self.xes, js_arr)
        except Exception as err:
            print("Warning: Could not bulk insert: %s" % err)
        #print("Inserted %u entries" % len(js_arr))


class SlurpThread(Thread):

    def run(self):
        global block, y, es, lists, baddies, config, resendTo, timeout, dedupped, dedup
        ja = []
        jas = []
        print("Thread started")
        mla = None
        ml = ""
        mboxfile = ""
        filename = ""
        xlist_override = None

        archie = archiver.Archiver(parseHTML = parseHTML)
    
        while len(lists) > 0:
            print("%u elements left to slurp" % len(lists))
            block.acquire()
            try:
                mla = lists.pop(0)
            except Exception as err:
                print("Could not pop list: %s" % err)
                block.release()
                return
            if not mla:
                print("Nothing more to do here")
                block.release()
                return
            block.release()
            EY = 1980
            EM = 1
            stime = time.time()
            dFile = False
            if maildir:
                messages = mailbox.Maildir(tmpname)
            elif imap:
                imap4 = mla[2]
                def mailgen(list):
                    for uid in list:
                        msgbytes = imap4.uid('fetch', uid, '(RFC822)')[1][0][1]
                        yield email.message_from_bytes(msgbytes)
                messages = mailgen(mla[0])
                xlist_override = mla[1]
            elif filebased:
                
                tmpname = mla[0]
                filename = mla[0]
                xlist_override = mla[1]
                if filename.find(".gz") != -1:
                    print("Decompressing %s..." % filename)
                    try:
                        with open(filename, "rb") as bf:
                            bmd = bf.read()
                            bf.close()
                            bmd = gzip.decompress(bmd)
                            tmpfile = tempfile.NamedTemporaryFile(mode='w+b', buffering=1, delete=False)
                            tmpfile.write(bmd)
                            tmpfile.flush()
                            tmpfile.close()
                            tmpname = tmpfile.name
                            filename = tmpname
                            dFile = True # Slated for deletion upon having been read
                            print("%s -> %u bytes" % (tmpname, len(bmd)))
                    except Exception as err:
                        print("This wasn't a gzip file: %s" % err )
                print("Slurping %s" % filename)
                messages = mailbox.mbox(tmpname)

            else:
                ml = mla[0]
                mboxfile = mla[1]
                xlist_override = list_override
                print("Slurping %s/%s" % (ml, mboxfile))
                m = re.match(r"(\d\d\d\d)(\d\d)", mboxfile)
                EY = 1997
                EM = 1
                if m:
                    EY = int(m.group(1))
                    EM = int(m.group(2))
                ctx = urlopen("%s%s/%s" % (source, ml, mboxfile ))
                inp = ctx.read().decode(ctx.headers.get_content_charset() or 'utf-8', errors='ignore')
    
                tmpname = hashlib.sha224(("%f-%f-%s-%s.mbox" % (random.random(), time.time(), ml, mboxfile)).encode('utf-8') ).hexdigest()
                with open(tmpname, "w") as f:
                    f.write(inp)
                    f.close()
                messages = mailbox.mbox(tmpname)

            count = 0
            LEY = EY
            
            
            for message in messages:
                # If --filter is set, discard any messages not matching by continuing to next email
                if fromFilter and 'from' in message and message['from'].find(fromFilter) == -1:
                    continue
                if resendTo:
                    print("Delivering message %s via MTA" % message['message-id'] if 'message-id' in message else '??')
                    s = SMTP('localhost')
                    try:
                        if list_override:
                            message.replace_header('List-ID', list_override)
                        message.replace_header('To', resendTo)
                    except:
                        if list_override:
                            message['List-ID'] = list_override
                    message['cc'] = None
                    s.send_message(message, from_addr=None, to_addrs=(resendTo))
                    continue
                if (time.time() - stime > timeout): # break out after N seconds, it shouldn't take this long..!
                    print("Whoa, this is taking way too long, ignoring %s for now" % tmpname)
                    break

                json, contents = archie.compute_updates(list_override, private, message)
                
                # If --dedup is active, try to filter out any messages that already exist
                if json and dedup and message.get('message-id', None):
                    res = es.search(
                        index=dbname,
                        doc_type="mbox",
                        size = 1,
                        body = {
                            'query': {
                                'bool': {
                                    'must': [
                                        {
                                            'term': {
                                                'message-id': message.get('message-id', None)
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    )
                    if res and len(res['hits']['hits']) > 0:
                        print("Dedupping %s" % json['message-id'])
                        dedupped += 1
                        continue

                if json:
                    json_source = {
                        'mid': json['mid'],
                        'message-id': json['message-id'],
                        'source': message.as_bytes().decode('utf-8', errors='replace')
                    }

                    count += 1
                    ja.append(json)
                    jas.append(json_source)
                    if contents:
                        if not args.dry:
                            for key in contents:
                                es.index(
                                    index=dbname,
                                    doc_type="attachment",
                                    id=key,
                                    body = {
                                        'source': contents[key]
                                    }
                                )
                    if len(ja) >= 40:
                        if not args.dry:
                            bulk = BulkThread()
                            bulk.assign(ja, es, 'mbox')
                            bulk.insert()
                        ja = []
                        
                        if not args.dry:
                            bulks = BulkThread()
                            bulks.assign(jas, es, 'mbox_source')
                            bulks.insert()
                        jas = []
                else:
                    baddies += 1

            if filebased:
                print("Parsed %u records from %s" % (count, filename))
                if dFile:
                    os.unlink(tmpname)
            elif imap:
                print("Parsed %u records from imap" % count)
            else:
                print("Parsed %s/%s: %u records from %s" % (ml, mboxfile, count, tmpname))
                os.unlink(tmpname)
                
            y += count
            if not args.dry:
                bulk = BulkThread()
                bulk.assign(ja, es)
                bulk.insert()
            ja = []
            
            if not args.dry:
                bulks = BulkThread()
                bulks.assign(jas, es, 'mbox_source')
                bulks.insert()
            jas = []
        print("Done, %u elements left to slurp" % len(lists))
        
parser = argparse.ArgumentParser(description='Command line options.')
parser.add_argument('--source', dest='source', type=str, nargs=1,
                   help='Source to scan (http(s)://, imap(s):// or file path)')
parser.add_argument('--dir', dest='dir', action='store_true',
                   help='Input is in Maildir format')
parser.add_argument('--interactive', dest='interactive', action='store_true',
                   help='Ask for help when possible')
parser.add_argument('--quick', dest='quick', action='store_true',
                   help='Only grab the first file you can find')
parser.add_argument('--mod-mbox', dest='modmbox', action='store_true',
                   help='This is mod_mbox, derive list-id and files from it')
parser.add_argument('--pipermail', dest='pipermail', action='store_true',
                   help='This is pipermail, derive files from it (list ID has to be set!)')
parser.add_argument('--lid', dest='listid', type=str, nargs=1,
                   help='Optional List-ID to override source with.')
parser.add_argument('--project', dest='project', type=str, nargs=1,
                   help='Optional project to look for ($project-* will be imported as well)')
parser.add_argument('--ext', dest='ext', type=str, nargs=1,
                   help='Optional file extension e.g. ".gz" (or call it with an empty string to not care)')
parser.add_argument('--domain', dest='domain', type=str, nargs=1,
                   help='Optional domain extension for MIDs and List ID reconstruction)')
parser.add_argument('--private', dest='private', action='store_true',
                   help='This is a privately archived list. Filter through auth proxy.')
parser.add_argument('--dry', dest='dry', action='store_true',
                   help='Do not save emails to elasticsearch, only test importing')
parser.add_argument('--html2text', dest='html2text', action='store_true',
                   help='If no text/plain is found, try to parse HTML using html2text')
parser.add_argument('--requirelid', dest='requirelid', action='store_true',
                   help='Require a List ID to be present, ignore otherwise')
parser.add_argument('--dedup', dest='dedup', action='store_true',
                   help='Try to dedup messages based on ID before importing')
parser.add_argument('--ignorebody', dest='ibody', type=str, nargs=1,
                   help='Optional email bodies to treat as empty (in conjunction with --html2text)')
parser.add_argument('--resend', dest='resend', type=str, nargs=1,
                   help='DANGER ZONE: Resend every read email to this recipient as a new email')
parser.add_argument('--timeout', dest='timeout', type=int, nargs=1,
                   help='Optional timeout in secs for importing an mbox/maildir file (default is 600 seconds)')
parser.add_argument('--filter', dest = 'fromfilter', type=str, nargs=1,
                    help = 'Optional sender filter: Only import emails from this address')

args = parser.parse_args()

if len(sys.argv) <= 2:
    parser.print_help()
    sys.exit(-1)



if args.source:
    source = args.source[0]
if args.dir:
    maildir = args.dir
if args.listid:
    list_override = '<%s>' % args.listid[0].strip('<>')
if args.project:
    project = args.project[0]
if args.domain:
    appender = args.domain[0]
if args.interactive:
    interactive = args.interactive
if args.quick:
    quickmode = args.quick
if args.private:
    private = args.private
if args.dedup:
    dedup = args.dedup
if args.ext:
    extension = args.ext[0]
if args.html2text:
    import html2text
    parseHTML = True
if args.ibody:
    archiver.iBody = args.ibody[0]
if args.fromfilter:
    fromFilter = args.fromfilter[0]
if args.resend:
    resendTo = args.resend[0]
    from smtplib import SMTP
if args.timeout:
    timeout = args.timeout[0]
baddies = 0


def globDir(d):
    dirs = [ f for f in listdir(d) if isdir(join(d,f)) ]
    mboxes = [ f for f in glob.glob(join(d,"*" + extension)) if isfile(f) ]
    lo = list_override
    if not d in fileToLID and len(mboxes) > 0 and interactive:
        print("Would you like to set a list-ID override for %s?:" % d)
        lo = sys.stdin.readline()
        if lo and len(lo) > 3:
            fileToLID[d] = "<" + lo.strip("\r\n<>") + ">"
            print("Righto, setting it to %s." % fileToLID[d])
        else:
            print("alright, I'll try to figure it out myself!")
    for fi in sorted(mboxes):
        lists.append([fi, fileToLID.get(d) if fileToLID.get(d) else list_override])
    
    for nd in sorted(dirs):
        globDir(join(d,nd))
 

# HTTP(S) based import?
if re.match(r"https?://", source):
    data = urlopen(source).read().decode('utf-8')
    print("Fetched %u bytes of main data, parsing month lists" % len(data))
    
    ns = r"<a href='(%s[-a-z0-9]+)/'" % project
    if project.find("-") != -1:
        ns = r"<a href='(%s)/'" % project
    
    if args.modmbox:
        for mlist in re.finditer(ns, data):
            ml = mlist.group(1)
            mldata = urlopen("%s%s/" % (source, ml)).read().decode('utf-8')
            present = re.search(r"<th colspan=\"3\">Year 20[\d]{2}</th>", mldata) # Check that year 2014-2017 exists, otherwise why keep it?
            if present:
                qn = 0
                for mbox in re.finditer(r"(\d+\.mbox)/thread", mldata):
                    qn += 1
                    mboxfile = mbox.group(1)
                    lists.append([ml, mboxfile])
                    print("Adding %s/%s to slurp list" % (ml, mboxfile))
                    if quickmode and qn >= 2:
                        break
    
    if args.pipermail:
        filebased = True
        piperWeirdness = True
        if not list_override:
            print("You need to specify a list ID with --lid when importing from Pipermail!")
            sys.exit(-1)
        ns = r"href=\"(\d+-[a-zA-Z]+\.txt(\.gz)?)\""
        qn = 0
        for mlist in re.finditer(ns, data):
            ml = mlist.group(1)
            mldata = urlopen("%s%s" % (source, ml)).read()
            tmpfile = tempfile.NamedTemporaryFile(mode='w+b', buffering=1, delete=False)
            try:
                if ml.find(".gz") != -1:
                    mldata = gzip.decompress(mldata)
            except Exception as err:
                print("This wasn't a gzip file: %s" % err )
            print(len(mldata))
            tmpfile.write(mldata)
            tmpfile.flush()
            tmpfile.close()
            lists.append([tmpfile.name, list_override])
            print("Adding %s/%s to slurp list as %s" % (source, ml, tmpfile.name))
            qn += 1
            if quickmode and qn >= 2:
                break
                    
# IMAP(S) based import?
elif re.match(r"imaps?://", source):
    imap = True
    import urllib, getpass, imaplib
    url = urllib.parse.urlparse(source)
    
    port = url.port or (143 if url.scheme == 'imap' else 993)
    user = url.username or getpass.getuser()
    password = url.password or getpass.getpass('IMAP Password: ')
    folder = url.path.strip('/') or 'INBOX'
    listname = list_override or "<%s/%s.%s>" % (user, folder, url.hostname)

    # fetch message-id => _id pairs from elasticsearch

    es = Elasticsearch()
    result = es.search(scroll = '5m', 
        body = {
            'size': 1024, 
            'fields': ['message-id'], 
            'query': {'match': {'list': listname}}
        }
    )

    db = {}
    while len(result['hits']['hits']) > 0:
        for hit in result['hits']['hits']:
            db[hit['fields']['message-id'][0]] = hit['_id']
        result = es.scroll(scroll='5m', scroll_id=result['_scroll_id'])

    # fetch message-id => uid pairs from imap

    if url.scheme == 'imaps':
        imap4 = imaplib.IMAP4_SSL(url.hostname, port)
    else:
        imap4 = imaplib.IMAP4(url.hostname, port)
    imap4.login(user, password)
    imap4.select(folder, readonly=True)
    results = imap4.uid('search', None, 'ALL')
    uids = b','.join(results[1][0].split())
    results = imap4.uid('fetch', uids, '(BODY[HEADER.FIELDS (MESSAGE-ID)])')

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

    queue1 = []
    queue2 = []
    for mid, _id in db.items():
        if not mid in mail:
            queue1.append({
                '_op_type': 'delete',
                '_index': dbname,
                '_type': 'mbox',
                '_id': _id
            })
            queue2.append({
                '_op_type': 'delete',
                '_index': dbname,
                '_type': 'mbox_source',
                '_id': _id
            })
            print("deleting: " + mid)

    while len(queue1) > 0:
        eshelper.bulk(es, queue1[0:1024])
        del queue1[0:1024]

    while len(queue2) > 0:
        eshelper.bulk(es, queue2[0:1024])
        del queue2[0:1024]

    # add new items to elasticsearch from imap

    uids = []
    for mid, uid in mail.items():
        if not mid in db:
            uids.append(uid)
    lists.append([uids, listname, imap4])
else:
    # File based import??
    print("Doing file based import")
    filebased = True
    if maildir:
        lists.append([source, fileToLID.get(source) if fileToLID.get(source) else list_override])
    else:
        if os.path.isfile(source):
            lists.append([source, fileToLID.get(source) if fileToLID.get(source) else list_override])
        else:
            globDir(source)


threads = []
# Don't start more threads than there are lists
cc = min(len(lists), int( multiprocessing.cpu_count() / 2) + 1)
print("Starting up to %u threads to fetch the %u %s lists" % (cc, len(lists), project))
for i in range(1,cc+1):
    t = SlurpThread()
    threads.append(t)
    t.start()
    print("Started no. %u" % i)

for t in threads:
    t.join()

print("All done! %u records inserted/updated after %u seconds. %u records were bad and ignored" % (y, int(time.time() - start), baddies))
if dedupped > 0:
    print("%u records were not inserted due to deduplication" % dedupped)
