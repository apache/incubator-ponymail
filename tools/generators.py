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

# Full generator: uses the entire email (including server-dependent data)
# This is the recommended generator for single-node setups.
def full(msg, body, lid, attachments):
    mid = "%s@%s" % (hashlib.sha224(msg.as_bytes()).hexdigest(), lid)
    return mid

# Medium: Standard generator
def medium(msg, body, lid, attachments):
    # Use text body
    xbody = body if type(body) is bytes else body.encode('ascii', 'ignore')
    # Use List ID
    xbody += bytes(lid, encoding='ascii')
    # Use Date header
    xbody += bytes(mdatestring, encoding='ascii')
    mid = "%s@%s" % (hashlib.sha224(xbody).hexdigest(), lid)
    return mid

# Redundant: Use data that is guaranteed to be the same across redundant setups
# This is the recommended generator for redundant cluster setups
def redundant(msg, body, lid, attachments):
    # Use text body
    xbody = body if type(body) is bytes else body.encode('ascii', 'ignore')
    # Use List ID
    xbody += bytes(lid, encoding='ascii')
    # Use Date header
    xbody += bytes(mdatestring, encoding='ascii')
    # Use sender
    sender = msg.get('from', None)
    if sender:
        xbody += bytes(sender, encoding = 'ascii')
    # Use subject
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
    mdate = email.utils.parsedate_tz(msg.get('date'))
    uid_mdate = email.utils.mktime_tz(mdate) # Only set if Date header is valid
    mid = "%s@%s@%s" % (hashlib.sha224(body if type(body) is bytes else body.encode('ascii', 'ignore')).hexdigest(), uid_mdate, lid)
    return mid


    
