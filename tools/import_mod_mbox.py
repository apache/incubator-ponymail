#!/usr/bin/env python
# -*- coding: utf-8 -*-
import mailbox
import email.errors, email.utils, email.header
import urllib
import re
from elasticsearch import Elasticsearch, helpers
import sys
import random, time
import hashlib
import os
from threading import Thread, Lock
from formatflowed import convertToWrapped
import chardet
import datetime
import ConfigParser as configparser

y = 0
baddies = 0
block = Lock()
lists = []
start = time.time()
quickmode = False


# Fetch config
config = configparser.RawConfigParser()
config.read(path + '/ponymail.cfg')


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
            ml = mla[0]
            mboxfile = mla[1]
            print("Slurping %s/%s" % (ml, mboxfile))
            m = re.match(r"(\d\d\d\d)(\d\d)", mboxfile)
            EY = 1997
            EM = 1
            if m:
                EY = int(m.group(1))
                EM = int(m.group(2))
            inp = urllib.urlopen("%s%s/%s" % (rootURL, ml, mboxfile )).read()

            tmpname = hashlib.sha224("%f-%f-%s-%s" % (random.random(), time.time(), ml, mboxfile) ).hexdigest()
            with open("%s.mbox" % tmpname, "w") as f:
                f.write(inp)
                f.close()

            count = 0
            for message in mailbox.mbox("%s.mbox" % tmpname, factory=msgfactory):
                if 'subject' in message:
                    subject = message['subject']       # Could possibly be None.
                    mid = message['message-id']

                    lid = message['list-id']
                    if not lid or lid == "" or lid.find("incubator") != -1: # Guess list name in absence
                        lid = '.'.join(reversed(ml.split("-"))) + ".apache.org"
                        #print("No LID specified, trying %s" % lid)
                        
                    # Compact LID to <foo@domain>, discard rest
                    m = re.search(r"(<.+>)", lid)
                    if m:
                        lid = m.group(1)
                        
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
                    mdate = email.utils.parsedate_tz(message['date'])
                    if not mdate or mdate[0] < EY:
                        print("Date is wrong or missing here, setting to %s" % EY)
                        mdate = datetime.datetime(EY, EM, 1).timetuple()
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
            print("Parsed %s/%s: %u records from %s" % (ml, mboxfile, count, tmpname))
            os.unlink("%s.mbox" % tmpname)
            y += count
            bulk = BulkThread()
            bulk.assign(ja, es)
            bulk.insert()
            ja = []

tlpname = "foo"
if len(sys.argv) == 2:
    tlpname = sys.argv[1]
elif len(sys.argv) == 3:
    tlpname = sys.argv[1]
    quickmode = True if sys.argv[2] == "quick" else False
else:
    print("Usage: slurp.py tlpname")
    sys.exit(-1)


data = urllib.urlopen(rootURL).read()
print("Fetched %u bytes of main data, parsing month lists" % len(data))

ns = r"<a href='(%s[-a-z0-9]+)/'" % tlpname
if tlpname.find("-") != -1:
    ns = r"<a href='(%s)/'" % tlpname

baddies = 0
for mlist in re.finditer(ns, data):
    ml = mlist.group(1)
    mldata = urllib.urlopen("%s%s/" % (rootURL, ml)).read()
    present = re.search(r"<th colspan=\"3\">Year 20[\d]{2}</th>", mldata) # Check that year 2014-2017 exists, otherwise why keep it?
    if present:
        for mbox in re.finditer(r"(\d+\.mbox)/thread", mldata):
            mboxfile = mbox.group(1)
            lists.append([ml, mboxfile])
            if quickmode:
                break

threads = []
print("Starting up to 6 threads to fetch the %u %s lists" % (len(lists), tlpname))
for i in range(1,7):
    t = SlurpThread()
    threads.append(t)
    t.start()
    print("Started no. %u" % i)

for t in threads:
    t.join()

print("All done! %u records inserted/updated after %u seconds. %u records were bad and ignored" % (y, int(time.time() - start), baddies))
