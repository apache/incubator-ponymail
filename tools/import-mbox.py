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
import hashlib
import os
from threading import Thread, Lock
import mailbox
import email.errors, email.utils, email.header
from urllib.request import urlopen
import re
import chardet
import datetime
import configparser
import argparse
from os import listdir
from os.path import isfile, join, isdir
import glob
import codecs
import multiprocessing
import tempfile
import gzip

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
lid_override = None
private = False
appender = "apache.org"


source = "./"
list_override = None
project = ""
recursive = False
filebased = False
fileToLID = {}
interactive = False
extension = "*.mbox"
attachments = False
piperWeirdness = False

# Fetch config
config = configparser.RawConfigParser()
config.read('ponymail.cfg')
auth = None
if config.has_option('elasticsearch', 'user'):
    auth = (config.get('elasticsearch','user'), config.get('elasticsearch','password'))



ssl = False
dbname = config.get("elasticsearch", "dbname")
if config.has_option("elasticsearch", "ssl") and config.get("elasticsearch", "ssl").lower() == 'true':
    ssl = True
    
cropout = None
if config.has_option("debug", "cropout") and config.get("debug", "cropout") != "":
    cropout = config.get("debug", "cropout")
    
uri = ""
if config.has_option("elasticsearch", "uri") and config.get("elasticsearch", "uri") != "":
    uri = config.get("elasticsearch", "uri")
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

def parse_attachment(part):
    cd = part.get("Content-Disposition", None)
    if cd:
        dispositions = cd.strip().split(";")
        if dispositions[0].lower() == "attachment":
            try:
                fd = part.get_payload(decode=True)
                if fd:
                    attachment = {}
                    attachment['content_type'] = part.get_content_type()
                    attachment['size'] = len(fd)
                    attachment['filename'] = None
                    h = hashlib.sha256(fd).hexdigest()
                    b64 = codecs.encode(fd, "base64").decode('ascii')
                    attachment['hash'] = h
                    for param in dispositions[1:]:
                        key,val = param.split("=", 1)
                        if key.lower().strip() == "filename":
                            val = val.strip(' "')
                            print("Found attachment: %s" % val)
                            attachment['filename'] = val
                    if attachment['filename']:
                        return attachment, b64 # Return meta data and contents separately
            except:
                pass
    return None, None

def msgfiles(msg):
        attachments = []
        contents = {}
        if msg.is_multipart():    
            for part in msg.walk():
                part_meta, part_file = parse_attachment(part)
                if part_meta:
                    attachments.append(part_meta)
                    contents[part_meta['hash']] = part_file
        return attachments, contents
    
def pm_charsets(msg):
    charsets = set({})
    for c in msg.get_charsets():
        if c is not None:
            charsets.update([c])
    return charsets

def msgbody(msg):
    body = None
    if msg.is_multipart():
        for part in msg.walk():
            try:
                if part.is_multipart(): 
                    for subpart in part.walk():
                        if subpart.get_content_type() == 'text/plain':
                                body = subpart.get_payload(decode=True)
                                break
        
                elif part.get_content_type() == 'text/plain':
                    body = part.get_payload(decode=True)
                    break
            except:
                pass
    elif msg.get_content_type() == 'text/plain':
        body = msg.get_payload(decode=True) 

    for charset in pm_charsets(msg):
        try:
            body = body.decode(charset) if type(body) is bytes else body
        except:
            body = body.decode('utf-8', errors='replace') if type(body) is bytes else body
            
    return body  


def msgfactory(fp):
    try:
        return email.message_from_file(fp)
    except Exception as err:
        # Don't return None since that will
        # stop the mailbox iterator
        print("hmm: %s" % err)
        return None


class BulkThread(Thread):
    def assign(self, json, xes, dtype = 'mbox'):
        self.json = json
        self.xes = xes
        self.dtype = dtype

    def insert(self):
        global config
        sys.stderr.flush()
        iname = config.get("elasticsearch", "dbname")
        if not self.xes.indices.exists(iname):
            self.xes.indices.create(index = iname)

        js_arr = []
        i = 0
        for entry in self.json:
            js = entry
            js['@version'] = 1
            #js['@import_timestamp'] = time.strftime("%Y/%m/%d %H:%M:%S", time.gmtime())
            js_arr.append({
                '_op_type': 'index',
                '_index': iname,
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
        global block, y, es, lists, baddies, config
        ja = []
        jas = []
        print("Thread started")
        mla = None
        ml = ""
        mboxfile = ""
        filename = ""
        xlist_override = None
    
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
            y += 1
            EY = 1980
            EM = 1
            stime = time.time()
            if filebased:
                
                tmpname = mla[0]
                filename = mla[0]
                xlist_override = mla[1]
                print("Slurping %s" % filename)
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
    
            count = 0
            LEY = EY
            for message in mailbox.mbox(tmpname):
                if (time.time() - stime > 120):
                    print("Whoa, this is taking way too long, ignoring %s for now" % tmpname)
                    break
                if 'subject' in message:
                    subject = message['subject']       # Could possibly be None.
                    mid = message['message-id']

                    lid = message['list-id']
                    if not lid or lid == "": # Guess list name in absence
                        lid = '.'.join(reversed(ml.split("-"))) + ".apache.org"
                    
                    # Compact LID to <foo@domain>, discard rest
                    m = re.search(r"(<.+>)", lid)
                    if m:
                        lid = m.group(1)
                    if xlist_override and len(xlist_override) > 3:
                        lid = xlist_override
                    lid = lid.replace("@",".") # we want foo.bar.org, not foo@bar.org
                    lid = "<%s>" % lid.strip("<>") # We need <> around it!
                    if cropout:
                        lid = lid.replace(cropout, "")
                    date = message['date']
                    fro = message['from']
                    to = message['to']
                    body = msgbody(message)
                    try:
                        if 'content-type' in message and message['content-type'].find("flowed") != -1:
                            body = convertToWrapped(body, character_set="utf-8")
                        if isinstance(body, str):
                            body = body.encode('utf-8')
                    except Exception as err:
                        try:
                            body = body.decode(chardet.detect(body)['encoding'])
                        except Exception as err:
                            try:
                                body = body.decode('latin-1')
                            except:
                                try:
                                    if isinstance(body, str):
                                        body = body.encode('utf-8')
                                except:
                                    body = None

                    okay = True
                    dheader = {}
                    for key in ['to','from','subject','message-id']:
                        try:
                            hval = ""
                            if message.get(key):
                                for t in email.header.decode_header(message[key]):
                                    if t[1] == None or t[1].find("8bit") != -1:
                                        hval += t[0].decode('utf-8', errors='replace') if type(t[0]) is bytes else t[0]
                                    else:
                                        hval += t[0].decode(t[1],errors='ignore')
                                dheader[key] = hval
                            else:
                                dheader[key] = "(Unknown)"
                        except Exception as err:
                            print("Could not decode headers, ignoring..: %s" % err)
                            okay = False
                    mdt = ""
                    if not 'date' in message and 'received' in message:
                        m = re.search(r"(\d+ \S+ \d{4} \d\d:\d\d:\d\d ([-+]\d{4})?)", message['received'])
                        if m:
                            mdt = m.group(1)
                    else:
                        mdt = message['date']
                    mdate = None
                    try:
                        mdate = email.utils.parsedate_tz(mdt)
                    except:
                        pass
                    if not mdate or mdate[0] < (LEY-1):
                        print("Date is wrong or missing here, setting to %s" % ( LEY))
                        mdate = datetime.datetime(LEY, EM, 1).timetuple()
                    else:
                        LEY = mdate[0] # Gather evidence 'n'stuff!
                    mdatestring = ""
                    try:
                        mdatestring = time.strftime("%Y/%m/%d %H:%M:%S", time.localtime(email.utils.mktime_tz(mdate)))
                    except:
                        okay = False
                    if body and okay and mdate and {'from','subject'} <= set(dheader):
                        # Pipermail transforms from: to something weird - reset that!
                        if piperWeirdness:
                            m = re.match(r"(.+) at ([^(]+) \((.+)\)$", dheader['from'])
                            if m:
                                dheader['from'] = "%s <%s@%s>" % (m.group(3), m.group(1), m.group(2))
                                
                        attachments, contents = msgfiles(message)
                        if mid == None or not mid:
                            try:
                                mid = hashlib.sha256(body if type(body) is bytes else body.encode('ascii', errors='ignore')).hexdigest() + "@" + lid + "@" + appender
                            except:
                                if filebased:
                                    mid = hashlib.sha256("%f-%f-%s" % (random.random(), time.time(), filename) ).hexdigest()+ "@" + appender
                                else:
                                    mid = hashlib.sha256("%f-%f-%s-%s" % (random.random(), time.time(), ml, mboxfile) ).hexdigest()+ "@" + appender
                            print("No MID found, setting to %s" % mid)
                        mid2 = "%s@%s@%s" % (hashlib.sha224(body if type(body) is bytes else body.encode('ascii', errors='ignore')).hexdigest(), email.utils.mktime_tz(mdate), lid)
                        count += 1
                        mr = ""
                        if 'references' in message:
                            mr = message['references']
                        irt = ""
                        if 'in-reply-to' in message:
                            try:
                                irt = "\n".join(message['in-reply-to'])
                            except:
                                irt = message.get('in-reply-to').__str__()

                        json = {
                            'from_raw': dheader['from'],
                            'from': dheader['from'],
                            'to': dheader['to'],
                            'subject': dheader['subject'],
                            'cc': message.get('cc'),
                            'message-id': mid,
                            'mid': mid2,
                            'epoch': email.utils.mktime_tz(mdate),
                            'list': lid,
                            'list_raw': lid,
                            'date': mdatestring,
                            'private': private,
                            'references': mr,
                            'in-reply-to': irt,
                            'body': body.decode('utf-8', errors='replace') if type(body) is bytes else body,
                            'attachments': attachments
                        }
                        json_source = {
                            'mid': mid2,
                            'message-id': mid,
                            'source': message.as_bytes().decode('utf-8', errors='replace')
                        }
                        ja.append(json)
                        jas.append(json_source)
                        if contents:
                            iname = config.get("elasticsearch", "dbname")
                            if not args.dry:
                                for key in contents:
                                    es.index(
                                        index=iname,
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
        
tlpname = "foo"

parser = argparse.ArgumentParser(description='Command line options.')
parser.add_argument('--source', dest='source', type=str, nargs=1,
                   help='Source to scan (either http(s):// or file path)')
parser.add_argument('--recursive', dest='recursive', action='store_true', 
                   help='Do a recursive scan (sub dirs etc)')
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
                   help='Optional file extension (or call it with no args to not care)')
parser.add_argument('--domain', dest='domain', type=str, nargs=1,
                   help='Optional domain extension for MIDs and List ID reconstruction)')
parser.add_argument('--private', dest='private', action='store_true',
                   help='This is a privately archived list. Filter through auth proxy.')
parser.add_argument('--attachments', dest='attachments', action='store_true',
                   help='Also iport attached files in emails')
parser.add_argument('--dry', dest='dry', action='store_true',
                   help='Do not save emails to elasticsearch, only test importing')

args = parser.parse_args()

if len(sys.argv) <= 2:
    parser.print_help()
    sys.exit(-1)



if args.source:
    source = args.source[0]
if args.listid:
    list_override = args.listid[0]
if args.project:
    project = args.project[0]
if args.domain:
    appender = args.domain[0]
if args.recursive:
    recursive = args.recursive
if args.interactive:
    interactive = args.interactive
if args.quick:
    quickmode = args.quick
if args.private:
    private = args.private
if args.attachments:
    attachments = args.attachments
if args.ext:
    extension = args.ext[0]

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
 

# File based import??
if source[0] == "/" or source[0] == ".":
    print("Doing file based import")
    filebased = True
    globDir(source)
    

# HTTP(S) based import?
elif source[0] == "h":
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
                    
threads = []
print("Starting up to %u threads to fetch the %u %s lists" % (multiprocessing.cpu_count(), len(lists), project))
for i in range(1,multiprocessing.cpu_count()+1):
    t = SlurpThread()
    threads.append(t)
    t.start()
    print("Started no. %u" % i)

for t in threads:
    t.join()

print("All done! %u records inserted/updated after %u seconds. %u records were bad and ignored" % (y, int(time.time() - start), baddies))
