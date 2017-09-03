#!/usr/bin/env/python3
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

"""
This file contains the various ID generators for Pony Mail's archivers.
"""

import hashlib
import email.utils
import time
import re

# Full generator: uses the entire email (including server-dependent data)
# This is the recommended generator for single-node setups.
def full(msg, body, lid, attachments):
    """
    Full generator: uses the entire email
    (including server-dependent data)
    The id is almost certainly unique,
    but different copies of the message are likely to have different headers, thus ids
    
    Parameters:
    msg - the parsed message
    body - the parsed text content (not used)
    lid - list id
    attachments - list of attachments (not used)
    """
    mid = "%s@%s" % (hashlib.sha224(msg.as_bytes()).hexdigest(), lid)
    return mid

# Medium: Standard 0.9 generator - Not recommended for future installations.
# See 'full' or 'redundant' generators instead.
def medium(msg, body, lid, attachments):
    """
    Standard 0.9 generator - Not recommended for future installations.
    (does not generate sufficiently unique ids)
    
    Parameters:
    msg - the parsed message (used to get the date)
    body - the parsed text content
    lid - list id
    attachments - list of attachments (not used)
    """
    # Use text body
    xbody = body if type(body) is bytes else body.encode('ascii', 'ignore')
    # Use List ID
    xbody += bytes(lid, encoding='ascii')
    # Use Date header
    try:
        mdate = email.utils.parsedate_tz(msg.get('date'))
    except:
        pass
    # In keeping with preserving the past, we have kept this next section(s).
    # For all intents and purposes, this is not a proper way of maintaining
    # a consistent ID in case of missing dates. It is recommended to use
    # another generator such as full or redundant here.
    if not mdate and msg.get('archived-at'):
        mdate = email.utils.parsedate_tz(msg.get('archived-at'))
    elif not mdate:
        mdate = time.gmtime() # Get a standard 9-tuple
        mdate = mdate + (0, ) # Fake a TZ (10th element)
    mdatestring = time.strftime("%Y/%m/%d %H:%M:%S", time.gmtime(email.utils.mktime_tz(mdate)))
    xbody += bytes(mdatestring, encoding='ascii')
    mid = "%s@%s" % (hashlib.sha224(xbody).hexdigest(), lid)
    return mid

# Redundant: Use data that is guaranteed to be the same across redundant setups
# This is the recommended generator for redundant cluster setups.
# Unlike 'medium', this only makes use of the Date: header and not the archived-at,
# as the archived-at may change from node to node (and will change if not in the raw mbox file)
def redundant(msg, body, lid, attachments):
    """
    Use data that is guaranteed to be the same across redundant setups
    (does not guarantee to create unique ids)
    
    Parameters:
    msg - the parsed message (used to get the date)
    body - the parsed text content
    lid - list id
    attachments - list of attachments (uses the hashes)
    """
    # Use text body
    if not body: # Make sure body is not None, which will fail.
        body = ""
    xbody = body if type(body) is bytes else body.encode('ascii', 'ignore')
    
    # Crop out any trailing whitespace in body
    xbody = re.sub(b"\s+$", b"", xbody)
    
    # Use List ID
    xbody += bytes(lid, encoding='ascii')
    
    # Use Date header. Don't use archived-at, as the archiver sets this if not present.
    mdate = None
    mdatestring = "(null)" # Default to null, ONLY changed if replicable across imports
    try:
        mdate = email.utils.parsedate_tz(msg.get('date'))
        mdatestring = time.strftime("%Y/%m/%d %H:%M:%S", time.gmtime(email.utils.mktime_tz(mdate)))
    except:
        pass
    xbody += bytes(mdatestring, encoding='ascii')
    
    # Use sender
    sender = msg.get('from', None)
    if sender:
        xbody += bytes(sender, encoding = 'ascii')
    
    # Use subject
    subject = msg.get('subject', None)
    if subject:
        xbody += bytes(subject, encoding = 'ascii')
    
    # Use attachment hashes if present
    if attachments:
        for a in attachments:
            xbody += bytes(a['hash'], encoding = 'ascii')
    mid = "r%s@%s" % (hashlib.sha224(xbody).hexdigest(), lid)
    return mid


# Old school way of making IDs
def legacy(msg, body, lid, attachments):
    """
    Original generator - DO NOT USE
    (does not generate unique ids)
    
    Parameters:
    msg - the parsed message (used to get the date)
    body - the parsed text content
    lid - list id
    attachments - list of attachments (not used)
    """
    uid_mdate = 0 # Default if no date found
    try:
        mdate = email.utils.parsedate_tz(msg.get('date'))
        uid_mdate = email.utils.mktime_tz(mdate) # Only set if Date header is valid
    except:
        pass
    mid = "%s@%s@%s" % (hashlib.sha224(body if type(body) is bytes else body.encode('ascii', 'ignore')).hexdigest(), uid_mdate, lid)
    return mid
