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
DKIM-ID Generator Code
"""

import base64
import hashlib
from typing import List, Optional, Set, Tuple

# Types
Headers = List[List[bytes]]

# Headers from RFC 4871, the precursor to RFC 6376
# libopendkim lacks: sender, message-id, mime-version, content-type,
# content-transfer-encoding, content-id, content-description,
# resent-message-id, dkim-signature
rfc4871_subset: Set[bytes] = {
    b"from",
    b"sender",
    b"reply-to",
    b"subject",
    b"date",
    b"message-id",
    b"to",
    b"cc",
    b"mime-version",
    b"content-type",
    b"content-transfer-encoding",
    b"content-id",
    b"content-description",
    b"resent-date",
    b"resent-from",
    b"resent-sender",
    b"resent-to",
    b"resent-cc",
    b"resent-message-id",
    b"in-reply-to",
    b"references",
    b"list-id",
    b"list-help",
    b"list-unsubscribe",
    b"list-subscribe",
    b"list-post",
    b"list-owner",
    b"list-archive",
    b"dkim-signature",
}

# Authenticity headers from RFC 8617
rfc4871_and_rfc8617_subset: Set[bytes] = rfc4871_subset | {
    b"arc-authentication-results",
    b"arc-message-signature",
    b"arc-seal",
}


def rfc5322_endings(data: bytes) -> bytes:
    r"""
    Convert bytes to RFC 5322 ending normal form.
    In ending normal form, bare CR and LF are converted to CRLF.

    >>> rfc5322_endings(b"CR \r LF \n CRLF \r\n")
    b'CR \r\n LF \r\n CRLF \r\n'
    """
    #       v
    # [^\r]\n -> [^\r]\r\n
    #      v
    # \r[^\n] -> \r\n[^\n]
    #  v
    # \r$ -> \r\n$
    CR: int = 0x0D
    LF: int = 0x0A
    this: int
    prev: Optional[int] = None
    output: bytearray = bytearray()
    for this in data:
        if (this == LF) and (prev != CR):
            output.extend(b"\r\n")
        elif (prev == CR) and (this != LF):
            output.extend(b"\n")
            output.append(this)
        else:
            output.append(this)
        prev = this
    if prev == CR:
        output.append(LF)
    return bytes(output)


def rfc6376_split(suffix: Optional[bytes],) -> Tuple[Headers, Optional[bytes]]:
    r"""
    Parse an RFC 5322 message into headers and body.
    Does not perform any normalisation or canonicalisation.
    The returned body is None if no CRLF CRLF boundary is found.

    >>> rfc6376_split(b"To: Recipient\r\n\r\nBody")
    ([[b'To', b' Recipient\r\n']], b'Body')
    """
    headers: Headers = []
    while suffix:
        if suffix.startswith(b"\r\n"):
            return (headers, suffix[2:])
        parts: List[bytes] = suffix.split(b"\r\n", 1)
        line: bytes = parts.pop(0)
        # len(line) > 0 due to suffix.startswith(b"\r\n") above
        if line[:1] not in {b"\t", b" "}:
            headers.append((line.split(b":", 1) + [b""])[:2])
        else:
            if not headers:
                headers.append([b"", b""])
            headers[-1][1] += line
        if parts:
            headers[-1][1] += b"\r\n"
        else:
            return (headers, None)
        suffix = parts[0]
    return (headers, None)


def rfc6376_shrink_head(data: bytes) -> bytes:
    # Auxiliary function, not for external use
    data = data.replace(b"\t", b" ")
    return b" ".join(d for d in data.split(b" ") if d)


def rfc6376_relaxed_head(headers: Headers) -> Headers:
    r"""
    Perform RFC 6376 DKIM relaxed header canonicalisation.

    >>> rfc6376_relaxed_head([[b"TO ", b" Recipient\temail "]])
    [[b'to', b'Recipient email']]
    >>> rfc6376_relaxed_head([[b"  \t.\r\n", b"\t\r\n\f"]])
    [[b'.', b'\x0c']]
    """
    i: int
    output: Headers = []
    k: bytes
    v: bytes
    for (k, v) in headers:
        # Step 1: Header field names to lowercase
        k = k.lower()
        # Step 2: Unfold all header field value continuations
        # First, save CRLF for later restoration
        crlf: bool = v.endswith(b"\r\n")
        if crlf is True:
            v = v[:-2]
        # Then, remove all CR and LF from name and value
        # It is important to do this in k too, due to an edge case
        k = k.replace(b"\r", b"")
        k = k.replace(b"\n", b"")
        v = v.replace(b"\r", b"")
        v = v.replace(b"\n", b"")
        # Step 3: Convert WSP+ to space
        # Step 4: Remove trailing WSP from unfolded field values
        # Step 5: Remove trailing header name WSP, and leading value WSP
        # Also removes leading WSP from header names
        k = rfc6376_shrink_head(k)
        v = rfc6376_shrink_head(v)
        # Restore potential earlier saved CRLF
        if crlf is True:
            v = v + b"\r\n"
        output.append([k, v])
    return output


def rfc6376_simple_body(body: bytes) -> bytes:
    r"""
    Perform RFC 6376 DKIM simple body canonicalisation.

    >>> rfc6376_simple_body(b"")
    b'\r\n'
    >>> rfc6376_simple_body(b"\r\n\r\n")
    b'\r\n'
    >>> rfc6376_simple_body(b".")
    b'.'
    """
    # In DKIM simple body, an empty body becomes CRLF
    body = body or b"\r\n"
    while body.endswith(b"\r\n\r\n"):
        body = body[:-2]
    return body


def rfc6376_simple_holistic(
    headers: Headers, body: Optional[bytes]
) -> Tuple[Headers, bytes]:
    r"""
    Perform RFC 6376 DKIM simple body canonicalisation holistically.
    This appends CRLF to headers if necessary, if there was no body.

    >>> rfc6376_simple_holistic([[b"Key", b"Value"]], None)
    ([[b'Key', b'Value\r\n']], b'\r\n')
    """
    # Note: This modifies headers in place
    # There may be no body, but canonicalisation synthesizes one
    # Therefore we may need to add CRLF to the last header value
    if body is None:
        if headers:
            if not headers[-1][1].endswith(b"\r\n"):
                headers[-1][1] += b"\r\n"
        return (headers, b"\r\n")
    return (headers, rfc6376_simple_body(body))


def rfc6376_split_canon(
    data: bytes,
    head_subset: Optional[Set[bytes]] = None,
    head_canon: bool = False,
    body_canon: bool = False,
) -> Tuple[Headers, Optional[bytes]]:
    r"""
    Parse an RFC 5322 message into headers and body.
    Performs RFC 5322 normalisation, and optional canonicalisation.

    >>> rfc6376_split_canon(b"To: Recipient\r\n\r\nBody", head_canon=True)
    ([[b'to', b'Recipient\r\n']], b'Body')
    """
    # Convert to RFC 5322 ending normal form
    suffix: bytes = rfc5322_endings(data)

    # Parse the message without any canonicalisation
    headers: Headers
    body: Optional[bytes]
    headers, body = rfc6376_split(suffix)

    # Optional head canonicalisation (DKIM relaxed)
    if head_canon is True:
        headers = rfc6376_relaxed_head(headers)
    # Optional header subsetting
    if head_subset is not None:
        headers = [kv for kv in headers if kv[0].lower() in head_subset]

    # Optional body canonicalisation (DKIM simple)
    if body_canon is True:
        # The body result is now guaranteed to be bytes
        # Which makes this function polymorphic really
        # This is not reflected in its type signature
        headers, body = rfc6376_simple_holistic(headers, body)

    return (headers, body)


def rfc6376_join(headers: Headers, body: Optional[bytes] = None) -> bytes:
    r"""
    Combines rfc6376_split* output into an RFC 5322 message.

    >>> rfc6376_join([[b'To', b' Recipient\r\n']], b'Body')
    b'To: Recipient\r\n\r\nBody'
    """
    header: List[bytes]
    signable: bytes = b"".join([b":".join(header) for header in headers])
    if body is not None:
        # In some cases, the headers may not end with \r\n
        # This happens when the message abruptly ends in headers
        # E.g. "" or "k:v"
        # This means we have to attach it here for the rest to make sense
        # if not signable.endswith(b"\r\n"):
        #     signable += b"\r\n"
        # An empty body becomes b"\r\n" in DKIM canonicalisation
        # Therefore we can either have None or b"\r\n" here
        # But body cannot be b""
        signable += b"\r\n" + body
    return signable


def rfc6376_reformed(data: bytes) -> bytes:
    r"""
    Splits and then combines an RFC 5322 message.
    Performs light normalisation.
    Does not normalise line endings, and does not canonicalise.

    >>> rfc6376_reformed(b"To")
    b'To:'
    >>> rfc6376_reformed(b"To: Recipient\n")
    b'To: Recipient\n'
    """
    headers: Headers
    body: Optional[bytes]
    headers, body = rfc6376_split(data)
    return rfc6376_join(headers, body)


def rfc6376_reformed_canon(
    data: bytes,
    head_subset: Optional[Set[bytes]] = None,
    head_canon: bool = False,
    body_canon: bool = False,
) -> bytes:
    r"""
    Splits and then combines an RFC 5322 message.
    Performs RFC 5322 normalisation, and optional canonicalisation.

    >>> rfc6376_reformed_canon(b"To: Recipient\n\nBody", head_canon=True)
    b'to:Recipient\r\n\r\nBody'
    """
    headers: Headers
    body: Optional[bytes]
    headers, body = rfc6376_split_canon(
        data,
        head_subset=head_subset,
        head_canon=head_canon,
        body_canon=body_canon,
    )
    # print(headers, body)
    # Construct hashable bytes from the parsed message
    return rfc6376_join(headers, body)


def rfc6376_rascal(data: bytes) -> bytes:
    r"""
    Performs RFC 5322 normalisation.
    Performs RFC 6376 DKIM relaxed/simple canonicalisation.
    Selects a subset of headers based on RFC 4871.

    >>> rfc6376_rascal(b"To: Recipient\nOther: Value\n\n")
    b'to:Recipient\r\n\r\n\r\n'
    """
    return rfc6376_reformed_canon(
        data, head_subset=rfc4871_subset, head_canon=True, body_canon=True
    )


def pibble32(data: bytes) -> str:
    r"""
    Base32 encodes bytes with alphabet 0-9 b-d f-h j-t v-z.

    >>> pibble32(b"\xca\xfe\xc0\xff\xee")
    'sczd1zzg'
    """
    table: bytes = bytes.maketrans(
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
        b"0123456789bcdfghjklmnopqrstvwxyz",
    )
    encoded: bytes = base64.b32encode(data)
    return str(encoded.translate(table), "ascii")


def unpibble32(text: str) -> bytes:
    r"""
    Base32 decodes bytes with alphabet 0-9 b-d f-h j-t v-z.

    >>> unpibble32("sczd1zzg")
    b'\xca\xfe\xc0\xff\xee'
    """
    encoded: bytes = bytes(text, "ascii")
    table: bytes = bytes.maketrans(
        b"0123456789bcdfghjklmnopqrstvwxyz",
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    )
    return base64.b32decode(encoded.translate(table))


def dkim_id(data: bytes) -> str:
    """
    The DKIM-ID is the custom base32 encoded SHAKE-128
    As this is fixed length, padding is removed from the output
    Requires >= Python 3.6 for hashlib.shake_128

    >>> dkim_id(b"")
    'nmh143z8mjhb40j0mtksl7dhq8'
    """
    hashable: bytes = rfc6376_rascal(data)
    digest_128: bytes = hashlib.shake_128(hashable).digest(128 // 8)
    return pibble32(digest_128).rstrip("=")


def main() -> None:
    from sys import argv
    from typing import BinaryIO

    if len(argv) == 2:
        f: BinaryIO
        with open(argv[1], "rb") as f:
            print(dkim_id(f.read()))
    else:
        from sys import stdin

        print(dkim_id(stdin.buffer.read()))


if __name__ == "__main__":
    main()
