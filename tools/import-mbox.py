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
import random
import time
import hashlib
import os
from threading import Thread, Lock
import mailbox
import email.errors, email.utils, email.header
from urllib.request import urlopen
import re
from elastic import Elastic
import argparse
from os import listdir
from os.path import isfile, join, isdir
import glob
import multiprocessing
import tempfile
import gzip

import archiver

goodies = 0
baddies = 0
duplicates={} # detect if mid is re-used this run
block = Lock()
lists = [] # N.B. the entries in this list depend on the import type:
# globDir: [filename, list-id]
# modMbox: [list-id, mbox]
# piperMail: [filename, list-id]
# imap(s): [uids, listname, imap4]
# other: [filename, list-override]
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
noMboxo = False # Don't skip MBoxo patch

# Fetch config and set up ES
es = Elastic()
# We need the index name for bulk actions
dbname = es.getdbname()

rootURL = ""

def bulk_insert(name, json, xes, dtype, wc = 'quorum'):
    if args.dry:
        return

    sys.stderr.flush()

    js_arr = []
    for entry in json:
        js = entry
        mid = js['mid']
        if dtype == 'mbox_source':
            del js['mid']
        js_arr.append({
            '_op_type': 'index',
            '_consistency': wc,
            '_index': dbname,
            '_type': dtype,
            '_id': mid,
            'doc': js,
            '_source': js
        })
    try:
        xes.bulk(js_arr,ignore=404)
#       print("%s: Inserted %u entries into %s" % (name, len(js_arr),dtype))
    except Exception as err:
        print("%s: Warning: Could not bulk insert: %s into %s" % (name,err,dtype))

class SlurpThread(Thread):

    def printid(self, message):
        print("%s: %s" % (self.name, message))

    def run(self):
        global goodies, baddies, dedupped
        self.name = Thread.getName(self)
        ja = []
        jas = []
        self.printid("Thread started")
        mla = None
        ml = ""
        mboxfile = ""
        filename = ""

        archie = archiver.Archiver(parseHTML = parseHTML)

        while len(lists) > 0:
            self.printid("%u elements left to slurp" % len(lists))

            block.acquire()
            try:
                mla = lists.pop(0)
                if not mla:
                    self.printid("Nothing more to do here")
                    return
            except Exception as err:
                self.printid("Could not pop list: %s" % err)
                return
            finally:
                block.release()

            stime = time.time()
            dFile = False
            if imap:
                imap4 = mla[2]
                def mailgen(_list):
                    for uid in _list:
                        msgbytes = imap4.uid('fetch', uid, '(RFC822)')[1][0][1]
                        yield email.message_from_bytes(msgbytes)
                messages = mailgen(mla[0])
            elif filebased:

                tmpname = mla[0]
                filename = mla[0]
                if filename.find(".gz") != -1:
                    self.printid("Decompressing %s..." % filename)
                    try:
                        with open(filename, "rb") as bf:
                            bmd = bf.read()
                            bf.close() # explicit early close
                            bmd = gzip.decompress(bmd)
                            tmpfile = tempfile.NamedTemporaryFile(mode='w+b', buffering=1, delete=False)
                            tmpfile.write(bmd)
                            tmpfile.flush()
                            tmpfile.close()
                            tmpname = tmpfile.name
                            dFile = True # Slated for deletion upon having been read
                            self.printid("%s -> %u bytes" % (tmpname, len(bmd)))
                    except Exception as err:
                        self.printid("This wasn't a gzip file: %s" % err )
                self.printid("Slurping %s" % filename)
                if maildir:
                    messages = mailbox.Maildir(tmpname, create=False)
                else:
                    messages = mailbox.mbox(tmpname, None if noMboxo else MboxoFactory, create=False)

            else:
                ml = mla[0]
                mboxfile = mla[1]
                self.printid("Slurping %s/%s" % (ml, mboxfile))
                ctx = urlopen("%s%s/%s" % (source, ml, mboxfile ))
                inp = ctx.read().decode(ctx.headers.get_content_charset() or 'utf-8', errors='ignore')

                tmpname = hashlib.sha224(("%f-%f-%s-%s.mbox" % (random.random(), time.time(), ml, mboxfile)).encode('utf-8') ).hexdigest()
                with open(tmpname, "w") as f:
                    f.write(inp)
                if maildir:
                    messages = mailbox.Maildir(tmpname, create=False)
                else:
                    messages = mailbox.mbox(tmpname, None if noMboxo else MboxoFactory, create=False)

            count = 0
            bad = 0


            for key in messages.iterkeys():
                message=messages.get(key)
                # If --filter is set, discard any messages not matching by continuing to next email
                if fromFilter and 'from' in message and message['from'].find(fromFilter) == -1:
                    continue
                if resendTo:
                    self.printid("Delivering message %s via MTA" % message['message-id'] if 'message-id' in message else '??')
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
                    self.printid("Whoa, this is taking way too long, ignoring %s for now" % tmpname)
                    break

                # Don't pass message to archiver unless we have a list id
                if not (list_override or message['list-id']):
                    self.printid("No list id found for %s " % message['message-id'])
                    bad += 1
                    continue

                json, contents, _msgdata, _irt = archie.compute_updates(list_override, private, message)

                # Not sure this can ever happen
                if json and not (json['list'] and json['list_raw']):
                    self.printid("No list id found for %s " % json['message-id'])
                    bad += 1
                    continue

                # If --dedup is active, try to filter out any messages that already exist on the list
                if json and dedup and message.get('message-id', None):
                    res = es.search(
                        doc_type="mbox",
                        size = 1,
                        _source = ['mid'], # so can report the match source
                        body = {
                            'query': {
                                'bool': {
                                    'must': [
                                        {
                                            'term': {
                                                'message-id': message.get('message-id', None)
                                            }
                                        },
                                        {
                                            'term': {
                                                'list_raw': json['list']
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    )
                    if res and res['hits']['total'] > 0:
                        self.printid("Dedupping %s - matched in %s" % (json['message-id'], res['hits']['hits'][0]['_source']['mid']))
                        dedupped += 1
                        continue

                if json:
                    file=messages.get_file(key, True)
                    # If the parsed data is filtered, also need to filter the raw input
                    # so the source agrees with the summary info
                    if message.__class__.__name__ == 'MboxoFactory':
                        file=MboxoReader(file)
                    raw_msg=file.read()
                    file.close()
                    if args.dups:
                        try:
                            duplicates[json['mid']].append(json['message-id'] + " in " + filename)
                        except:
                            duplicates[json['mid']]=[json['message-id'] + " in " + filename]

                    try: # temporary hack to try and find an encoding issue
                        # needs to be replaced by proper exception handling
                        json_source = {
                            'mid': json['mid'], # needed for bulk-insert only, not needed in database
                            'message-id': json['message-id'],
                            'source': archie.mbox_source(raw_msg)
                        }
                    except Exception as e:
                        self.printid("Error '%s' processing id %s msg %s " % (e, json['mid'], json['message-id']))
                        bad += 1
                        continue

                    count += 1
                    ja.append(json)
                    jas.append(json_source)
                    if contents:
                        if not args.dry:
                            for key in contents:
                                es.index(
                                    doc_type="attachment",
                                    id=key,
                                    body = {
                                        'source': contents[key]
                                    }
                                )
                    if len(ja) >= 40:
                        bulk_insert(self.name, ja, es, 'mbox')
                        ja = []

                        bulk_insert(self.name, jas, es, 'mbox_source')
                        jas = []
                else:
                    self.printid("Failed to parse: Return=%s Message-Id=%s" % (message.get('Return-Path'), message.get('Message-Id')))
                    bad += 1

            if filebased:
                self.printid("Parsed %u records (failed: %u) from %s" % (count, bad, filename))
                if dFile:
                    os.unlink(tmpname)
            elif imap:
                self.printid("Parsed %u records (failed: %u) from imap" % (count, bad))
            else:
                self.printid("Parsed %s/%s: %u records (failed: %u) from %s" % (ml, mboxfile, count, bad, tmpname))
                os.unlink(tmpname)

            goodies += count
            baddies += bad
            if len(ja) > 0:
                bulk_insert(self.name, ja, es, 'mbox')
            ja = []

            if len(jas) > 0:
                bulk_insert(self.name, jas, es, 'mbox_source')
            jas = []
        self.printid("Done, %u elements left to slurp" % len(lists))

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
                   help='Optional List-ID to override source with. Format: <list-name>@<domain>')
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
parser.add_argument('--duplicates', dest='dups', action='store_true',
                   help='Detect duplicate mids in this run')
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
parser.add_argument('--nomboxo', dest = 'nomboxo', action='store_true',
                    help = 'Skip Mboxo processing')

args = parser.parse_args()

if len(sys.argv) <= 2:
    parser.print_help()
    sys.exit(-1)



if args.source:
    source = args.source[0]
if args.dir:
    maildir = args.dir
if args.listid:
    list_override = archiver.normalize_lid(args.listid[0])
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
    parseHTML = True
if args.ibody:
    archiver.iBody = args.ibody[0]
if args.fromfilter:
    fromFilter = args.fromfilter[0]
if args.nomboxo:
    noMboxo = args.nomboxo
else:
    # Temporary patch to fix Python email package limitation
    # It must be removed when the Python package is fixed
    from mboxo_patch import MboxoFactory, MboxoReader

if args.resend:
    resendTo = args.resend[0]
    from smtplib import SMTP
if args.timeout:
    timeout = args.timeout[0]
baddies = 0

# No point continuing if the index does not exist
print("Checking that the database index %s exists ... " % dbname)

# elasticsearch logs lots of warnings on retries/connection failure
import logging
logging.getLogger("elasticsearch").setLevel(logging.ERROR)

if args.dry:
    print("Dry-run; continuing to check input data")
else:
    # Need to check the index before starting bulk operations
    try:
        if not es.indices.exists(index=dbname):
            print("Error: the index '%s' does not exist!" % (dbname))
            sys.exit(1)
        print("Database exists OK")
    except Exception as err:
        print("Error: unable to check if the index %s exists!: %s" % (dbname, err))
        sys.exit(1)


def globDir(d):
    dirs = [ f for f in listdir(d) if isdir(join(d,f)) ]
    mboxes = [ f for f in glob.glob(join(d,"*" + extension)) if isfile(f) ]
    if not d in fileToLID and len(mboxes) > 0 and interactive:
        print("Would you like to set a list-ID override for %s?:" % d)
        lo = sys.stdin.readline()
        if lo and len(lo) > 3:
            fileToLID[d] = archiver.normalize_lid(lo.strip("\r\n"))
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

    if project:
        # ensure there is a '-' between project and list name otherwise we match too much
        # Note: It looks like mod_mbox always uses single quoted hrefs
        ns = r"<a href='(%s-[-a-z0-9]+)/'" % project
        if project.find("-") != -1:
            ns = r"<a href='(%s)/'" % project
    else: # match all possible project names
        ns = r"<a href='([-a-z0-9]+)/'"

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
        es.bulk(queue1[0:1024])
        del queue1[0:1024]

    while len(queue2) > 0:
        es.bulk(queue2[0:1024])
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

if args.dups:
    print("Showing duplicate ids:")
    for mid in duplicates:
        if len(duplicates[mid]) > 1:
            print("The mid %s was used by:" % mid)
            for msg in duplicates[mid]:
                print(msg)

print("All done! %u records inserted/updated after %u seconds. %u records were bad and ignored" % (goodies, int(time.time() - start), baddies))
if dedupped > 0:
    print("%u records were not inserted due to deduplication" % dedupped)
