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
Possible patch for Python email package
The current code calls unquote() in collapse_rfc2231_value
when it has already called unquote().
Double-unquoting mangles raw values that happen to be enclosed in quotes.

This was first discovered for multi-part boundaries, some of which look like:
boundary="<<<abcd>>>"
Strictly speaking < and > are not valid as boundary chars, but they are seen in the wild.
A similar problem exists for filenames which start/end with "/" or </>
These are valid (but unusual)

One way to fix this is to replace the faulty version of collapse_rfc2231_value.

To use:

import email_utils_patch
...
email_utils_patch.patch()

"""

from email import utils

# Copy of utils.collapse_rfc2231_value with unquote() calls removed
def _collapse_rfc2231_value(value, errors='replace',
                           fallback_charset='us-ascii'):
    if not isinstance(value, tuple) or len(value) != 3:
        return value
    # While value comes to us as a unicode string, we need it to be a bytes
    # object.  We do not want bytes() normal utf-8 decoder, we want a straight
    # interpretation of the string as character bytes.
    charset, _language, text = value
    if charset is None:
        # Issue 17369: if charset/lang is None, decode_rfc2231 couldn't parse
        # the value, so use the fallback_charset.
        charset = fallback_charset
    rawbytes = bytes(text, 'raw-unicode-escape')
    try:
        return str(rawbytes, charset, errors)
    except LookupError:
        # charset is not a known codec.
        return text

def patch():
    old = utils.collapse_rfc2231_value
    utils.collapse_rfc2231_value = _collapse_rfc2231_value
    print("Overiding broken collapse_rfc2231_value")
    return old
