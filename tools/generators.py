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

"""
This file contains the various ID generators for Pony Mail's archivers.
"""

import hashlib
import email.utils
import time
import re

# Full generator: uses the entire email (including server-dependent data)
# This is the recommended generator for single-node setups.
def full(msg, _body, lid, _attachments):
    """
    Full generator: uses the entire email
    (including server-dependent data)
    The id is almost certainly unique,
    but different copies of the message are likely to have different headers, thus ids

    Parameters:
    msg - the parsed message
    _body - the parsed text content (not used)
    lid - list id
    _attachments - list of attachments (not used)

    Returns: "<hash>@<lid>" where hash is sha224 of message bytes
    """
    mid = "%s@%s" % (hashlib.sha224(msg.as_bytes()).hexdigest(), lid)
    return mid

# Medium: Standard 0.9 generator - Not recommended for future installations.
# See 'full' or 'cluster' generators instead.
def medium(msg, body, lid, _attachments):
    """
    Standard 0.9 generator - Not recommended for future installations.
    (does not generate sufficiently unique ids)

    The following message fields are concatenated to form the hash input:
    - body: if bytes as is else encoded ascii, ignoring invalid characters; if the body is null an Exception is thrown
    - lid
    - Date header if it exists and parses OK; failing that
    - archived-at header if it exists and parses OK; failing that
    - current time.
    The resulting date is converted to YYYY/MM/DD HH:MM:SS (using UTC)

    Parameters:
    msg - the parsed message (used to get the date)
    body - the parsed text content (may be null)
    lid - list id
    _attachments - list of attachments (not used)

    Returns: "<hash>@<lid>" where hash is sha224 of the message items noted above
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
    # another generator
    if not mdate and msg.get('archived-at'):
        mdate = email.utils.parsedate_tz(msg.get('archived-at'))
    elif not mdate:
        mdate = time.gmtime() # Get a standard 9-tuple
        mdate = mdate + (0, ) # Fake a TZ (10th element)
    mdatestring = time.strftime("%Y/%m/%d %H:%M:%S", time.gmtime(email.utils.mktime_tz(mdate)))
    xbody += bytes(mdatestring, encoding='ascii')
    mid = "%s@%s" % (hashlib.sha224(xbody).hexdigest(), lid)
    return mid

# cluster: Use data that is guaranteed to be the same across cluster setups
# This is the recommended generator for cluster setups.
# Unlike 'medium', this only makes use of the Date: header and not the archived-at,
# as the archived-at may change from node to node (and will change if not in the raw mbox file)
# Also the lid is not included in the hash, so the hash does not change if the lid is overridden
#
def cluster(msg, body, lid, attachments):
    """
    Use data that is guaranteed to be the same across cluster setups
    For mails with a valid Message-ID this is likely to be unique
    In other cases it is better than the medium generator as it uses several extra fields

    The following message fields are concatenated to form the hash input:
    - body as is if bytes else encoded ascii, ignoring invalid characters; if the body is null it is treated as an empty string
      (currently trailing whitespace is dropped)
    - Message-ID (if present)
    - Date header converted to YYYY/MM/DD HH:MM:SS (UTC)
      or "(null)" if the date does not exist or cannot be converted
    - sender, encoded as ascii (if the field exists)
    - subject, encoded as ascii (if the field exists)
    - the hashes of any attachments

    Note: the lid is not included in the hash.

    Parameters:
    msg - the parsed message
    body - the parsed text content
    lid - list id
    attachments - list of attachments (uses the hashes)

    Returns: "r<hash>@<lid>" where hash is sha224 of the message items noted above
    """
    # Use text body
    if not body: # Make sure body is not None, which will fail.
        body = ""
    xbody = body if type(body) is bytes else body.encode('ascii', 'ignore')

    # Crop out any trailing whitespace in body
    xbody = re.sub(b"\s+$", b"", xbody)

    # Use Message-Id (or '' if missing)
    xbody += bytes(msg.get('Message-Id', ''), encoding='ascii')

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

    # generate the hash and combine with the lid to form the id
    mid = "r%s@%s" % (hashlib.sha224(xbody).hexdigest(), lid)
    return mid


# Old school way of making IDs
def legacy(msg, body, lid, _attachments):
    """
    Original generator - DO NOT USE
    (does not generate unique ids)

    The hash input is created from
    - body: if bytes as is else encoded ascii, ignoring invalid characters; if the body is null an Exception is thrown

    The uid_mdate for the id is the Date converted to UTC epoch else 0

    Parameters:
    msg - the parsed message (used to get the date)
    body - the parsed text content (may be null)
    lid - list id
    _attachments - list of attachments (not used)

    Returns: "<hash>@<uid_mdate>@<lid>" where hash is sha224 of the message items noted above
    """
    uid_mdate = 0 # Default if no date found
    try:
        mdate = email.utils.parsedate_tz(msg.get('date'))
        uid_mdate = email.utils.mktime_tz(mdate) # Only set if Date header is valid
    except:
        pass
    mid = "%s@%s@%s" % (hashlib.sha224(body if type(body) is bytes else body.encode('ascii', 'ignore')).hexdigest(), uid_mdate, lid)
    return mid
