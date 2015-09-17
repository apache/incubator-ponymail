""" Publish notifications about mails to pony mail.

Enable this by adding the following to your mailman.cfg file::

    [archiver.ponymail]
    # The class implementing the IArchiver interface.
    class: mailman3_ponymail_plugin.Archiver
    enable: yes


"""
if __name__ != '__main__':
    from zope.interface import implements
    from mailman.interfaces.archiver import IArchiver
else:
    import sys

from elasticsearch import Elasticsearch
import hashlib
import email.utils
import datetime, time
import json


class Archiver(object):
    """ A mailman 3 archiver that forwards messages to pony mail. """

    implements(IArchiver)
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
                'host': '127.0.0.1',
                'port': 9200,
                'use_ssl': False,
                'url_prefix': ''
            }],
            max_retries=5,
            retry_on_timeout=True
            )

    def msgbody(msg):
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
    
        for charset in getcharsets(msg):
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

        
        format = lambda value: value and unicode(value)
        msg_metadata = dict([(k, format(msg.get(k))) for k in self.keys])
        lst_metadata = dict(list_name=mlist.list_name)
        mid = hashlib.sha224(mlist.list_name + msg_metadata['archived-at']).hexdigest() + "@" + (mlist.list_name if mlist.list_name else "none")
        if not msg_metadata.get('message-id'):
            msg_metadata.__setattr__('message-id', mid)
        mdate = email.utils.parsedate_tz(msg_metadata.get('date'))
        if not mdate:
            mdate = email.utils.parsedate_tz(msg_metadata.get('archived-at'))
        
        body = self.msgbody(msg)
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
        if body:
            ojson = {
                'from_raw': msg_metadata['from'],
                'from': msg_metadata['from'],
                'to': msg_metadata['to'],
                'subject': msg_metadata['subject'],
                'message-id': msg_metadata['message-id'],
                'mid': mid,
                'epoch': email.utils.mktime_tz(mdate),
                'list': mlist.list_name,
                'list_raw': mlist.list_name,
                'date': msg_metadata['date'],
                'private': False,
                'references': msg_metadata['references'],
                'in-reply-to': msg_metadata['in-reply-to'],
                'body': body
            }
        
            self.es.index(
                index="ponymail_alpha",
                doc_type="mbox",
                id=mid,
                body = ojson
            )
            
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
    # We're reading from STDIN, so let's 'fake' an MM3 call
    if 'list-id' in msg:
        msg_metadata = dict([('list_name', msg.get('list-id'))])
        foo.archive_message(msg_metadata, msg)
        print("Done archiving!")
    else:
        print("Nothing to import (no list-id found!)")
        
    