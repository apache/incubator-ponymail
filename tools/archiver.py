#!/usr/bin/env python3.4
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

""" Publish notifications about mails to pony mail.

Copy this file to $mailman_plugin_dir/mailman_ponymail/__init__.py
Also copy ponymail.cfg to that dir.
Enable the module by adding the following to your mailman.cfg file::

[archiver.ponymail]
# The class implementing the IArchiver interface.
class: mailman_ponymail_plugin.Archiver
enable: yes

OR, to use the STDIN version (non-MM3 mailing list managers),
sub someone to the list(s) and add this to their .forward file:
"|/usr/bin/env python3.4 /path/to/archiver.py"

"""

# Change this index name to whatever you picked!!
indexname = "ponymail_alpha"
logger = None
if __name__ != '__main__':
    from zope.interface import implementer
    from mailman.interfaces.archiver import IArchiver
    from mailman.interfaces.archiver import ArchivePolicy
    import logging
    logger = logging.getLogger("mailman.archiver")
else:
    import sys
    import argparse

from elasticsearch import Elasticsearch
import hashlib
import email.utils
import datetime, time
import json
from collections import namedtuple
import re
import codecs
import configparser
import os

# Fetch config
path = os.path.dirname(os.path.realpath(__file__))
config = configparser.RawConfigParser()
config.read("%s/ponymail.cfg" % path)

def parse_attachment(part):
    cd = part.get("Content-Disposition", None)
    if cd:
        dispositions = cd.strip().split(";")
        if dispositions[0].lower() == "attachment":
            fd = part.get_payload(decode=True)
            attachment = {}
            attachment['content_type'] = part.get_content_type()
            attachment['size'] = len(fd)
            attachment['filename'] = None
            h = hashlib.sha256(fd).hexdigest()
            b64 = codecs.encode(fd, "base64").decode('ascii')
            attachment['hash'] = h
            for param in dispositions[1:]:
                key,val = param.split("=")
                if key.lower().strip() == "filename":
                    val = val.strip(' "')
                    print("Found attachment: %s" % val)
                    attachment['filename'] = val
            if attachment['filename']:
                return attachment, b64 # Return meta data and contents separately
    return None, None

def pm_charsets(msg):
    charsets = set({})
    for c in msg.get_charsets():
        if c is not None:
            charsets.update([c])
    return charsets

class Archiver(object):
    """ A mailman 3 archiver that forwards messages to pony mail. """
    if __name__ != '__main__':
        implementer(IArchiver)
    name = "ponymail"

    # This is a list of the headers we're interested in publishing.
    keys = [
        "archived-at",
        "delivered-to",
        "from",
        "cc",
        "to",
        "date",
        "in-reply-to",
        "message-id",
        "subject",
        "x-message-id-hash",
        "references",
        "x-mailman-rule-hits",
        "x-mailman-rule-misses",
    ]

    def __init__(self):
        """ Just initialize ES. """
        global config
        ssl = False
        self.cropout = None
        self.dbname = config.get("elasticsearch", "dbname")
        if config.has_option("elasticsearch", "ssl") and config.get("elasticsearch", "ssl").lower() == 'true':
            ssl = True
        if config.has_option("debug", "cropout") and config.get("debug", "cropout") != "":
            self.cropout = config.get("debug", "cropout")
        uri = ""
        if config.has_option("elasticsearch", "uri") and config.get("elasticsearch", "uri") != "":
            uri = config.get("elasticsearch", "uri")
        self.es = Elasticsearch([
            {
                'host': config.get("elasticsearch", "hostname"),
                'port': int(config.get("elasticsearch", "port")),
                'use_ssl': ssl,
                'url_prefix': uri
            }],
            max_retries=5,
            retry_on_timeout=True
            )

    def msgfiles(self, msg):
        attachments = []
        contents = {}
        if msg.is_multipart():    
            for part in msg.walk():
                part_meta, part_file = parse_attachment(part)
                if part_meta:
                    attachments.append(part_meta)
                    contents[part_meta['hash']] = part_file
        return attachments, contents
    
    
    def msgbody(self, msg):
        body = None
        if msg.is_multipart():    
            for part in msg.walk():
                if part.is_multipart(): 
                    for subpart in part.walk():
                        if subpart.get_content_type() == 'text/plain':
                                body = subpart.get_payload(decode=True)
                                break
        
                elif part.get_content_type() == 'text/plain':
                    body = part.get_payload(decode=True)
                    break
        
        elif msg.get_content_type() == 'text/plain':
            body = msg.get_payload(decode=True) 
    
        for charset in pm_charsets(msg):
            try:
                body = body.decode(charset)
            except:
                body = None
                
        return body   

    def archive_message(self, mlist, msg):
        """Send the message to the archiver.

        :param mlist: The IMailingList object.
        :param msg: The message object.
        """

        lid = "<%s>" % mlist.list_id.strip("<>").replace("@", ".")
        if self.cropout:
            lid = lid.replace(self.cropout, "")
        format = lambda value: value and str(value) or ""
        msg_metadata = dict([(k, format(msg.get(k))) for k in self.keys])
        mid = hashlib.sha224(str("%s-%s" % (lid, msg_metadata['archived-at'])).encode('utf-8')).hexdigest() + "@" + (lid if lid else "none")
        for key in ['to','from','subject','message-id']:
            try:
                hval = ""
                if msg_metadata.get(key):
                    for t in email.header.decode_header(msg_metadata[key]):
                        if t[1] == None:
                            hval += t[0].decode('utf-8') if type(t[0]) is bytes else t[0]
                        else:
                            hval += t[0].decode(t[1],errors='ignore')
                    msg_metadata[key] = hval
            except Exception as err:
                print("Could not decode headers, ignoring..: %s" % err)
        if not msg_metadata.get('message-id'):
            msg_metadata['message-id'] = mid
        mdate = None
        try:
            mdate = email.utils.parsedate_tz(msg_metadata.get('date'))
        except:
            pass
        if not mdate and msg_metadata.get('archived-at'):
            mdate = email.utils.parsedate_tz(msg_metadata.get('archived-at'))
        elif not mdate:
            print("Date seems totally wrong, setting to _now_ instead.")
            mdate = time.gmtime()
        mdatestring = time.strftime("%Y/%m/%d %H:%M:%S", time.localtime(email.utils.mktime_tz(mdate)))
        body = self.msgbody(msg)
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
        if body:
            attachments, contents = self.msgfiles(msg)
            private = False
            if hasattr(mlist, 'archive_public') and mlist.archive_public:
                private = False
            elif hasattr(mlist, 'archive_policy') and mlist.archive_policy is not ArchivePolicy.public:
                private = True
            pmid = mid
            try:
                mid = "%s@%s@%s" % (hashlib.sha224(body if type(body) is bytes else body.encode('ascii', errors='ignore')).hexdigest(), email.utils.mktime_tz(mdate), lid)
            except Exception as err:
                if logger:
                    logger.warn("Could not generate MID: %s" % err)
                mid = pmid
            ojson = {
                'from_raw': msg_metadata['from'],
                'from': msg_metadata['from'],
                'to': msg_metadata['to'],
                'subject': msg_metadata['subject'],
                'message-id': msg_metadata['message-id'],
                'mid': mid,
                'cc': msg_metadata.get('cc'),
                'epoch': email.utils.mktime_tz(mdate),
                'list': lid,
                'list_raw': lid,
                'date': mdatestring,
                'private': private,
                'references': msg_metadata['references'],
                'in-reply-to': msg_metadata['in-reply-to'],
                'body': body.decode('utf-8', errors='replace') if type(body) is bytes else body,
                'attachments': attachments
            }
            
            if contents:
                for key in contents:
                    self.es.index(
                        index=self.dbname,
                        doc_type="attachment",
                        id=key,
                        body = {
                            'source': contents[key]
                        }
                    )
        
            self.es.index(
                index=self.dbname,
                doc_type="mbox",
                id=mid,
                body = ojson
            )
            
            self.es.index(
                index=self.dbname,
                doc_type="mbox_source",
                id=mid,
                body = {
                    "message-id": msg_metadata['message-id'],
                    "source": msg.as_string()
                }
            )
            
            # If MailMan and list info is present, save/update it in ES:
            if hasattr(mlist, 'description') and hasattr(mlist, 'list_name') and mlist.description and mlist.list_name:
                self.es.index(
                    index=self.dbname,
                    doc_type="mailinglists",
                    id=lid,
                    body = {
                        'list': lid,
                        'name': mlist.list_name,
                        'description': mlist.description
                    }
                )
            
            if logger:
                logger.info("Pony Mail archived message %s successfully" % mid)
            oldrefs = []
            
            # Is this a direct reply to a pony mail email?
            if 'in-reply-to' in msg_metadata:
                dm = re.search(r"pony-([a-f0-9]+)-([a-f0-9]+)@", msg_metadata.get('in-reply-to'))
                if dm:
                    cid = dm.group(1)
                    mid = dm.group(2)
                    if self.es.exists(index = self.dbname, doc_type = 'account', id = cid):
                        doc = self.es.get(index = self.dbname, doc_type = 'account', id = cid)
                        if doc:
                            oldrefs.append(cid)
                            self.es.index(
                                index=indexname,
                                doc_type="notifications",
                                body = {
                                    'type': 'direct',
                                    'recipient': cid,
                                    'list': lid,
                                    'private': private,
                                    'date': msg_metadata['date'],
                                    'from': msg_metadata['from'],
                                    'to': msg_metadata['to'],
                                    'subject': msg_metadata['subject'],
                                    'message-id': msg_metadata['message-id'],
                                    'in-reply-to': msg_metadata['in-reply-to'],
                                    'epoch': email.utils.mktime_tz(mdate),
                                    'mid': mid,
                                    'seen': 0
                                }
                            )
                            if logger:
                                logger.info("Notification sent to %s for %s" % (cid, mid))

            # Are there indirect replies to pony emails?
            if msg_metadata.get('references'):
                for im in re.finditer(r"pony-([a-f0-9]+)-([a-f0-9]+)@", msg_metadata.get('references')):
                    cid = im.group(1)
                    mid = im.group(2)
                    if self.es.exists(index = self.dbname, doc_type = 'account', id = cid):
                        doc = self.es.get(index = self.dbname, doc_type = 'account', id = cid)
                        
                        # does the user want to be notified of indirect replies?
                        if doc and 'preferences' in doc['_source'] and doc['_source']['preferences'].get('notifications') == 'indirect' and not cid in oldrefs:
                            oldrefs.append(cid)
                            self.es.index(
                                index=self.dbname,
                                doc_type="notifications",
                                body = {
                                    'type': 'indirect',
                                    'recipient': cid,
                                    'list': lid,
                                    'private': private,
                                    'date': msg_metadata['date'],
                                    'from': msg_metadata['from'],
                                    'to': msg_metadata['to'],
                                    'subject': msg_metadata['subject'],
                                    'message-id': msg_metadata['message-id'],
                                    'in-reply-to': msg_metadata['in-reply-to'],
                                    'epoch': email.utils.mktime_tz(mdate),
                                    'mid': mid,
                                    'seen': 0
                                }
                            )
                            if logger:
                                logger.info("Notification sent to %s for %s" % (cid, mid))
        return lid
            
    def list_url(self, mlist):
        """ Gots
            to
            be
            here
        """
        return None

    def permalink(self, mlist, msg):
        """ Gots
            to
            be
            here
        """
        return None
    
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Command line options.')
    parser.add_argument('--altheader', dest='altheader', type=str, nargs=1,
                       help='Alternate header for list ID')
    parser.add_argument('--private', dest='private', action='store_true', 
                       help='This is a private archive')
    args = parser.parse_args()
    
    foo = Archiver()
    msg = email.message_from_file(sys.stdin)
    # We're reading from STDIN, so let's fake an MM3 call
    ispublic = True
    if args.altheader:
        altheader = args.altheader[0]
        if altheader in msg:
            msg.add_header('list-id', msg.get(altheader))
    elif 'altheader' in sys.argv:
        altheader = sys.argv[len(sys.argv)-1]
        if altheader in msg:
            msg.add_header('list-id', msg.get(altheader))
    if args.private == True:
        ispublic = False
    if 'list-id' in msg:
        if not msg.get('archived-at'):
            msg.add_header('archived-at', email.utils.formatdate())
        msg_metadata = namedtuple('importmsg', ['list_id', 'archive_public'])(list_id = msg.get('list-id'), archive_public=ispublic)
        
        lid = foo.archive_message(msg_metadata, msg)
        print("Done archiving to %s!" % lid)
    else:
        print("Nothing to import (no list-id found!)")
        
    