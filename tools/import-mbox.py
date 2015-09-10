#!/usr/bin/env python
# -*- coding: utf-8 -*-
import sys
import random, time
import hashlib
import os
from threading import Thread, Lock
import mailbox
import email.errors, email.utils, email.header
import urllib
import re
import chardet
import datetime
import ConfigParser as configparser
import argparse
from os import listdir
from os.path import isfile, join, isdir
import glob
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


source = "./"
list_override = None
project = ""
recursive = False
filebased = False
fileToLID = {}
interactive = False
extension = "*.mbox"

# Fetch config
config = configparser.RawConfigParser()
config.read('ponymail.cfg')


es = Elasticsearch([
    {
        'host': config.get("elasticsearch", "hostname"),
        'port': 9200,
        'use_ssl': False,
        'url_prefix': ''
    }],
    max_retries=5,
    retry_on_timeout=True
    )

rootURL = config.get("import", "mod_mbox") #http://mail-archives.eu.apache.org/mod_mbox/

def getcharsets(msg):
    charsets = set({})
    for c in msg.get_charsets():
        if c is not None:
            charsets.update([c])
    return charsets

def msgbody(msg):
    body = None
    #Walk through the parts of the email to find the text body.
    if msg.is_multipart():
        for part in msg.walk():

            # If part is multipart, walk through the subparts.
            if part.is_multipart():

                for subpart in part.walk():
                    if subpart.get_content_type() == 'text/plain':
                        # Get the subpart payload (i.e the message body)
                        body = subpart.get_payload(decode=True)
                        #charset = subpart.get_charset()

            # Part isn't multipart so get the email body
            elif part.get_content_type() == 'text/plain':
                body = part.get_payload(decode=True)
                #charset = part.get_charset()

    # If this isn't a multi-part message then get the payload (i.e the message body)
    elif msg.get_content_type() == 'text/plain':
        body = msg.get_payload(decode=True)

   # No checking done to match the charset with the correct part.
    for charset in getcharsets(msg):
        try:
            body = body.decode(charset)
        except:
            body = None

    return body


def msgfactory(fp):
    try:
        return email.message_from_file(fp)
    except email.Errors.MessageParseError:
        # Don't return None since that will
        # stop the mailbox iterator
        return ''


class BulkThread(Thread):
    def assign(self, json, xes):
        self.json = json
        self.xes = xes

    def insert(self):
        sys.stderr.flush()
        iname = "ponymail_alpha"
        if not self.xes.indices.exists(iname):
            self.xes.indices.create(index = iname)

        js_arr = []
        i = 0
        for entry in self.json:
            js = entry
            js['@version'] = 1
            js['@import_timestamp'] = time.strftime("%Y/%m/%d %H:%M:%S", time.gmtime())
            js_arr.append({
                '_op_type': 'index',
                '_index': iname,
                '_type': 'mbox',
                '_id': js['mid'],
                'doc': js,
                '_source': js
            })
        try:
            helpers.bulk(self.xes, js_arr)
        except:
            sys.exit(-1)
        #print("Inserted %u entries" % len(js_arr))


class SlurpThread(Thread):

    def run(self):
        global block, y, es, lists, baddies
        ja = []
        print("Thread started")
        mla = None
        ml = ""
        mboxfile = ""
        filename = ""
        xlist_override = None
        while len(lists) > 0:
            if len(lists) == 0:
                return
            block.acquire()
            try:
                mla = lists.pop(0)
            except:
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
            if filebased:
                
                tmpname = mla[0]
                filename = mla[0]
                xlist_override = mla[1]
                print("Slurping %s" % filename)
            else:
                ml = mla[0]
                mboxfile = mla[1]
                print("Slurping %s/%s" % (ml, mboxfile))
                m = re.match(r"(\d\d\d\d)(\d\d)", mboxfile)
                EY = 1997
                EM = 1
                if m:
                    EY = int(m.group(1))
                    EM = int(m.group(2))
                inp = urllib.urlopen("%s%s/%s" % (source, ml, mboxfile )).read()
    
                tmpname = hashlib.sha224("%f-%f-%s-%s.mbox" % (random.random(), time.time(), ml, mboxfile) ).hexdigest()
                with open(tmpname, "w") as f:
                    f.write(inp)
                    f.close()
    
            count = 0
            LEY = EY
            for message in mailbox.mbox(tmpname, factory=msgfactory):
                if 'subject' in message:
                    subject = message['subject']       # Could possibly be None.
                    mid = message['message-id']

                    lid = message['list-id']
                    if not lid or lid == "" or lid.find("incubator") != -1: # Guess list name in absence
                        lid = '.'.join(reversed(ml.split("-"))) + ".apache.org"
                    
                    # Compact LID to <foo@domain>, discard rest
                    m = re.search(r"(<.+>)", lid)
                    if m:
                        lid = m.group(1)
                    if xlist_override and len(xlist_override) > 3:
                        lid = xlist_override
                    lid = lid.replace("@",".") # we want foo.bar.org, not foo@bar.org
                    date = message['date']
                    fro = message['from']
                    to = message['to']
                    body = msgbody(message)
                    try:
                        if 'content-type' in message and message['content-type'].find("flowed") != -1:
                            body = convertToWrapped(body, character_set="utf-8")
                        if isinstance(body, str):
                            body = body.decode('utf-8')
                    except Exception as err:
                        try:
                            body = body.decode(chardet.detect(body)['encoding'])
                        except Exception as err:
                            try:
                                body = body.decode('latin-1')
                            except:
                                #print("Could not decode message, ignoring..")
                                baddies += 1
                                body = None

                    okay = True
                    dheader = {}
                    for key in ['to','from','subject','message-id']:
                        try:
                            default_charset = 'latin-1'
                            hval = ''.join([ unicode(t[0], t[1] or default_charset) for t in email.header.decode_header(message[key]) ])
                            dheader[key] = hval
                        except Exception as err:
                            try:
                                hval = u""
                                default_charset = 'latin-1'
                                hval = ''.join([ unicode(t[0], t[1] or default_charset) for t in email.header.decode_header(message[key]) ])
                                dheader[key] = hval
                            except Exception as err:
                                print("Could not decode headers, ignoring..")
                                okay = False
                    mdt = ""
                    if not 'date' in message and 'received' in message:
                        m = re.search(r"(\d+ \S+ \d{4} \d\d:\d\d:\d\d ([-+]\d{4})?)", message['received'])
                        if m:
                            mdt = m.group(1)
                    else:
                        mdt = message['date']
                    mdate = email.utils.parsedate_tz(mdt)
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
                    if body and okay and mdate:
                        if mid == None or not mid:
                            try:
                                mid = hashlib.sha256(body).hexdigest() + "@apache.org"
                            except:
                                if filebased:
                                    mid = hashlib.sha256("%f-%f-%s" % (random.random(), time.time(), filename) ).hexdigest()+ "@apache.org"
                                else:
                                    mid = hashlib.sha256("%f-%f-%s-%s" % (random.random(), time.time(), ml, mboxfile) ).hexdigest()+ "@apache.org"
                            print("No MID found, setting to %s" % mid)
                        mid2 = hashlib.sha224(mdatestring + mid).hexdigest() + "@" + (lid if lid else "none")
                        count += 1
                        mr = ""
                        if 'references' in message:
                            mr = message['references']
                        irt = ""
                        if 'in-reply-to' in message:
                            irt = message['in-reply-to']

                        json = {
                            'from_raw': dheader['from'],
                            'from': dheader['from'],
                            'to': dheader['to'],
                            'subject': dheader['subject'],
                            'message-id': mid,
                            'mid': mid2,
                            'epoch': email.utils.mktime_tz(mdate),
                            'list': lid,
                            'list_raw': lid,
                            'date': mdatestring,
                            'private': False,
                            'references': mr,
                            'in-reply-to': irt,
                            'body': body
                        }
                        ja.append(json)
                        if len(ja) >= 100:
                            bulk = BulkThread()
                            bulk.assign(ja, es)
                            bulk.insert()
                            ja = []
                else:
                    baddies += 1
            if filebased:
                print("Parsed %u records from %s" % (count, filename))
            else:
                print("Parsed %s/%s: %u records from %s" % (ml, mboxfile, count, tmpname))
                os.unlink(tmpname)
                
            y += count
            bulk = BulkThread()
            bulk.assign(ja, es)
            bulk.insert()
            ja = []

tlpname = "foo"
if len(sys.argv) == 2:
    tlpname = sys.argv[1]
elif len(sys.argv) >= 3:
    tlpname = sys.argv[1]
    quickmode = True if sys.argv[2] == "quick" else False
else:
    print("Usage: slurp.py tlpname")
    sys.exit(-1)



parser = argparse.ArgumentParser(description='Command line options.')
parser.add_argument('--source', dest='source', type=str, nargs=1,
                   help='Source to scan (either http(s):// or file path)')
parser.add_argument('--recursive', dest='recursive', action='store_true', 
                   help='Do a recursive scan (sub dirs etc)')
parser.add_argument('--interactive', dest='interactive', action='store_true',
                   help='Ask for help when possible')
parser.add_argument('--quick', dest='quick', action='store_true',
                   help='Only grab the first file you can find')
parser.add_argument('--mod-mbox', dest='modmbox', type=str, nargs=1,
                   help='This is mod_mbox, derive list-id and files from it')
parser.add_argument('--lid', dest='listid', type=str, nargs=1,
                   help='Optional List-ID to override source with.')
parser.add_argument('--project', dest='project', type=str, nargs=1,
                   help='Optional project to look for ($project-* will be imported as well)')
parser.add_argument('--ext', dest='ext', type=str, nargs=1,
                   help='Optional file extension (or call it with no args to not care)')

args = parser.parse_args()

if args.source:
    source = args.source[0]
if args.listid:
    list_override = args.listid[0]
if args.project:
    project = args.project[0]
if args.recursive:
    recursive = args.recursive
if args.interactive:
    interactive = args.interactive
if args.quick:
    quickmode = args.quick
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
    data = urllib.urlopen(source).read()
    print("Fetched %u bytes of main data, parsing month lists" % len(data))
    
    ns = r"<a href='(%s[-a-z0-9]+)/'" % project
    if project.find("-") != -1:
        ns = r"<a href='(%s)/'" % project
    
    if args.modmbox:
        for mlist in re.finditer(ns, data):
            ml = mlist.group(1)
            mldata = urllib.urlopen("%s%s/" % (source, ml)).read()
            present = re.search(r"<th colspan=\"3\">Year 20[\d]{2}</th>", mldata) # Check that year 2014-2017 exists, otherwise why keep it?
            if present:
                for mbox in re.finditer(r"(\d+\.mbox)/thread", mldata):
                    mboxfile = mbox.group(1)
                    lists.append([ml, mboxfile])
                    if quickmode:
                        break
    
threads = []
print("Starting up to 4 threads to fetch the %u %s lists" % (len(lists), project))
for i in range(1,5):
    t = SlurpThread()
    threads.append(t)
    t.start()
    print("Started no. %u" % i)

for t in threads:
    t.join()

print("All done! %u records inserted/updated after %u seconds. %u records were bad and ignored" % (y, int(time.time() - start), baddies))
