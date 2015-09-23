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
Enable the module by adding the following to your mailman.cfg file::

[archiver.ponymail]
# The class implementing the IArchiver interface.
class: mailman_ponymail_plugin.Archiver
enable: yes

OR, to use the STDIN version (non-MM3 mailing list managers),
sub someone to the list(s) and add this to their .forward file:
"|/usr/bin/env python3.4 /path/to/plugin.py"

"""

# Change this index name to whatever you picked!!
indexname = "ponymail_alpha"
if __name__ != '__main__':
    from zope.interface import implementer
    from mailman.interfaces.archiver import IArchiver
    from mailman.interfaces.archiver import ArchivePolicy
else:
    import sys

from elasticsearch import Elasticsearch
import hashlib
import email.utils
import datetime, time
import json
from collections import namedtuple
import re
import base64


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
            b64 = str(base64.urlsafe_b64encode(fd))
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
        self.es = Elasticsearch([
            {
                'host': 'localhost',
                'port': 9200,
                'use_ssl': False,
                'url_prefix': ''
            }],
            max_retries=5,
            retry_on_timeout=True
            )

    def msgfiles(self, msg):
        attachments = []
        contents = {}
        if msg.is_multipart():    
            for part in msg.walk():
                if part.is_multipart(): 
                    for subpart in part.walk():
                        part_meta, part_file = parse_attachment(subpart)
                        if part_meta:
                            attachments.append(part_meta)
                            contents[part_meta['hash']] = part_file
                else:
                    part_meta, part_file = parse_attachment(subpart)
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
                        part_meta, part_file = parse_attachment(subpart)
                        if subpart.get_content_type() == 'text/plain':
                                body = subpart.get_payload(decode=True) 
        
                elif part.get_content_type() == 'text/plain':
                    body = part.get_payload(decode=True)
        
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
        format = lambda value: value and str(value) or ""
        msg_metadata = dict([(k, format(msg.get(k))) for k in self.keys])
        lst_metadata = dict(list_name=mlist.list_id)
        

        mid = hashlib.sha224(str("%s-%s" % (mlist.list_id, msg_metadata['archived-at'])).encode('utf-8')).hexdigest() + "@" + (mlist.list_id if mlist.list_id else "none")
        if not msg_metadata.get('message-id'):
            msg_metadata['message-id'] = mid
        mdate = email.utils.parsedate_tz(msg_metadata.get('date'))
        if not mdate:
            mdate = email.utils.parsedate_tz(msg_metadata.get('archived-at'))
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
            if 'archive_public' in mlist:
                private = False
            elif 'archive_policy' in mlist and mlist.archive_policy is not ArchivePolicy.public:
                private = True
            pmid = mid
            try:
                mid = "%s@%s@%s" % (hashlib.sha224(body.encode('ascii', 'ignore')).hexdigest(), email.utils.mktime_tz(mdate), mlist.list_id)
            except:
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
                'body': body.decode('utf-8') if type(body) is bytes else body,
                'attachments': attachments
            }
            
            if contents:
                for key in contents:
                    self.es.index(
                        index=indexname,
                        doc_type="attachment",
                        id=key,
                        body = {
                            'source': contents[key]
                        }
                    )
        
            self.es.index(
                index=indexname,
                doc_type="mbox",
                id=mid,
                body = ojson
            )
            
            self.es.index(
                index=indexname,
                doc_type="mbox_source",
                id=mid,
                body = {
                    "source": msg.as_string()
                }
            )
            
            # Is this a direct reply to a pony mail email?
            if 'in-reply-to' in msg_metadata:
                dm = re.search(r"pony-([a-f0-9]+)-([a-f0-9]+)@", msg_metadata.get('in-reply-to'))
                if dm:
                    cid = dm.group(1)
                    mid = dm.group(2)
                    doc = self.es.get(index = indexname, doc_type = 'account', id = cid)
                    if doc:
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
            #im = re.search(r"pony-([a-f0-9]+)-([a-f0-9]+)@", msg_metadata.get('references'))
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
    foo = Archiver()
    msg = email.message_from_file(sys.stdin)
    # We're reading from STDIN, so let's fake an MM3 call
    if 'altheader' in sys.argv:
        altheader = sys.argv[len(sys.argv)-1]
        if altheader in msg:
            msg.add_header('list-id', msg.get(altheader))
    if 'list-id' in msg:
        if not msg.get('archived-at'):
            msg.add_header('archived-at', email.utils.formatdate())
        msg_metadata = namedtuple('importmsg', ['list_id', 'archive_public'])(list_id = msg.get('list-id'), archive_public=True)
        
        lid = foo.archive_message(msg_metadata, msg)
        print("Done archiving to %s!" % lid)
    else:
        print("Nothing to import (no list-id found!)")
        
    