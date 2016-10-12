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

""" Publish notifications about mails to pony mail.

Copy this file to $mailman_plugin_dir/mailman_ponymail/__init__.py
Also copy ponymail.cfg to that dir.
Enable the module by adding the following to your mailman.cfg file::

[archiver.ponymail]
# The class implementing the IArchiver interface.
class: mailman_ponymail_plugin.Archiver
enable: yes

and by adding the following to ponymail.cfg:

[mailman]
plugin: true

OR, to use the STDIN version (non-MM3 mailing list managers),
sub someone to the list(s) and add this to their .forward file:
"|/usr/bin/env python3.4 /path/to/archiver.py"

"""

# Change this index name to whatever you picked!!
indexname = "ponymail_alpha"
logger = None

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
import fnmatch
import io

# Fetch config
path = os.path.dirname(os.path.realpath(__file__))
config = configparser.RawConfigParser()
config.read("%s/ponymail.cfg" % path)
auth = None
parseHTML = False
iBody = None

if config.has_section('mailman') and config.has_option('mailman', 'plugin'):
    from zope.interface import implementer
    from mailman.interfaces.archiver import IArchiver
    from mailman.interfaces.archiver import ArchivePolicy
    import logging
    logger = logging.getLogger("mailman.archiver")
elif __name__ == '__main__':
    import sys
    import argparse

if config.has_option('elasticsearch', 'user'):
    auth = (config.get('elasticsearch','user'), config.get('elasticsearch','password'))

def parse_attachment(part):
    cd = part.get("Content-Disposition", None)
    if cd:
        dispositions = cd.strip().split(";")
        if dispositions[0].lower() == "attachment":
            fd = part.get_payload(decode=True)
            if not fd: return None, None
            attachment = {}
            attachment['content_type'] = part.get_content_type()
            attachment['size'] = len(fd)
            attachment['filename'] = None
            h = hashlib.sha256(fd).hexdigest()
            b64 = codecs.encode(fd, "base64").decode('ascii', 'ignore')
            attachment['hash'] = h
            for param in dispositions[1:]:
                if not '=' in param: continue
                key,val = param.split("=", 1)
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
    if config.has_section('mailman') and config.has_option('mailman', 'plugin'):
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

    def __init__(self, parseHTML=False):
        """ Just initialize ES. """
        global config, auth
        ssl = False
        self.cropout = None
        self.html = parseHTML
        if parseHTML:
           import html2text
           self.html2text = html2text.html2text
        self.dbname = config.get("elasticsearch", "dbname")
        self.consistency = 'quorum'
        if config.has_option("elasticsearch", "ssl") and config.get("elasticsearch", "ssl").lower() == 'true':
            ssl = True
        if config.has_option("elasticsearch", "write") and config.get("elasticsearch", "write") != "":
            self.consistency = config.get('elasticsearch', 'write')
        if config.has_option("debug", "cropout") and config.get("debug", "cropout") != "":
            self.cropout = config.get("debug", "cropout")
        uri = ""
        if config.has_option("elasticsearch", "uri") and config.get("elasticsearch", "uri") != "":
            uri = config.get("elasticsearch", "uri")
        dbs = [
            {
                'host': config.get("elasticsearch", "hostname"),
                'port': int(config.get("elasticsearch", "port")),
                'use_ssl': ssl,
                'url_prefix': uri,
                'http_auth': auth
            }]
        # Backup ES?
        if config.has_option("elasticsearch", "backup") and config.get("elasticsearch", "backup") != "":
            backup = config.get("elasticsearch", "backup")
            dbs.append(
                {
                'host': config.get("elasticsearch", "backup"),
                'port': int(config.get("elasticsearch", "port")),
                'use_ssl': ssl,
                'url_prefix': uri,
                'http_auth': auth
            }
            )
        self.es = Elasticsearch(dbs,
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
        global iBody
        body = None
        firstHTML = None
        if msg.is_multipart():
            for part in msg.walk():
                try:
                    if part.is_multipart(): 
                        for subpart in part.walk():
                            if subpart.get_content_type() == 'text/plain' and not body:
                                body = subpart.get_payload(decode=True)
                            elif subpart.get_content_type() == 'text/html' and self.html and not firstHTML:
                                firstHTML = subpart.get_payload(decode=True)
            
                    elif part.get_content_type() == 'text/plain' and not body:
                        body = part.get_payload(decode=True)
                    elif part.get_content_type() == 'text/html' and self.html and not firstHTML:
                        firstHTML = part.get_payload(decode=True)
                except Exception as err:
                    print(err)
        elif msg.get_content_type() == 'text/plain':
            body = msg.get_payload(decode=True)
        elif msg.get_content_type() == 'text/html' and self.html and not firstHTML:
            firstHTML = msg.get_payload(decode=True)
            
        # this requires a GPL lib, user will have to install it themselves
        if firstHTML and (not body or len(body) <= 1 or (iBody and str(body).find(str(iBody)) != -1)):
            body = self.html2text(firstHTML.decode("utf-8", 'ignore') if type(firstHTML) is bytes else firstHTML)
    
        for charset in pm_charsets(msg):
            try:
                body = body.decode(charset) if type(body) is bytes else body
            except:
                body = body.decode('utf-8', errors='replace') if type(body) is bytes else body
                
        return body    

    def compute_updates(self, lid, private, msg):
        """Determine what needs to be sent to the archiver.

        :param lid: The list id
        :param msg: The message object.
        """

        ojson = None
        if not lid:
            lid= msg.get('list-id')
        if self.cropout:
            crops = self.cropout.split(" ")
            # Regex replace?
            if len(crops) == 2:
                lid = re.sub(crops[0], crops[1], lid)
            # Standard crop out?
            else:
                lid = lid.replace(self.cropout, "")
        
        format = lambda value: value and str(value) or ""
        msg_metadata = dict([(k, format(msg.get(k))) for k in self.keys])
        mid = hashlib.sha224(str("%s-%s" % (lid, msg_metadata['archived-at'])).encode('utf-8')).hexdigest() + "@" + (lid if lid else "none")
        for key in ['to','from','subject','message-id']:
            try:
                hval = ""
                if msg_metadata.get(key):
                    for t in email.header.decode_header(msg_metadata[key]):
                        if t[1] == None or t[1].find("8bit") != -1:
                            hval += t[0].decode('utf-8') if type(t[0]) is bytes else t[0]
                        else:
                            hval += t[0].decode(t[1],errors='ignore')
                    msg_metadata[key] = hval
            except Exception as err:
                print("Could not decode headers, ignoring..: %s" % err)
        if not msg_metadata.get('message-id'):
            msg_metadata['message-id'] = mid
        mdate = None
        uid_mdate = 0 # mdate for UID generation
        try:
            mdate = email.utils.parsedate_tz(msg_metadata.get('date'))
            uid_mdate = email.utils.mktime_tz(mdate) # Only set if Date header is valid
        except:
            pass
        if not mdate and msg_metadata.get('archived-at'):
            mdate = email.utils.parsedate_tz(msg_metadata.get('archived-at'))
        elif not mdate:
            print("Date seems totally wrong, setting to _now_ instead.")
            mdate = time.gmtime() # Get a standard 9-tuple
            mdate = mdate + (0, ) # Fake a TZ (10th element)
        mdatestring = time.strftime("%Y/%m/%d %H:%M:%S", time.gmtime(email.utils.mktime_tz(mdate)))
        body = self.msgbody(msg)
        try:
            if 'content-type' in msg_metadata and msg_metadata['content-type'].find("flowed") != -1:
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

        attachments, contents = self.msgfiles(msg)
        irt = ""
        if body or attachments:
            pmid = mid
            try:
                # Use full message as bytes for mid?
                if config.has_section('archiver') and config.has_option("archiver", "generator") and config.get("archiver", "generator") == "full":
                    mid = "%s@%s" % (hashlib.sha224(msg.as_bytes()).hexdigest(), lid)
                elif config.has_section('archiver') and config.has_option("archiver", "generator") and config.get("archiver", "generator") == "medium":
                    xbody = body if type(body) is bytes else body.encode('ascii', 'ignore')
                    xbody += bytes(lid, encoding='ascii')
                    xbody += bytes(mdatestring, encoding='ascii')
                    mid = "%s@%s" % (hashlib.sha224(xbody).hexdigest(), lid)
                else:
                    # Or revert to the old way?
                    mid = "%s@%s@%s" % (hashlib.sha224(body if type(body) is bytes else body.encode('ascii', 'ignore')).hexdigest(), uid_mdate, lid)
            except Exception as err:
                if logger:
                    logger.warn("Could not generate MID: %s" % err)
                mid = pmid
            if 'in-reply-to' in msg_metadata:
                try:
                    try:
                        irt = "".join(msg_metadata['in-reply-to'])
                    except:
                        irt = msg_metadata.get('in-reply-to').__str__()
                except:
                    irt = ""
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
                'in-reply-to': irt,
                'body': body.decode('utf-8', 'replace') if type(body) is bytes else body,
                'attachments': attachments
            }

        self.msg_metadata = msg_metadata
        self.irt = irt

        return  ojson, contents
            
    def archive_message(self, mlist, msg):
        """Send the message to the archiver.

        :param mlist: The IMailingList object.
        :param msg: The message object.
        """

        lid = None
        m = re.search(r"(<.+>)", mlist.list_id.replace("@", "."))
        if m:
            lid = m.group(1)
        else:
            lid = "<%s>" % mlist.list_id.strip("<>").replace("@", ".")

        private = False
        if hasattr(mlist, 'archive_public') and mlist.archive_public == True:
            private = False
        elif hasattr(mlist, 'archive_public') and mlist.archive_public == False:
            private = True
        elif hasattr(mlist, 'archive_policy') and mlist.archive_policy is not ArchivePolicy.public:
            private = True

        ojson, contents = self.compute_updates(lid, private, msg)

        msg_metadata = self.msg_metadata
        irt = self.irt

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
            id=ojson['mid'],
            consistency = self.consistency,
            body = ojson
        )
        
        self.es.index(
            index=self.dbname,
            doc_type="mbox_source",
            id=ojson['mid'],
            consistency = self.consistency,
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
                consistency = self.consistency,
                body = {
                    'list': lid,
                    'name': mlist.list_name,
                    'description': mlist.description,
                    'private': private
                }
            )
        
        if logger:
            logger.info("Pony Mail archived message %s successfully" % mid)
        oldrefs = []
        
        # Is this a direct reply to a pony mail email?
        if irt != "":
            dm = re.search(r"pony-([a-f0-9]+)-([a-f0-9]+)@", irt)
            if dm:
                cid = dm.group(1)
                mid = dm.group(2)
                if self.es.exists(index = self.dbname, doc_type = 'account', id = cid):
                    doc = self.es.get(index = self.dbname, doc_type = 'account', id = cid)
                    if doc:
                        oldrefs.append(cid)
                        self.es.index(
                            index=self.dbname,
                            doc_type="notifications",
                            consistency = self.consistency,
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
                                'in-reply-to': irt,
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
                            consistency = self.consistency,
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
                                'in-reply-to': mirt,
                                'epoch': email.utils.mktime_tz(mdate),
                                'mid': mid,
                                'seen': 0
                            }
                        )
                        if logger:
                            logger.info("Notification sent to %s for %s" % (cid, mid))
        return lid, ojson['mid']
            
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
    parser.add_argument('--lid', dest='lid', type=str, nargs=1,
                       help='Alternate specific list ID')
    parser.add_argument('--altheader', dest='altheader', type=str, nargs=1,
                       help='Alternate header for list ID')
    parser.add_argument('--allowfrom', dest='allowfrom', type=str, nargs=1,
                       help='(optional) source IP (mail server) to allow posts from, ignore if no match')
    parser.add_argument('--ignore', dest='ignorefrom', type=str, nargs=1,
                       help='Sender/list to ignore input from (owner etc)')
    parser.add_argument('--private', dest='private', action='store_true', 
                       help='This is a private archive')
    parser.add_argument('--makedate', dest='makedate', action='store_true', 
                       help='Use the archive timestamp as the email date instead of the Date header')
    parser.add_argument('--quiet', dest='quiet', action='store_true', 
                       help='Do not exit -1 if the email could not be parsed')
    parser.add_argument('--verbose', dest='verbose', action='store_true', 
                       help='Output additional log messages')
    parser.add_argument('--html2text', dest='html2text', action='store_true', 
                       help='Try to convert HTML to text if no text/plain message is found')
    args = parser.parse_args()
    
    if args.html2text:
        parseHTML = True

    if args.verbose:
        import logging
        logging.basicConfig(stream=sys.stdout, level=logging.INFO)
        
    foo = Archiver(parseHTML = parseHTML)
    input_stream = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors="ignore")
    
    try:
        msgstring = input_stream.read()
        try:
            msg = email.message_from_string(msgstring)
        except Exception as err:
            print("STDIN parser exception: %s" % err)
        
        # We're reading from STDIN, so let's fake an MM3 call
        ispublic = True
        ignorefrom = None
        allowfrom = None
            
        if args.altheader:
            altheader = args.altheader[0]
            if altheader in msg:
                try:
                    msg.replace_header('List-ID', msg.get(altheader))
                except:
                    msg.add_header('list-id', msg.get(altheader))
        elif 'altheader' in sys.argv:
            altheader = sys.argv[len(sys.argv)-1]
            if altheader in msg:
                try:
                    msg.replace_header('List-ID', msg.get(altheader))
                except:
                    msg.add_header('list-id', msg.get(altheader))

        # Set specific LID?
        if args.lid and len(args.lid[0]) > 3:
            try:
                msg.replace_header('List-ID', args.lid[0])
            except:
                msg.add_header('list-id', args.lid[0])
                
                
        #Ignore based on --ignore flag?
        if args.ignorefrom:
            ignorefrom = args.ignorefrom[0]
            if fnmatch.fnmatch(msg.get("from"), ignorefrom) or (msg.get("list-id") and fnmatch.fnmatch(msg.get("list-id"), ignorefrom)):
                print("Ignoring message as instructed by --ignore flag")
                sys.exit(0)
        
        # Check CIDR if need be
        if args.allowfrom:
            from netaddr import IPNetwork, IPAddress
            c = IPNetwork(args.allowfrom[0])
            good = False
            for line in msg.get_all('received') or []:
                m = re.search(r"from .+\[(.+)\]", line)
                if m:
                    try:
                        ip = IPAddress(m.group(1))
                        if ip in c:
                            good = True
                            msg.add_header("ip-whitelisted", "yes")
                            break
                    except:
                        pass
            if not good:
                print("No whitelisted IP found in message, aborting")
                sys.exit(-1)
        # Replace date header with $now?
        if args.makedate:
            msg.replace_header('date', email.utils.formatdate())
            
        if args.private:
            ispublic = False
        if 'list-id' in msg:
            if not msg.get('archived-at'):
                msg.add_header('archived-at', email.utils.formatdate())
            msg_metadata = namedtuple('importmsg', ['list_id', 'archive_public'])(list_id = msg.get('list-id'), archive_public=ispublic)
            
            try:
                lid, mid = foo.archive_message(msg_metadata, msg)
                print("%s: Done archiving to %s as %s!" % (email.utils.formatdate(), lid, mid))
            except Exception as err:
                if args.verbose:
                    import traceback
                    traceback.print_exc()
                print("Archiving failed!: %s" % err)
                raise Exception("Archiving to ES failed")
        else:
            print("Nothing to import (no list-id found!)")
    except Exception as err:
        if args.quiet:
            print("Could not parse email, but exiting quietly as --quiet is on: %s" % err)
        else:
            print("Could not parse email: %s" % err)
            sys.exit(-1)
            
