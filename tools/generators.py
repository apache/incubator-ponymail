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

import base64
import hashlib
import email.utils
import time
import re

# For optional nonce
config = None

# Headers from RFC 4871, the precursor to RFC 6376
rfc4871_subset = {
    b"from", b"sender", b"reply-to", b"subject", b"date",
    b"message-id", b"to", b"cc", b"mime-version", b"content-type",
    b"content-transfer-encoding", b"content-id",
    b"content-description", b"resent-date", b"resent-from",
    b"resent-sender", b"resent-to", b"resent-cc",
    b"resent-message-id", b"in-reply-to", b"references", b"list-id",
    b"list-help", b"list-unsubscribe", b"list-subscribe",
    b"list-post", b"list-owner", b"list-archive", b"dkim-signature"
}

# Authenticity headers from RFC 8617
rfc4871_and_rfc8617_subset = rfc4871_subset | {
    b"arc-authentication-results", b"arc-message-signature",
    b"arc-seal"
}

def rfc822_parse_dkim(suffix,
        head_canon = False, body_canon = False,
        head_subset = None, archive_list_id = None):
    headers = []
    keep = True
    list_ids = set()

    while suffix:
        # Edge case: headers don't end LF (add LF)
        line, suffix = (suffix.split(b"\n", 1) + [None])[:2]
        if line in {b"\r", b"", None}:
            break
        lf = line.endswith(b"\r") and (suffix is not None)
        end = b"\n" if lf else b"\r\n"
        if line[0] in {0x09, 0x20}:
            # Edge case: starts with a continuation (treat like From)
            if headers and (keep is True):
                headers[-1][1] += line + end
        elif not line.startswith(b"From "):
            # Edge case: header start contains no colon (use whole line)
            # "A field-name MUST be contained on one line." (RFC 822 B.2)
            k, v = (line.split(b":", 1) + [b""])[:2]
            k_lower = k.lower()
            if k_lower == "list-id":
                list_ids.add(k_lower)
            if (head_subset is None) or (k_lower in head_subset):
                keep = True
                headers.append([k, v + end])
            else:
                keep = False
    # The remaining suffix is the body
    body = (suffix or b"").replace(b"\r\n", b"\n")
    body = body.replace(b"\n", b"\r\n")

    # Optional X-Archive-List-ID augmentation
    if (archive_list_id is not None) and (archive_list_id not in list_ids):
        xali_value = b" " + bytes(archive_list_id, "ascii")
        headers.append([b"X-Archive-List-ID", xali_value])
    # Optional nonce from local config
    if config is not None:
        if (config.has_section("archiver") and
            config.has_option("archiver", "nonce")):
            nonce = config.get("archiver", "nonce")
            headers.append([b"X-Archive-Nonce", nonce])
    # Optional head canonicalisation (DKIM relaxed)
    if head_canon is True:
        for i in range(len(headers)):
            k, v = headers[i]
            crlf = v.endswith(b"\r\n")
            if crlf is True:
                v = v[:-2]
            v = v.replace(b"\r\n", b"")
            v = v.replace(b"\t", b" ")
            v = v.strip(b" ")
            v = b" ".join(vv for vv in v.split(b" ") if vv)
            if crlf is True:
                v = v + b"\r\n"
            headers[i] = [k.lower(), v]
    # Optional body canonicalisation (DKIM simple)
    if body_canon is True:
        while body.endswith(b"\r\n\r\n"):
            body = body[:-2]
    return (headers, body)

def pibble(hashable, size = 10):
    table = bytes.maketrans(
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
        b"0123456789bcdfghjklmnopqrstvwxyz",
    )
    digest = hashlib.sha3_256(hashable).digest()
    prefix = digest[:size]
    encoded = base64.b32encode(prefix)
    return str(encoded.translate(table), "ascii")

# DKIM generator: uses DKIM canonicalisation
# Used by default
def dkim(_msg, _body, lid, _attachments, raw_msg):
    """
    DKIM generator: uses DKIM relaxed/simple canonicalisation
    We use the headers recommended in RFC 4871, plus DKIM-Signature

    Parameters:
    _msg - the parsed message (not used)
    _body - the parsed text content (not used)
    lid - list id
    _attachments - list of attachments (not used)
    raw_msg - the original message bytes

    Returns: str "<pibble>", a sixteen char custom base32 encoded hash
    """
    headers, body = rfc822_parse_dkim(raw_msg,
        head_canon = True, body_canon = True,
        head_subset = rfc4871_subset, archive_list_id = lid)
    hashable = b"".join([b":".join(header) for header in headers])
    if body:
        hashable += b"\r\n" + body
    # The pibble is the 80-bit SHA3-256 prefix
    # It is base32 encoded using 0-9 a-z except [aeiu]
    return pibble(hashable)

# Full generator: uses the entire email (including server-dependent data)
# Used by default until August 2020.
# See 'dkim' for recommended generation.
def full(msg, _body, lid, _attachments, _raw_msg):
    """
    Full generator: uses the entire email
    (including server-dependent data)
    The id is almost certainly unique,
    but different copies of the message are likely to have different headers, thus ids

    WARNING: the archiver by default adds an archived-at header with the current time.
    This is included in the hash, so messages will get different Permalinks if reloaded from source

    Parameters:
    msg - the parsed message
    _body - the parsed text content (not used)
    lid - list id
    _attachments - list of attachments (not used)
    _raw_msg - the original message bytes (not used)

    Returns: "<hash>@<lid>" where hash is sha224 of message bytes
    """
    mid = "%s@%s" % (hashlib.sha224(msg.as_bytes()).hexdigest(), lid)
    return mid

# Medium: Standard 0.9 generator - Not recommended for future installations.
# See 'full' or 'cluster' generators instead.
def medium(msg, body, lid, _attachments, _raw_msg):
    """
    Standard 0.9 generator - Not recommended for future installations.
    (does not generate sufficiently unique ids)
    Also the lid is included in the hash; this causes problems if the listname needs to be changed.

    N.B. The id is not guaranteed stable - i.e. it may change if the message is reparsed. 
    The id depends on the parsed body, which depends on the exact method used to parse the mail.
    For example, are invalid characters ignored or replaced; is html parsing used?

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
    _raw_msg - the original message bytes (not used)

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

# Original medium generator used for a while in June 2016
# Committed: https://gitbox.apache.org/repos/asf?p=incubator-ponymail.git;a=commitdiff;h=aa989610
# Replaced:  https://gitbox.apache.org/repos/asf?p=incubator-ponymail.git;a=commitdiff;h=4732d25f
def medium_original(msg, body, lid, _attachments, _raw_msg):
    """
    NOT RECOMMENDED - does not generate sufficiently unique ids
    Also the lid is included in the hash; this causes problems if the listname needs to be changed.

    The following message fields are concatenated to form the hash input:
    - body: if bytes as is else encoded ascii, ignoring invalid characters; if the body is null an Exception is thrown
    - lid
    - Date header if it exists and parses OK; converted to UTC seconds since the epoch; else 0

    Parameters:
    msg - the parsed message (used to get the date)
    body - the parsed text content (may be null)
    lid - list id
    _attachments - list of attachments (not used)
    _raw_msg - the original message bytes (not used)

    Returns: "<hash>@<lid>" where hash is sha224 of the message items noted above
    """

    # Use text body
    xbody = body if type(body) is bytes else body.encode('ascii', 'ignore')
    # Use List ID
    xbody += bytes(lid)

    uid_mdate = 0 # mdate for UID generation
    try:
        mdate = email.utils.parsedate_tz(msg_metadata.get('date'))
        uid_mdate = email.utils.mktime_tz(mdate) # Only set if Date header is valid
    except:
       pass
    xbody += bytes(uid_mdate)
    mid = "%s@%s" % (hashlib.sha224(xbody).hexdigest(), lid)
    return mid

# cluster: Use data that is guaranteed to be the same across cluster setups
# This is the recommended generator for cluster setups.
# Unlike 'medium', this only makes use of the Date: header and not the archived-at,
# as the archived-at may change from node to node (and will change if not in the raw mbox file)
# Also the lid is not included in the hash, so the hash does not change if the lid is overridden
#
def cluster(msg, body, lid, attachments, _raw_msg):
    """
    Use data that is guaranteed to be the same across cluster setups
    For mails with a valid Message-ID this is likely to be unique
    In other cases it is better than the medium generator as it uses several extra fields

    N.B. The id is not guaranteed stable - i.e. it may change if the message is reparsed. 
    The id depends on the parsed body, which depends on the exact method used to parse the mail.
    For example, are invalid characters ignored or replaced; is html parsing used?

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
    _raw_msg - the original message bytes (not used)

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
def legacy(msg, body, lid, _attachments, _raw_msg):
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
    _raw_msg - the original message bytes (not used)

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

__GENERATORS={
    'dkim': dkim,
    'full': full,
    'medium': medium,
    'medium_original': medium_original,
    'cluster': cluster,
    'legacy': legacy,
}

def generator(name):
    try:
        return __GENERATORS[name]
    except:
        print("WARN: generator %s not found, defaulting to 'legacy'" % name)
        return legacy

def generate(name, msg, body, lid, attachments, raw_msg):
    return generator(name)(msg, body, lid, attachments, raw_msg)

def generator_names():
    return list(__GENERATORS)
