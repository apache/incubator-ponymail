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
class: mailman3_ponymail_plugin.Archiver
enable: yes

OR, to use the STDIN version (non-MM3 mailing list managers),
sub someone to the list(s) and add this to their .forward file:
"|/usr/bin/python /path/to/plugin.py"

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

    def msgbody(self, msg):
        body = None
        if msg.is_multipart():    
            for part in msg.walk():
    
                if part.is_multipart(): 
    
                    for subpart in part.walk():
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

        format = lambda value: value and str(value) or ""
        msg_metadata = dict([(k, format(msg.get(k))) for k in self.keys])
        lst_metadata = dict(list_name=mlist.list_id)
        lid = "<%s>" % mlist.list_id.strip("<>")
        
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
            private = False
            if mlist.archive_policy is not ArchivePolicy.public:
                private = True
            pmid = mid
            try:
                mid = "%s@%s@%s" % (hashlib.sha224(body.encode('utf-8')).hexdigest(), email.utils.mktime_tz(mdate), mlist.list_id)
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
                'body': body.encode('utf-8')
            }
        
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
                                'date': msg_metadata['date'],
                                'from': msg_metadata['from'],
                                'to': msg_metadata['to'],
                                'subject': msg_metadata['subject'],
                                'message-id': msg_metadata['message-id'],
                                'mid': mid,
                                'seen': 0
                            }
                        )
            #im = re.search(r"pony-([a-f0-9]+)-([a-f0-9]+)@", msg_metadata.get('references'))
    
            
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
    ip = sys.stdin.read()
    msg = email.message_from_string(ip)
    # We're reading from STDIN, so let's fake an MM3 call
    if 'list-id' in msg:
        if not msg.get('archived-at'):
            msg.add_header('archived-at', email.utils.formatdate())
        msg_metadata = namedtuple('importmsg', ['list_name', 'archive_private'])(list_name = msg.get('list-id'), archive_private=False)
        
        foo.archive_message(msg_metadata, msg)
        print("Done archiving!")
    else:
        print("Nothing to import (no list-id found!)")
        
    