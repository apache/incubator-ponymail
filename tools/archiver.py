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
"|/usr/bin/env python3 /path/to/archiver.py"

"""

logger = None

from elasticsearch import Elasticsearch
from elasticsearch import VERSION as ES_VERSION
ES_MAJOR = ES_VERSION[0]
from formatflowed import convertToWrapped
import hashlib
import email.utils
import time
from collections import namedtuple
import re
from base64 import standard_b64encode
import chardet
from ponymailconfig import PonymailConfig
import os
import fnmatch
import logging
import traceback
import sys
import generators
import uuid
import json
import certifi

# Fetch config
config = PonymailConfig()
auth = None
parseHTML = False
iBody = None  # N.B. Also used by import-mbox.py
args=None
dumpDir = None

if config.has_section('mailman') and config.has_option('mailman', 'plugin'):
    from zope.interface import implementer
    from mailman.interfaces.archiver import IArchiver
    from mailman.interfaces.archiver import ArchivePolicy
    logger = logging.getLogger("mailman.archiver")
elif __name__ == '__main__':
    import argparse

if config.has_option('elasticsearch', 'user'):
    auth = (config.get('elasticsearch','user'), config.get('elasticsearch','password'))

archiver_generator = config.get("archiver", "generator", fallback="medium")

def encode_base64(buff):
    """ Convert bytes to base64 as text string (no newlines) """
    return standard_b64encode(buff).decode('ascii', 'ignore')

def parse_attachment(part):
    cd = part.get("Content-Disposition", None)
    if cd:
        # Use str() in case the name is not in ASCII.
        # In such cases, the get() method returns a Header not a string
        dispositions = str(cd).strip().split(";")
        if dispositions[0].lower() == "attachment":
            fd = part.get_payload(decode=True)
            # Allow for empty string
            if fd == None: return None, None
            filename = part.get_filename()
            if filename:
                print("Found attachment: %s" % filename)
                attachment = {}
                attachment['content_type'] = part.get_content_type()
                attachment['size'] = len(fd)
                attachment['filename'] = filename
                h = hashlib.sha256(fd).hexdigest()
                b64 = encode_base64(fd)
                attachment['hash'] = h
                return attachment, b64 # Return meta data and contents separately
    return None, None

def pm_charsets(msg):
    charsets = set({})
    for c in msg.get_charsets():
        if c is not None:
            charsets.update([c])
    return charsets

def normalize_lid(lid): # N.B. Also used by import-mbox.py
    """ Ensure that a lid is in standard form, i.e. <a.b.c.d> """
    # first drop any leading or trailing chars
    m = re.search(r"<(.+)>", lid)
    if m:
        lid = m.group(1)
    # Belt-and-braces: remove possible extraneous chars
    lid = "<%s>" % lid.strip(" <>").replace("@", ".")
    if not re.match(r"^<.+\..+>$", lid):
        print("Invalid list-id %s" % lid)
        sys.exit(-1)
    return lid

class Archiver(object): # N.B. Also used by import-mbox.py
    """ A mailman 3 archiver that forwards messages to pony mail. """
    if config.has_section('mailman') and config.has_option('mailman', 'plugin'):
        implementer(IArchiver)

    # This is a list of headers which are stored in msg_metadata
    keys = [
        "archived-at",
        "delivered-to",
        "from",
        "cc",
        "content-type",
        "to",
        "date",
        "in-reply-to",
        "message-id",
        "subject",
        "references",
        # The following don't appear to be needed currently
        "x-message-id-hash",
        "x-mailman-rule-hits",
        "x-mailman-rule-misses",
    ]

    """ Intercept index calls and fix up consistency argument """
    def index(self, **kwargs):
        if ES_MAJOR in [5,6]:
            if kwargs.pop('consistency', None): # drop the key if present
                if self.wait_for_active_shards: # replace with wait if defined
                    kwargs['wait_for_active_shards'] = self.wait_for_active_shards
        return self.es.index(
            **kwargs
        )

    def __init__(self, parseHTML=False):
        """ Just initialize ES. """
        self.html = parseHTML
        if parseHTML:
            import html2text
            self.html2text = html2text.html2text
        self.dbname = config.get("elasticsearch", "dbname")
        ssl = config.get("elasticsearch", "ssl", fallback="false").lower() == 'true'
        # Always allow this to be set; will be replaced as necessary by wait_for_active_shards
        self.consistency = config.get('elasticsearch', 'write', fallback='quorum')
        if ES_MAJOR == 2:
            pass
        elif ES_MAJOR in [5,6]:
            self.wait_for_active_shards = config.get('elasticsearch', 'wait', fallback=1)
        else:
            raise Exception("Unexpected elasticsearch version ", ES_VERSION)
        self.cropout = config.get("debug", "cropout", fallback=None)
        uri = config.get("elasticsearch", "uri", fallback="")
        dbs = [
            {
                'host': config.get("elasticsearch", "hostname"),
                'port': int(config.get("elasticsearch", "port")),
                'use_ssl': ssl,
                'url_prefix': uri,
                'http_auth': auth,
                'ca_certs': certifi.where()
            }]
        # Backup ES?
        backup = config.get("elasticsearch", "backup", fallback="")
        if backup != "":
            dbs.append(
                {
                'host': backup,
                'port': int(config.get("elasticsearch", "port")),
                'use_ssl': ssl,
                'url_prefix': uri,
                'http_auth': auth,
                'ca_certs': certifi.where()
            }
            )
        # If we have a dump dir, we can risk failing the connection.
        if dumpDir:
            try:
                self.es = Elasticsearch(dbs,
                    max_retries=5,
                    retry_on_timeout=True
                    )
            except:
                print("ES connection failed, but dumponfail specified, dumping to %s" % dumpDir)
        else:
            self.es = Elasticsearch(dbs,
                max_retries=5,
                retry_on_timeout=True
                )

    def msgfiles(self, msg):
        attachments = []
        contents = {}
        for part in msg.walk():
            part_meta, part_file = parse_attachment(part)
            if part_meta:
                attachments.append(part_meta)
                contents[part_meta['hash']] = part_file
        return attachments, contents


    def msgbody(self, msg):
        body = None
        firstHTML = None
        for part in msg.walk():
            # can be called from importer
            if args and args.verbose:
                print("Content-Type: %s" % part.get_content_type())
            """
                Find the first body part and the first HTML part
                Note: cannot use break here because firstHTML is needed if len(body) <= 1
            """
            try:
                if not body and part.get_content_type() == 'text/plain':
                    body = part.get_payload(decode=True)
                if not body and part.get_content_type() == 'text/enriched':
                    body = part.get_payload(decode=True)
                elif self.html and not firstHTML and part.get_content_type() == 'text/html':
                    firstHTML = part.get_payload(decode=True)
            except Exception as err:
                print(err)

        # this requires a GPL lib, user will have to install it themselves
        if firstHTML and (not body or len(body) <= 1 or (iBody and str(body).find(str(iBody)) != -1)):
            body = self.html2text(firstHTML.decode("utf-8", 'ignore') if type(firstHTML) is bytes else firstHTML)

        # See issue#463
        # This code will try at most one charset
        # If the decode fails, it will use utf-8
        for charset in pm_charsets(msg):
            try:
                body = body.decode(charset) if type(body) is bytes else body
                # at this point body can no longer be bytes
            except:
                body = body.decode('utf-8', errors='replace') if type(body) is bytes else body
                # at this point body can no longer be bytes

        return body

    # N.B. this is also called by import-mbox.py
    def compute_updates(self, lid, private, msg):
        """Determine what needs to be sent to the archiver.

        :param lid: The list id
        :param msg: The message object.

        :return None if the message could not be parsed
        """

        ojson = None
        if not lid:
            lid = normalize_lid(msg.get('list-id'))
        if self.cropout:
            crops = self.cropout.split(" ")
            # Regex replace?
            if len(crops) == 2:
                lid = re.sub(crops[0], crops[1], lid)
            # Standard crop out?
            else:
                lid = lid.replace(self.cropout, "")

        defaultEmptyString = lambda value: value and str(value) or ""
        msg_metadata = dict([(k, defaultEmptyString(msg.get(k))) for k in self.keys])
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
        mdate = None
        try:
            mdate = email.utils.parsedate_tz(msg_metadata.get('date'))
        except:
            pass
        if not mdate and msg_metadata.get('archived-at'):
            mdate = email.utils.parsedate_tz(msg_metadata.get('archived-at'))
        elif not mdate:
            print("Date (%s) seems totally wrong, setting to _now_ instead." % mdate)
            mdate = time.gmtime() # Get a standard 9-tuple
            mdate = mdate + (0, ) # Fake a TZ (10th element)

        # mdate calculations are all done, prepare the index entry
        epoch = email.utils.mktime_tz(mdate)
        mdatestring = time.strftime("%Y/%m/%d %H:%M:%S", time.gmtime(epoch))
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
        if body is not None or attachments:
            pmid = mid
            try:
                if archiver_generator == "full":
                    mid = generators.full(msg, body, lid, attachments)
                elif archiver_generator == "medium":
                    mid = generators.medium(msg, body, lid, attachments)
                elif archiver_generator == "cluster":
                    mid = generators.cluster(msg, body, lid, attachments)
                else:
                    mid = generators.legacy(msg, body, lid, attachments)
            except Exception as err:
                if logger:
                    logger.warning("Could not generate MID: %s", err)
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
                'epoch': epoch,
                'list': lid,
                'list_raw': lid,
                'date': mdatestring,
                'private': private,
                'references': msg_metadata['references'],
                'in-reply-to': irt,
                'body': body.decode('utf-8', 'replace') if type(body) is bytes else body,
                'attachments': attachments
            }

        return  ojson, contents, msg_metadata, irt

    def archive_message(self, mlist, msg, raw_msg):
        """Send the message to the archiver.

        :param mlist: The IMailingList object.
        :param msg: The message object.

        :return (lid, mid)
        """

        lid = normalize_lid(mlist.list_id)

        private = False
        if hasattr(mlist, 'archive_public') and mlist.archive_public == True:
            private = False
        elif hasattr(mlist, 'archive_public') and mlist.archive_public == False:
            private = True
        elif hasattr(mlist, 'archive_policy') and mlist.archive_policy is not ArchivePolicy.public:
            private = True

        ojson, contents, msg_metadata, irt = self.compute_updates(lid, private, msg)
        if not ojson:
            _id = msg.get('message-id') or msg.get('Subject') or msg.get("Date")
            raise Exception("Could not parse message %s for %s" % (_id,lid))

        if args.dry:
            print("**** Dry run, not saving message to database *****")
            return lid, ojson['mid']

        try:
            if contents:
                for key in contents:
                    self.index(
                        index=self.dbname,
                        doc_type="attachment",
                        id=key,
                        body = {
                            'source': contents[key]
                        }
                    )

            self.index(
                index=self.dbname,
                doc_type="mbox",
                id=ojson['mid'],
                consistency = self.consistency,
                body = ojson
            )

            self.index(
                index=self.dbname,
                doc_type="mbox_source",
                id=ojson['mid'],
                consistency = self.consistency,
                body = {
                    "message-id": msg_metadata['message-id'],
                    "source": self.mbox_source(raw_msg)
                }
            )
        # If we have a dump dir and ES failed, push to dump dir instead as a JSON object
        # We'll leave it to another process to pick up the slack.
        except Exception as err:
            if dumpDir:
                print("Pushing to ES failed, but dumponfail specified, dumping JSON docs")
                uid = uuid.uuid4()
                mboxPath = os.path.join(dumpDir, "%s.json" % uid)
                with open(mboxPath, "w") as f:
                    json.dump({
                        'id': ojson['mid'],
                        'mbox': ojson,
                        'mbox_source': {
                            "message-id": msg_metadata['message-id'],
                            "source": self.mbox_source(raw_msg)
                        },
                        'attachments': contents
                    },f , indent = 2)
                    f.close()
                sys.exit(0) # We're exiting here, the rest can't be done without ES
            # otherwise fail as before
            raise err

        # If MailMan and list info is present, save/update it in ES:
        if hasattr(mlist, 'description') and hasattr(mlist, 'list_name') and mlist.description and mlist.list_name:
            self.index(
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
            logger.info("Pony Mail archived message %s successfully", ojson['mid'])
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
                        # N.B. no index is supplied, so ES will generate one
                        self.index(
                            index=self.dbname,
                            doc_type="notifications",
                            consistency = self.consistency,
                            body = {
                                'type': 'direct',
                                'recipient': cid,
                                'list': lid,
                                'private': private,
                                'date': ojson['date'],
                                'from': msg_metadata['from'],
                                'to': msg_metadata['to'],
                                'subject': msg_metadata['subject'],
                                'message-id': msg_metadata['message-id'],
                                'in-reply-to': irt,
                                'epoch': ojson['epoch'],
                                'mid': mid,
                                'seen': 0
                            }
                        )
                        if logger:
                            logger.info("Notification sent to %s for %s", cid, mid)

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
                        # N.B. no index is supplied, so ES will generate one
                        self.index(
                            index=self.dbname,
                            consistency = self.consistency,
                            doc_type="notifications",
                            body = {
                                'type': 'indirect',
                                'recipient': cid,
                                'list': lid,
                                'private': private,
                                'date': ojson['date'],
                                'from': msg_metadata['from'],
                                'to': msg_metadata['to'],
                                'subject': msg_metadata['subject'],
                                'message-id': msg_metadata['message-id'],
                                'in-reply-to': irt,
                                'epoch': ojson['epoch'],
                                'mid': mid,
                                'seen': 0
                            }
                        )
                        if logger:
                            logger.info("Notification sent to %s for %s", cid, mid)
        return lid, ojson['mid']

    def mbox_source(self, b):
        # Common method shared with import-mbox
        try:
            # Can we store as ASCII?
            return b.decode('ascii', errors='strict')
        except UnicodeError:
            # No, so must use base64 to avoid corruption on re-encoding
            return encode_base64(b)

    def list_url(self, _mlist):
        """ Required by MM3 plugin API
        """
        return None

    def permalink(self, _mlist, _msg):
        """ Required by MM3 plugin API
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
    parser.add_argument('--dry', dest='dry', action='store_true',
                       help='Do not save emails to elasticsearch, only test parsing')
    parser.add_argument('--dumponfail', dest='dump',
                       help='If pushing to ElasticSearch fails, dump documents in JSON format to this directory and fail silently.')
    args = parser.parse_args()

    if args.html2text:
        parseHTML = True
    if args.dump:
        dumpDir = args.dump
    if args.verbose:
        logging.basicConfig(stream=sys.stdout, level=logging.INFO)
    else:
        # elasticsearch logs lots of warnings on retries/connection failure
        # Also eliminates: 'Undecodable raw error response from server:' warning message
        logging.getLogger("elasticsearch").setLevel(logging.ERROR)


    archie = Archiver(parseHTML = parseHTML)
    # use binary input so parser can use appropriate charset
    input_stream = sys.stdin.buffer

    try:
        msgstring = input_stream.read()
        try:
            msg = email.message_from_bytes(msgstring)
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
            list_data = namedtuple('importmsg', ['list_id', 'archive_public'])(list_id = msg.get('list-id'), archive_public=ispublic)

            try:
                lid, mid = archie.archive_message(list_data, msg, msgstring)
                print("%s: Done archiving to %s as %s!" % (email.utils.formatdate(), lid, mid))
            except Exception as err:
                if args.verbose:
                    traceback.print_exc()
                print("Archiving failed!: %s" % err)
                raise Exception("Archiving to ES failed")
        else:
            print("Nothing to import (no list-id found!)")
    except Exception as err:
        # extract the len number without using variables (which may cause issues?)
        #                           last traceback    1st entry, 2nd field
        line = traceback.extract_tb(sys.exc_info()[2])[0][1]
        if args.quiet:
            print("Could not parse email, but exiting quietly as --quiet is on: %s (@ %s)" % (err, line))
        else:
            print("Could not parse email: %s (@ %s)" % (err, line))
            sys.exit(-1)

