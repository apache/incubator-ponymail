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

r"""
========
DKIM-IDs
========

The recommended Ponymail ID generator is the DKIM-ID generator. It
simplifies a message using an algorithm based on DKIM relaxed/simple
canonicalisation, hashes it with SHAKE-128, and then encodes the
digest using base32 with the custom alphabet ``0-9 b-d f-h j-t v-z``
and the padding stripped.


DKIM-IDs test suite
===================

As well as plain Python doctests, we also use the hypothesis package
to check properties of the DKIM-ID generator algorithm. This has the
advantage of providing a kind of partial specification as well as
testing the code. The suite can be run using::

    PYTHONPATH=../tools python3 dkim_id_test.py

And exported to HTML using docutils and the command::

    HTML=1 PYTHONPATH=../tools \
        python3 dkim_id_test.py > dkim_id_test.html


RFC5322 line ending normalisation
---------------------------------

The first step of generating a DKIM-ID is to convert all line endings
of the input to CRLF by upgrading bare CR and LF characters.

  If the message is submitted to the Signer with any local encoding
  that will be modified before transmission, that modification to
  canonical [RFC5322] form MUST be done before signing. In particular,
  bare CR or LF characters (used by some systems as a local line
  separator convention) MUST be converted to the SMTP-standard CRLF
  sequence before the message is signed.

  https://tools.ietf.org/html/rfc6376#section-5.3

We follow the algorithm used in dkim_header in dkim.c in version 2.10
of libopendkim, the implementation of which is this, reformatted for
brevity::

  for (p = hdr; p < q && *p != '\0'; p++) {
    if (*p == '\n' && prev != '\r') { /* bare LF */
      dkim_dstring_catn(tmphdr, CRLF, 2);
    } else if (prev == '\r' && *p != '\n') { /* bare CR */
      dkim_dstring_cat1(tmphdr, '\n');
      dkim_dstring_cat1(tmphdr, *p);
    } else { /* other */
      dkim_dstring_cat1(tmphdr, *p);
    }
    prev = *p;
  }
  if (prev == '\r') { /* end CR */
    dkim_dstring_cat1(tmphdr, '\n');
  }

Our version of this algorithm is called ``rfc5322_endings``.

>>> from dkim_id import rfc5322_endings

It works on bytes and produces bytes.

We test properties of the DKIM-ID related functions not by formally
proving them, as there are no mainstream frameworks for formal
verification of Python (though Nagini may be worth trying), but
instead by fuzzing with hypothesis as a property checker.

>>> from hypothesis import given
>>> from hypothesis.strategies import from_regex as regex, text

The regex producer outputs str instances, and we use it because
hypothesis does not allow us to use patterns or other smart generation
with only bytes. Therefore we use the smart str generators and then
convert the output to bytes using cp1252 or utf-8 encoding as
necessary.

>>> def cp1252(text: str) -> bytes:
...     return bytes(text, "cp1252")
>>> def utf8(text: str):
...     return bytes(text, "utf-8")

We'll also use our own decorator to make tests run automatically.

>>> def thesis(hypo, *args):
...     def decorator(func):
...         func = hypo(*args)(func)
...         func()
...         return func
...     return decorator

Since ``rfc5322_endings`` only converts endings, sequences containing
neither CR nor LF are unaffected.

>>> @thesis(given, regex(r"\A[^\r\n]*\Z"))
... def non_cr_lf_unaffected(text: str) -> None:
...     data: bytes = utf8(text)
...     assert data == rfc5322_endings(data), repr(data)

The algorithm is that any LF not preceded with CR will have one
inserted before it, and likewise for CR not followed by LF. Therefore
we expect the result to always have the same number of CR and LFs.

>>> @thesis(given, text(alphabet="\r\n."))
... def cr_lf_same_cardinality(text: str) -> None:
...     data: bytes = rfc5322_endings(utf8(text))
...     crs = data.count(b"\r")
...     lfs = data.count(b"\n")
...     assert crs == lfs, repr(data)

That the number of CRs or LFs will never be reduced.

>>> @thesis(given, text(alphabet="\r\n."))
... def cr_lf_no_reduce(text: str) -> None:
...     a: bytes = utf8(text)
...     b: bytes = rfc5322_endings(a)
...     assert b.count(b"\r") >= a.count(b"\r"), repr(data)
...     assert b.count(b"\n") >= a.count(b"\n"), repr(data)

That if we delete all CRLF subsequences, there will be no CR or LFs
remaining in the sequence.

>>> @thesis(given, text(alphabet="\r\n."))
... def only_crlf_subsequences(text: str) -> None:
...     data: bytes = rfc5322_endings(utf8(text))
...     data = data.replace(b"\r\n", b".")
...     assert data.count(b"\r") == 0, repr(data)
...     assert data.count(b"\n") == 0, repr(data)

That if we split on CR or LF sequences, the input and output will be
the same.

>>> @thesis(given, text(alphabet="\r\nabc. "))
... def non_crlf_subsequences(text: str) -> None:
...     def split(data: bytes):
...         data = data.replace(b"\r", b"\n")
...         while b"\n\n" in data:
...             data = data.replace(b"\n\n", b"\n")
...         return data.strip(b"\n").split(b"\n")
...     data: bytes = utf8(text)
...     expected = split(data)
...     normed: bytes = rfc5322_endings(data)
...     assert split(normed) == expected, repr(data)

And that all of this is equivalent to saying that every CR is now
followed by LF and every LF is preceded by CR.

>>> @thesis(given, text(alphabet="\r\n."))
... def cr_and_lf_pairs(text: str) -> None:
...     data: bytes = rfc5322_endings(utf8(text))
...     if b"\r" in data:
...         datum: bytes
...         for datum in data.split(b"\r")[1:]:
...             assert datum.startswith(b"\n"), repr(data)
...     if b"\n" in data:
...         datum: bytes
...         for datum in data.split(b"\n")[:-1]:
...             assert datum.endswith(b"\r"), repr(data)

Most importantly, the number of CRLFs in the output must be equal to
the number of CRLFs in the input, plus the number of individual CRs
and LFs once the CRLFs have been removed.

>>> @thesis(given, text(alphabet="\r\n."))
... def crlf_count(text: str) -> None:
...     nocrlf = text.replace("\r\n", "")
...     expected = text.count("\r\n")
...     expected += nocrlf.count("\r")
...     expected += nocrlf.count("\n")
...     data: bytes = rfc5322_endings(utf8(text))
...     assert data.count(b"\r\n") == expected, repr(text)

We'll now give a few examples. First, with no CR or LF.

>>> rfc5322_endings(b"")
b''
>>> rfc5322_endings(b"abc")
b'abc'

All of the following are equivalent to CRLF.

>>> rfc5322_endings(b"\r")
b'\r\n'
>>> rfc5322_endings(b"\n")
b'\r\n'
>>> rfc5322_endings(b"\r\n")
b'\r\n'

And the following are equivalent to CRLF CRLF.

>>> rfc5322_endings(b"\r\r")
b'\r\n\r\n'
>>> rfc5322_endings(b"\n\n")
b'\r\n\r\n'
>>> rfc5322_endings(b"\n\r")
b'\r\n\r\n'


DKIM relaxed head canonicalisation
----------------------------------

The next important component of DKIM-ID generation is DKIM head
canonicalisation using the relaxed canonicalisation algorithm. The
algorithm is not trivial, consisting of five separate steps:

  * Convert all header field names (not the header field values) to
    lowercase. For example, convert "SUBJect: AbC" to "subject: AbC".

  * Unfold all header field continuation lines as described in
    [RFC5322]; in particular, lines with terminators embedded in
    continued header field values (that is, CRLF sequences followed by
    WSP) MUST be interpreted without the CRLF. Implementations MUST
    NOT remove the CRLF at the end of the header field value.

  * Convert all sequences of one or more WSP characters to a single SP
    character. WSP characters here include those before and after a
    line folding boundary.

  * Delete all WSP characters at the end of each unfolded header field
    value.

  * Delete any WSP characters remaining before and after the colon
    separating the header field name from the header field value. The
    colon separator MUST be retained.

  https://tools.ietf.org/html/rfc6376#section-3.4.2

We'll use hypothesis to check each of these properties in turn. The
canonicalisation function is called ``rfc6376_relaxed_head``.

>>> from dkim_id import rfc6376_relaxed_head

And to test it, we'll need the lists producer from hypothesis.

>>> from hypothesis.strategies import lists
>>> chars = text(alphabet="\x00\t\r\n\f .ABCabc\xc0").map(cp1252)
>>> headers = lists(lists(chars, min_size=2, max_size=2))


Step one
~~~~~~~~

Step one is to convert header field names only to lowercase. Since
other normalisation steps will occur, to test it we need to take only
the alphabetical octets.

>>> def alphabetical(data: bytes) -> bytes:
...    from typing import Set
...    upper: bytes = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ"
...    alpha: Set[int] = set(upper + upper.lower())
...    return bytes([b for b in data if b in alpha])

Then we can make a direct comparison.

>>> @thesis(given, headers)
... def step_1_field_names_lower(headers) -> None:
...     ks = [alphabetical(kv[0]) for kv in headers]
...     for i, (k, v) in enumerate(rfc6376_relaxed_head(headers)):
...         assert ks[i].lower() == alphabetical(k), repr(headers)

Including that values use the same case.

>>> @thesis(given, headers)
... def step_1_field_values_case(headers) -> None:
...     vs = [kv[1] for kv in headers]
...     alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
...     cases = set(alpha + alpha.lower())
...     for i, (k, v) in enumerate(rfc6376_relaxed_head(headers)):
...         assert (set(vs[i]) & cases) == (set(v) & cases), repr(headers)


Step two
~~~~~~~~

Step two is to unfold continuations by removing CRLF except at the
end. This would only produce consistent results if the value is in
``rfc5322_endings`` normal form, so we extend the step to remove all
CR or LF, except for a trailing CRLF in the header field value.

>>> rfc6376_relaxed_head([[b"", b"\r"]])
[[b'', b'']]
>>> rfc6376_relaxed_head([[b"", b"\n"]])
[[b'', b'']]
>>> rfc6376_relaxed_head([[b"", b"\r\n"]])
[[b'', b'\r\n']]
>>> rfc6376_relaxed_head([[b"", b"...\r"]])
[[b'', b'...']]
>>> rfc6376_relaxed_head([[b"", b"...\n"]])
[[b'', b'...']]
>>> rfc6376_relaxed_head([[b"", b"...\r\n"]])
[[b'', b'...\r\n']]
>>> rfc6376_relaxed_head([[b"", b"a\rb\r\n"]])
[[b'', b'ab\r\n']]
>>> rfc6376_relaxed_head([[b"", b"a\nb\r\n"]])
[[b'', b'ab\r\n']]
>>> rfc6376_relaxed_head([[b"", b"a\r\nb\r\n"]])
[[b'', b'ab\r\n']]

We do this even though, for example, ``b"a\r\nb\r\n"`` is not a
possible header field value because the first CRLF is not followed by
a space or a tab, meaning that it is not a continuation.

We apply the CR and LF removal to header field names too, following
libopendkim, although ``rfc6376_relaxed_head`` should never encounter
CR or LF in a header field name during DKIM-ID generation. The removal
of CR and LF in header names includes CRLF at the end of a header
field name, unlike in a header field value where trailing CRLF is
retained.

>>> rfc6376_relaxed_head([[b"...\r\n", b""]])
[[b'...', b'']]

>>> header_text = (text(alphabet="\x00\t\r\n\f .ABCabc\xc0")
...     .map(cp1252)
...     .map(rfc5322_endings))
>>> wild_headers = lists(lists(header_text, min_size=2, max_size=2))

The ``wild_headers`` producer gives us headers which have not been
normalised, and can therefore be used to test the extended step,
e.g. for CR and LF deletion.

>>> @thesis(given, wild_headers)
... def step_2_cr_lf_deletion(headers) -> None:
...     for (k, v) in rfc6376_relaxed_head(headers):
...         assert b"\r" not in k, repr(headers)
...         assert b"\n" not in k, repr(headers)
...         if v.endswith(b"\r\n"):
...             v = v[:-2]
...         assert b"\r" not in v, repr(headers)
...         assert b"\n" not in v, repr(headers)

We can also test that any trailing CRLF in a header field value is
retained.

>>> @thesis(given, wild_headers)
... def step_2_field_values_trailing_crlf(headers) -> None:
...     vs = [kv[1] for kv in headers]
...     for i, (k, v) in enumerate(rfc6376_relaxed_head(headers)):
...         a = vs[i].endswith(b"\r\n")
...         b = v.endswith(b"\r\n")
...         assert a == b, repr(headers)


Step three
~~~~~~~~~~

Step three is to reduce all sequences of spaces or tabs to a single
space, i.e. all sequences that match ``[ \t]+`` must be replaced with
``" "``. The RFC sounds like it's saying that step three should be
applied to both names and values, but may regard the issue as moot
since WSP is not allowed in header names according to RFC 5322:

  [...] A field name MUST be composed of printable US-ASCII characters
  (i.e., characters that have values between 33 and 126, inclusive),
  except colon.

  https://tools.ietf.org/html/rfc5322#section-2.2

Since RFC 6376 says to convert to RFC 5322 normal form first, that
implies removing all characters outside of the range 33 to 126. It is
not clear that ignoring characters out of this range, e.g. converting
"T\\x00o" to "To", has no detrimental security properties. Neither RFC
4409 section 8 nor RFC 6376 section 3.8 and 8 discuss this issue. The
latter simply says that "Signers and Verifiers SHOULD take reasonable
steps to ensure that the messages they are processing are valid".

In any case, libopendkim also doesn't delete all characters outside
the range 33 to 126 in header field names. Instead, it deletes only
tab, CR, LF, and space. But RFC 6376 also says in step five to delete
"any WSP characters remaining before and after the colon", with
"remaining" being the operative word here. This suggests that it did
consider the earlier step three to apply to headers too, otherwise the
WSP characters would not be "remaining" ones. But if it considered the
earlier step three to apply to header field names, then it must also
consider that there may be spaces and tabs inside header field names
even after RFC 5322 normalisation. Hence, we consider that RFC 6376 is
primarily suggesting to apply RFC 5322 *line ending* normalisation,
which notably it introduces by saying "in particular" in section
5.3. We also consider that it suggests reducing spaces and tabs to a
single space in step three, answering the question of what to do with
"T o" (it remains "T o") and "T\\x00o" (it remains "T\\x00o").

In summary, we follow RFC 6376 as literally as possible, contrary to
libopendkim in this case, and apply step three to header field names.

>>> rfc6376_relaxed_head([[b"Spaced \t  \t\tKey", b"Value\r\n"]])
[[b'spaced key', b'Value\r\n']]

With this, ``rfc6376_relaxed_head`` accepts arbitrary bytes for names
and values, and deals with them in a consistent and considered way,
including tab and space other values outside 33 to 126. This also
includes retaining colon and semicolon, even though they are
problematic in DKIM signing.

>>> rfc6376_relaxed_head([[b":", b"Value\r\n"]])
[[b':', b'Value\r\n']]
>>> rfc6376_relaxed_head([[b";", b"Value\r\n"]])
[[b';', b'Value\r\n']]

In the component of the DKIM-ID generator which uses header
canonicalisation it's impossible for it to have colon in the header
name, but it is possible for it to have semicolon. Such a header could
not be signed using DKIM as it uses semicolon as the separator in the
list of headers which have been signed, but it will be ignored in
DKIM-ID generation as long as the defaults are followed or ``";"`` is
not manually specified as a subset header to keep. Another problematic
header which is possible is the empty header. The case of a header
name starting with WSP also doesn't arise, because such lines are
continuation lines.

Overall, there should never be a tab in canonicalised header field
names and values, and there should never be a double space in
canonicalised header field names and values.

>>> @thesis(given, wild_headers)
... def step_3_field_values(headers) -> None:
...     for (k, v) in rfc6376_relaxed_head(headers):
...         assert b"\t" not in k, repr(headers)
...         assert b"\t" not in v, repr(headers)
...         assert b"  " not in k, repr(headers)
...         assert b"  " not in v, repr(headers)

Internally, the function that performs this step is called
``rfc6376_shrink_head``.

>>> from dkim_id import rfc6376_shrink_head

And it should work like a more efficient version of iteratively
removing double spaces, except that it also strips leading and
trailing whitespace, which is for steps four and five.

>>> @thesis(given, wild_headers)
... def step_3_reduce_iterative(headers) -> None:
...     for (k, v) in headers:
...         kk = k.replace(b"\t", b" ")
...         vv = v.replace(b"\t", b" ")
...         while b"  " in kk:
...             kk = kk.replace(b"  ", b" ")
...         kk = kk.strip(b" ")
...         while b"  " in vv:
...             vv = vv.replace(b"  ", b" ")
...         vv = vv.strip(b" ")
...         assert rfc6376_shrink_head(k) == kk, repr(k)
...         assert rfc6376_shrink_head(v) == vv, repr(v)

This also means that leading whitespace is removed from the beginnings
of header names. Again this is not a case which could occur during
DKIM-ID generation, in this case because such a name would have been
regarded as a continuation, even at the beginning of a message where
it is regarded as the continuation of the empty name.

>>> rfc6376_relaxed_head([[b" Key", b"Value\r\n"]])
[[b'key', b'Value\r\n']]


Step four
~~~~~~~~~

Step four says that spaces and tabs at the end of a header field value
are removed.

It is possible to give a header field value without a trailing CRLF to
``rfc6376_relaxed_head``, and so any trailing tabs or spaces there
must be removed.

>>> rfc6376_relaxed_head([[b"", b"Value\t "]])
[[b'', b'Value']]

But the RFC 5322 message grammar states that all headers shall end
with CRLF. An overly literal reading of RFC 6376 therefore implies
that spaces and tabs are never removed from the end of a field value,
because the value must always end with CRLF according to RFC 5322. But
if they were never removed then there would be no need for the step,
so the implication is that the "end" for the purposes of this step is
before the trailing CRLF.

A reading of ``dkim_canon_header_string`` in libopendkim suggests that
it could leave a header ending with space CRLF, but this hasn't been
tested. We remove the space correctly.

>>> rfc6376_relaxed_head([[b"Key", b"Value \r\n"]])
[[b'key', b'Value\r\n']]

Indeed, a header field value must never end with space or tab.

>>> @thesis(given, wild_headers)
... def step_4_field_values_ends(headers) -> None:
...     for (k, v) in rfc6376_relaxed_head(headers):
...         assert not v.endswith(b" "), repr(headers)
...         assert not v.endswith(b"\t"), repr(headers)

And must never end with space CRLF or tab CRLF.

>>> @thesis(given, wild_headers)
... def step_4_field_values_ends_2(headers) -> None:
...     for (k, v) in rfc6376_relaxed_head(headers):
...         assert not v.endswith(b" \r\n"), repr(headers)
...         assert not v.endswith(b"\t\r\n"), repr(headers)

Indeed, it should never be possible to contain, let alone end, with a
tab anyway after step three since that replaces all sequences of
spaces and tabs with a single space, leaving no tabs at all in the
output before it reaches step four.


Step five
~~~~~~~~~

Step five is to remove spaces and tabs from the end of header names,
and from the start of header values. Again, all tabs should have been
removed anyway in step three, so this step could have specified only
removing spaces.

>>> @thesis(given, wild_headers)
... def step_5_wsp_around_colon(headers) -> None:
...     for (k, v) in rfc6376_relaxed_head(headers):
...         assert not k.endswith(b" "), repr(headers)
...         assert not k.endswith(b"\t"), repr(headers)
...         assert not v.startswith(b" "), repr(headers)
...         assert not v.startswith(b"\t"), repr(headers)


General properties
~~~~~~~~~~~~~~~~~~

We can combine headers in order to check their size.

>>> from dkim_id import rfc6376_join

This can be used to test one of the general properties of
``rfc6376_relaxed_head``, that it never enlarges the data given to it.

>>> @thesis(given, wild_headers)
... def head_never_enlarged(headers) -> None:
...     a: bytes = rfc6376_join(headers)
...     h: List[List[bytes]] = rfc6376_relaxed_head(headers)
...     b: bytes = rfc6376_join(h)
...     assert len(a) >= len(b), repr(headers)

Perhaps the most important general property of canonicalisation is
that once canonicalised, attempting to canonicalise again produces the
same data. In other words canonicalisation is absolute, and data
cannot be canonicalised further.

>>> @thesis(given, wild_headers)
... def recanonicalisation_is_identity(headers) -> None:
...     a = rfc6376_relaxed_head(headers)
...     b = rfc6376_relaxed_head(a)
...     assert a == b, repr(headers)


Simple body canonicalisation
----------------------------

The body canonicalisation function is called ``rfc6376_simple_body``.

>>> from dkim_id import rfc6376_simple_body

It maps an empty body to CRLF, and then ensures that there is at most
one CRLF at the end of the body. Therefore, a consequence is that it
ensures that the output is never empty.

>>> @thesis(given, chars)
... def body_not_empty(body) -> None:
...     body_c = rfc6376_simple_body(body)
...     assert len(body_c) > 0, repr(body)

And that the output never ends CRLF CRLF.

>>> @thesis(given, chars)
... def body_no_trailing_crlfcrlf(body) -> None:
...     body_c = rfc6376_simple_body(body)
...     assert not body_c.endswith(b"\r\n\r\n") > 0, repr(body)

But it could end non-CR LF CRLF, or CR CRLF if the input were not RFC
5322 ending normalised.

>>> rfc6376_simple_body(b"Non-CR\n\r\n")
b'Non-CR\n\r\n'
>>> rfc6376_simple_body(b"CR\r\r\n")
b'CR\r\r\n'

The function enlarges data only when its input is empty.

>>> @thesis(given, chars.filter(lambda b: b != b""))
... def body_enlarging_edge(body) -> None:
...     body_c = rfc6376_simple_body(body)
...     assert len(body_c) <= len(body), repr(body)

The prefix of the output up to any trailing CRLF the shared by the input.

>>> @thesis(given, chars)
... def body_same_prefix(body) -> None:
...     body_c = rfc6376_simple_body(body)
...     size_c = len(body_c)
...     if body_c.endswith(b"\r\n"):
...         size_c -= 2
...     assert body[:size_c] == body_c[:size_c], repr(body)

And any remainder must consist solely of CRLFs in both input and output.

>>> @thesis(given, chars)
... def body_suffix_crlfs(body) -> None:
...     body_c = rfc6376_simple_body(body)
...     size_c = len(body_c)
...     if body_c.endswith(b"\r\n"):
...         size_c -= 2
...     assert not body[size_c:].replace(b"\r\n", b""), repr(body)
...     assert not body_c[size_c:].replace(b"\r\n", b""), repr(body)


Splitting
---------

The main parser is called ``rfc6376_split``.

>>> from dkim_id import rfc6376_split

It does not perform canonicalisation. If there is no CRLF header and
body boundary separator, then it returns None for the body.

Each header field is defined by RFC 5322 as ending with CRLF which is
inclusive to that header field. Any CRLF following that indicates the
start of a body, which may be empty. Therefore, in the case of the
empty document there are no headers and no body.

>>> rfc6376_split(b"")
([], None)

In the case of just CRLF there are no headers, since they must contain
at least one character before their CRLF. RFC 5322 section 2.2 says
that header fields "are lines beginning with a field name, followed by
a colon", which implies at least the presence of a colon, and section
3.6.8 says "field-name = 1*ftext" which means the name must include at
least one printable character. As there is nothing after the CRLF in
the case of just a CRLF, there is an empty body.

>>> rfc6376_split(b"\r\n")
([], b'')

In the case of CRLF CRLF there are no headers, and there is a body
which is CRLF.

>>> rfc6376_split(b"\r\n\r\n")
([], b'\r\n')

And then this pattern repeats.

>>> rfc6376_split(b"\r\n\r\n\r\n")
([], b'\r\n\r\n')
>>> rfc6376_split(b"\r\n\r\n\r\n\r\n")
([], b'\r\n\r\n\r\n')

When we have a header, a single trailing CRLF is regarded as part of
that header. This means that there is no body.

>>> rfc6376_split(b"Key:Value\r\n")
([[b'Key', b'Value\r\n']], None)

But appending another CRLF to that gives an empty body.

>>> rfc6376_split(b"Key:Value\r\n\r\n")
([[b'Key', b'Value\r\n']], b'')

As ``rfc6376_split`` does not perform canonicalisation, we have the
edge cases of isolated CRs and LFs. There should never be isolated CRs
and LFs in DKIM-ID generation because RFC 5322 ending normalisation is
applied before splitting, but in such cases where the function is
called with isolated CRs and LFs they are considered as header field
name or header field value data.

>>> rfc6376_split(b"\r")
([[b'\r', b'']], None)
>>> rfc6376_split(b"\n")
([[b'\n', b'']], None)
>>> rfc6376_split(b"\n\r\n")
([[b'\n', b'\r\n']], None)
>>> rfc6376_split(b"\r\r\n")
([[b'\r', b'\r\n']], None)
>>> rfc6376_split(b"\r...\r\n")
([[b'\r...', b'\r\n']], None)
>>> rfc6376_split(b"\n...\r\n")
([[b'\n...', b'\r\n']], None)
>>> rfc6376_split(b"\n:\n\r\n")
([[b'\n', b'\n\r\n']], None)
>>> rfc6376_split(b"\n...:\n...\r\n")
([[b'\n...', b'\n...\r\n']], None)

A header field name without any header field value is just regarded as
being the same as one with an empty value.

>>> rfc6376_split(b"Key\r\n\r\n")
([[b'Key', b'\r\n']], b'')
>>> rfc6376_split(b"Key:\r\n\r\n")
([[b'Key', b'\r\n']], b'')

For greater consistency with how bodies are handled, the former could
have been interpreted as ``[b'Key', None]``, but this would increase
the complexity of the code, and lead to the question of where the
trailing CRLF ought to be stored.

In some cases, one of the mbox formats may accidentally be passed to
``rfc6376_split``, containing a line like this in its headers, usually
at the start but potentially later in the headers too:

  "From MAILER-DAEMON Fri Jul  8 12:08:34 2011"

Which would be interpreted as a header field whose name is:

  "From MAILER-DAEMON Fri Jul  8 12"

And which could also collect any following continuation line.

>>> rfc6376_split(b"To:You\r\nFrom Me\r\n More\r\n")
([[b'To', b'You\r\n'], [b'From Me', b'\r\n More\r\n']], None)

This is safe because even after canonicalisation it is not possible to
confuse a ``"From "`` line with a ``"From:"`` header field, unless no
text follows the ``"From "`` and it is followed by a continuation. If
no text follows the ``"From "`` then it is not in one of the mbox
formats anyway. And if it is followed by a continuation, then
interpreting it as a From header field is reasonable.

Similarly to a name without a value, a continuation value without a
preceding line is treated as though the header field name is empty.

>>> rfc6376_split(b" More\r\n")
([[b'', b' More\r\n']], None)

An alternative to this would be to treat the line itself as a header
field name, but then that creates the issue of whether to remove the
leading whitespace, and whether to parse a colon in it. It would also
make it inconsistent with all other field names, which must not start
with a space.

The type of the body, the second element of the tuple returned from
``rfc6376_split``, directly correlates to whether the input starts
with CRLF or whether CRLF CRLF occurs in the input. If it does so,
then we say that the input message contains a header and body
boundary.

>>> def contains_boundary(data: bytes) -> bool:
...     return data.startswith(b"\r\n") or (b"\r\n\r\n" in data)

We use a simple subset of all possible inputs to check this
correlation.

>>> text_message = (text(alphabet="\x00\t\r\n\f .:ABCabc\xc0")
...     .map(cp1252))

Although ``rfc6376_split`` should always take input in RFC 5322 ending
normal form, we test without that normal form.

>>> @thesis(given, text_message)
... def body_type_correlation(data) -> None:
...     headers, body = rfc6376_split(data)
...     body_not_none = (body is not None)
...     assert contains_boundary(data) is body_not_none, repr(data)

If the input is not RFC 5322 normalised, then CR and LF can appear in
header field names, as already demonstrated. Colon, however, should
never appear in a header field name.

>>> @thesis(given, text_message)
... def no_split_colon(data) -> None:
...     headers, body = rfc6376_split(data)
...     for (k, v) in headers:
...         assert b":" not in k, repr(data)

And if the input is RFC 5322 normalised, then colon, CR, and LF should
never appear in header field names.

>>> @thesis(given, text_message)
... def no_normal_split_chars(data) -> None:
...     data = rfc5322_endings(data)
...     headers, body = rfc6376_split(data)
...     for (k, v) in headers:
...         assert b":" not in k, repr(data)
...         assert b"\r" not in k, repr(data)
...         assert b"\n" not in k, repr(data)


Canonicalised splitting
-----------------------

The version of the main parser which performs canonicalisation is
called ``rfc6376_split_canon``.

>>> from dkim_id import rfc6376_split_canon

It takes ``head_subset``, ``head_canon``, and ``body_canon``
arguments. The first is a set of bytes, lower case header field names
to keep when parsing the headers. If ``head_subset`` is None, all
headers are retained, which is useful for testing. The second is a
boolean of whether to apply ``rfc6376_relaxed_head``, and the third is
a boolean of whether to apply ``rfc6376_simple_body`` and potentially
modify the headers too for consistency.

If there was no body, i.e. no header body boundary CRLF in the
message, then the returned body should be ``None`` rather than
``b""``.

>>> @thesis(given, text_message)
... def body_none(message) -> None:
...     boundary = contains_boundary(rfc5322_endings(message))
...     headers, body = rfc6376_split_canon(message)
...     assert boundary is (body is not None), repr(message)

We can perform the canonicalisation steps ourselves. We need to import
``rfc6376_simple_holistic``, which ensures that headers are augmented
with CRLF if necessary when there is either no body or an empty body
but body canonicalisation synthesizes one.

>>> from dkim_id import rfc6376_simple_holistic

And then DKIM relaxed/simple can be applied consistently.

>>> @thesis(given, text_message)
... def manual_canon(message) -> None:
...     # uc = uncanonicalised, ec = expected canon, ac = actual canon
...     headers_uc, body_uc = rfc6376_split_canon(message)
...     headers_ec, body_ec = rfc6376_split_canon(message,
...         head_canon=True, body_canon=True)
...     headers_ac = rfc6376_relaxed_head(headers_uc)
...     headers_ac, body_ac = rfc6376_simple_holistic(headers_ac, body_uc)
...     assert headers_ac == headers_ec, repr(message)
...     assert body_ac == body_ec, repr(message)

The header and body canonicalisation steps are optional. Even when
retaining all headers (which is the default) and performing neither
kind of canonicalisation (which is also the default), the input
message is not necessarily the same as the output message, whether RFC
5322 normalisation were performed or not. This is because, for
example, the construction of broken headers, i.e. those without
colons, is fixed in the process.

>>> rfc6376_split_canon(b"Key")
([[b'Key', b'']], None)
>>> rfc6376_join(*rfc6376_split_canon(b"Key"))
b'Key:'


Reformation
-----------

We call the process of splitting and then joining "reforming". There
is a function called ``rfc6376_reformed`` that performs this.

>>> from dkim_id import rfc6376_reformed

Then ``rfc6376_reformed`` should be exactly equivalent to using
``rfc6376_split`` and then ``rfc6376_join``.

>>> @thesis(given, text_message)
... def normal(message) -> None:
...     a = rfc6376_join(*rfc6376_split(message))
...     b = rfc6376_reformed(message)
...     assert a == b, repr(message)


Canonicalised reformation
-------------------------

We can use ``rfc6376_reformed_canon`` to canonicalise a message whilst
reforming it.

>>> from dkim_id import rfc6376_reformed_canon

Then if we make our own headers, canonicalise them, and then join
them, we should always get a canonicalised message.

>>> @thesis(given, headers)
... def more_manual_canon(headers) -> None:
...     headers_c = rfc6376_relaxed_head(headers)
...     message_c = rfc6376_join(headers_c)
...     assert message_c == rfc6376_reformed_canon(message_c,
...         head_canon=True, body_canon=False), repr(message_c)


Rascals
-------

DKIM-ID generation uses the standard ``rfc6376_reformed_canon`` call
with ``rfc4871_subset`` headers and both head and body
canonicalised. We refer to this combination as *reformed and
relaxed/simple canonicalisation*, or just "rascal" for short. The
function that performs this is called ``rfc6376_rascal``.

>>> from dkim_id import rfc6376_rascal

A missing or empty body is encoded, per RFC 6376 simple body
canonicalisation, as CRLF. We always perform body canonicalisation if
``body_canon`` is ``True``, which means that even if there is no body
(i.e. there was no header and body boundary in the original) there
will always be body canonicalisation, which means that the body will
always be non-empty, and will always be appended by ``rfc6376_join``
after the header and body separator CRLF. This means that there will
always be a header and body boundary in the rascal output.

>>> @thesis(given, text_message)
... def rascal_contains_boundary(data) -> None:
...     rascal = rfc6376_rascal(data)
...     assert contains_boundary(rascal), repr(data)

In particular, it means that the empty input document will become CRLF
CRLF, which is the header and body separator CRLF followed by the
canonicalised empty body CRLF. Two CRLFs, but with completely
different roles.

>>> rfc6376_rascal(b"")
b'\r\n\r\n'

And, because trailing CRs or LFs are RFC 5322 ending normalised and
then canonicalised to a single CRLF, it means that any sequence of CRs
or LFs will be rascaled to CRLF CRLF too.

>>> @thesis(given, text(alphabet="\r\n").map(utf8))
... def normal_crlfs_to_crlf2(data) -> None:
...     rascal = rfc6376_rascal(data)
...     assert rascal == b"\r\n\r\n", repr(data)

Since the input is considered to be a message, arbitrary text without
metacharacters will usually be regarded as a discardable header field.

>>> rfc6376_rascal(b"Text")
b'\r\n\r\n'

This is true even when colon is included, as long as the prefix is not
one of the standard header field names in ``rfc4871_subset``.

>>> rfc6376_rascal(b"Discarded: Value")
b'\r\n\r\n'

But if the header is in the subset, it will indeed be retained. In
this case, holistic canonicalisation ensures that CRLF is appended to
the header too.

>>> rfc6376_rascal(b"To: Recipient")
b'to:Recipient\r\n\r\n\r\n'

In other words this is a header field ``b'to:Recipient\r\n'``,
followed by a CRLF header and body boundary, followed by the CRLF of
the canonicalised missing body.

If there is no header value for a subset header, then it is treated as
if the header value were empty.

>>> rfc6376_rascal(b"To")
b'to:\r\n\r\n\r\n'
>>> rfc6376_rascal(b"To:")
b'to:\r\n\r\n\r\n'

RFC 6376 says that canonicalisation should, obviously, come before
signing.

  Canonicalization simply prepares the email for presentation to the
  signing or verification algorithm.

  https://tools.ietf.org/html/rfc6376#section-3.4

But a more subtle consequence of this is that subsetting headers also
comes after canonicalisation, because subsetting is not part of
canonicalisation - it's part of signing.

This is important in our expansion of the RFC 6376 algorithm to cover
all inputs because e.g. it means that header field names with trailing
whitespace are treated the same as without that whitespace.

>>> rfc6376_rascal(b"To   \n")
b'to:\r\n\r\n\r\n'

But a header name with whitespace inside it is not, unlike in the
libopendkim algorithm, treated the same as one without whitespace
inside it, for reasons already discussed in the documentation of RFC
6376 header canonicalisation step three.

>>> rfc6376_rascal(b"T o\n")
b'\r\n\r\n'


Header subsetting
-----------------

We use a subset of headers specified in RFC 4871. We use RFC 4871 even
though it was obsoleted by RFC 6376 because the earlier RFC has a more
extensive list of headers, and the later RFC says anyway that the
choice of which headers to include is a matter of choice dependent on
the signing environment. Since DKIM-ID generation does not even
include signing, our requirements are somewhat different anyway.

>>> from dkim_id import rfc4871_subset

Whenever the ``rfc4871_subset`` headers are specified as the subset to
be retained, they should indeed be retained in the output of
``rfc6376_rascal``.

>>> for k in rfc4871_subset:
...     minimal = k + b":\r\n\r\n\r\n"
...     assert minimal == rfc6376_rascal(minimal), repr(minimal)

Though the subset is loosely called the "RFC 4871 subset", there is
one header in ``rfc4871_subset`` which RFC 4871 doesn't recommend:
DKIM-Signature itself.

>>> b"dkim-signature" in rfc4871_subset
True

We include the DKIM-Signature header field in the subset of retained
headers because then if the sender has signed their message it ought
to be reflected in the identifier for that message. It would not have
made sense for RFC 4817 to recommend that header field for signing
input, because it is itself the signing output! But if, for example,
there were an widely implemented RFC specifying a precursor to DKIM
which was later superseded by DKIM, it is reasonable to assume that
RFC 4817 would have recommended including the output of the precursor
in the headers to sign, combining the two approaches. Similarly, since
DKIM is a precursor to DKIM-ID, DKIM-ID is able to include its output
as an input.


Custom base32 encoding
----------------------

When we have a canonicalised message with subsetted headers, we take
the SHAKE-128 digest of that message and then encode it using
pibble32, which is base32 with the alphabet ``0-9 b-d f-h j-t v-z``,
and remove the padding.

>>> from dkim_id import pibble32

The alphabet used means that the pibble32 output is always lowercase,
and never contains the letters a, e, i, or u.

We need the binary producer from hypothesis.

>>> from hypothesis.strategies import binary

And then we can test these general properties.

>>> @thesis(given, binary())
... def pibble32_general(data) -> None:
...     encoded = pibble32(data)
...     assert encoded == encoded.lower(), repr(data)
...     encoded_set = set(encoded)
...     assert not (encoded_set & {"a", "e", "i", "u"}), repr(data)

There may be padding, but only when the data length is not divisible
by five.

>>> @thesis(given, binary())
... def pibble32_padding(data) -> None:
...     encoded = pibble32(data)
...     no_padding = not encoded.endswith("=")
...     divisible_by_five = not (len(data) % 5)
...     assert no_padding is divisible_by_five, repr(data)

We strip the padding on the DKIM-ID since it is fixed at a width of
128 bits, and the pibble32 output is byte aligned anyway, i.e. the
decoder accepts no other padding than "======".

The length of the pibble32 output will always be the same as when
base32 encoding it.

>>> @thesis(given, binary())
... def pibble32_length(data) -> None:
...     from base64 import b32encode
...     assert len(pibble32(data)) == len(b32encode(data)), repr(data)

Here are a some specific examples:

>>> pibble32(b"")
''
>>> pibble32(b"\x00")
'00======'
>>> pibble32(b"\x01")
'04======'
>>> pibble32(b"\x02")
'08======'
>>> pibble32(b"\xff")
'zw======'
>>> pibble32(b"\x00\x00\x00\x00\x00")
'00000000'
>>> pibble32(b"\x00\x00\x01\x00\x00")
'00002000'
>>> pibble32(b"\x00\x00\x02\x00\x00")
'00004000'
>>> pibble32(b"\x00\x00\xff\x00\x00")
'000hy000'
>>> pibble32(b"\x00\x00\xff\xff\x00")
'000hzzr0'
>>> pibble32(b"\xff\xff\xff\xff\xff")
'zzzzzzzz'

When the input length is divisible by five, the output length is
always 8 / 5 of that length.

>>> @thesis(given, binary())
... def pibble32_eight_fifths(data) -> None:
...     size = len(data)
...     resized = size - (size % 5)
...     fives = data[:resized]
...     assert len(pibble32(fives)) == (resized * 8 / 5), repr(data)

And when it's not divisible by five, the length is rounded up to the
next number divisible by five. This means that 128 bits of input is
rounded up to 130 bits, which is then multiplied by 8 / 5, which gives
208 bits, or 26 bytes, of output.

>>> 130 * 8 // 5
208
>>> 208 // 8
26


DKIM-ID generation
------------------

Once the rascaled version of the message is obtained, it it hashed and
then pibble32 encoded to form the DKIM-ID. We want to check that the
output is pibble32 encoded, at least in that its length is correct and
its alphabet is a subset of what is expected.

>>> digit = "0123456789"
>>> lower = "abcdefghijklmnopqrstuvwxyz"
>>> pibble32_alphabet = (set(digit) | set(lower)) - {"a", "e", "i", "u"}

We guard against typos in the alphabet by testing expected properties,
first by checking the digits.

>>> assert len(digit) == 10
>>> assert len(set(digit)) == 10
>>> assert list(digit) == sorted(list(digit))
>>> assert digit.isdigit()

Then the lowercase letters.

>>> assert len(lower) == 26
>>> assert len(set(lower)) == 26
>>> assert list(lower) == sorted(list(lower))
>>> assert lower.isalpha()

And then the whole alphabet.

>>> assert len(pibble32_alphabet) == 32

Now we can test the DKIM-ID output, from function ``dkim_id``.

>>> from dkim_id import dkim_id

By checking that its output is consistent with the pibble32 encoding.

>>> @thesis(given, text_message)
... def consistent_output(data) -> None:
...     dkimid: str = dkim_id(data)
...     assert len(dkimid) == 26, repr(data)
...     assert not (set(dkimid) - pibble32_alphabet), repr(data)

We can also check that the unpibbled output is the same as the
SHAKE-128 of the rascal.

>>> from dkim_id import unpibble32
>>> from hashlib import shake_128

We have to restore the `======` padding before converting back to a
digest.

>>> @thesis(given, text_message)
... def check_hash_digest(data) -> None:
...     rascal: bytes = rfc6376_rascal(data)
...     digest_e: bytes = shake_128(rascal).digest(128 // 8)
...     dkimid: str = dkim_id(data)
...     digest_a: bytes = unpibble32(dkimid + "======")
...     assert digest_a == digest_e, repr(data)

And here are some example outputs for some simple messages.

>>> dkim_id(b"")
'nmh143z8mjhb40j0mtksl7dhq8'
>>> dkim_id(b"To: You")
'b26xtf0xw4xoh9gplco38rmwr0'
>>> dkim_id(b"To: You\r\n")
'b26xtf0xw4xoh9gplco38rmwr0'
>>> dkim_id(b"To: You\r\nFrom: Me")
's80q08hkykh0hyloynx0opxk6w'
>>> dkim_id(b"To: You\r\nFrom: Me\r\n\r\nBody")
'l2mfd9jzgxrbf7mrg14j1kryrr'
>>> dkim_id(b"To: You\r\nFrom: Me\r\n\r\nBody\r\n")
'vwv0orp5kv3h6g0khv46xzswb0'
"""

from typing import Dict, List, Optional, Set, Tuple

import dkim_id

pools: Dict[Tuple[str, bytes], Set[bytes]] = {
    ("0nfrfksd5p29q1lfq5kbnsnmzn", b"to:Value\r\n\r\n."): {
        b"To: Value\r\n\n.",
        b"To: Value\r\n\r.",
        b"To: Value\r\n\r\n.",
    },
    ("79yo7ldw76yblkqs36y3gyncl8", b"to:Value\r\nto:Value\r\n\r\n\r\n"): {
        b"To: Value\r\nTo: Value",
        b"To: Value\rTo: Value",
        b"To: Value\nTo: Value",
    },
    (
        "cwpdkxzf864k5brxqbpr5kpyxr",
        b"to:Value\r\nfrom:Value (1)\r\n\r\n\r\n",
    ): {
        b"To: Value\rFrom: Value (1)",
        b"To: Value\nFrom: Value (1)",
        b"To: Value\r\nFrom: Value (1)",
    },
    ("lpw8jdrhsyly95l179rc7z6o38", b"to:Value\r\n\r\nFrom: Value (2)"): {
        b"To: Value\n\rFrom: Value (2)",
        b"To: Value\n\nFrom: Value (2)",
        b"To: Value\r\rFrom: Value (2)",
    },
    ("mgrvn590sm1tb867myjr4163f0", b"to:Value\r\n\r\nTo: Value"): {
        b"To: Value\r\n\nTo: Value",
        b"To: Value\r\n\rTo: Value",
        b"To: Value\r\n\r\nTo: Value",
    },
    ("v22szt15zzykz8vs33y338427n", b"to:Value\r\n\r\n.\r\n"): {
        b"To: Value\r\n\n.\n",
        b"To: Value\r\n\r.\r",
        b"To: Value\r\n\n.\r",
        b"To: Value\r\n\r.\n",
        b"To: Value\r\n\r\n.\r",
        b"To: Value\r\n\r\n.\n",
    },
    ("wbrcglsk0p4lxsrzznd8wqcqp4", b"to:Value\r\n\r\n\r\n"): {
        b"To: Value\r\n\r\n\r\n",
        b"To: Value\n",
        b"To: Value\r\n\r\n\r\r",
        b"To: Value\n.",
        b"To: Value\r\n.\r",
        b"To: Value\r\n\r\n\r",
        b"To: Value\r\n.\n",
        b"To: Value\r\n\n",
        b"To: Value\r.\n",
        b"To: Value\r\n\r\n\n",
        b"To: Value\r\n\r\n\n\n",
        b"To: Value\r\n",
        b"To: Value",
        b"To: Value\n.\n",
        b"To: Value\r\n\r",
        b"To: Value\r\n.",
        b"To: Value\n.\r",
        b"To: Value\r.\r",
        b"To: Value\r\n\r\n\n\r",
        b"To: Value\r",
        b"To: Value\r.",
    },
}

Parsed = Tuple[List[List[bytes]], bytes]
parses: Dict[str, Tuple[Parsed, Parsed]] = {
    " starts with continuation\nTo: Value\n\nBody": (
        ([[b"To", b" Value\r\n"]], b"Body"),
        ([[b"to", b"Value\r\n"]], b"Body"),
    ),
    "To: Value\n Continuation\n\nBody": (
        ([[b"To", b" Value\r\n Continuation\r\n"]], b"Body"),
        ([[b"to", b"Value Continuation\r\n"]], b"Body"),
    ),
    "To: Value\n\tTab Continuation\n\nBody": (
        ([[b"To", b" Value\r\n\tTab Continuation\r\n"]], b"Body"),
        ([[b"to", b"Value Tab Continuation\r\n"]], b"Body"),
    ),
    "To: Value\n\fNon-Continuation\n\nBody": (
        (
            [[b"To", b" Value\r\n"], [b"\x0cNon-Continuation\r\n", b""]],
            b"Body",
        ),
        ([[b"to", b"Value\r\n"], [b"\x0cnon-continuation", b""]], b"Body"),
    ),
    "To: Value\n\nBody Three LF\n\n\n": (
        ([[b"To", b" Value\r\n"]], b"Body Three LF\r\n\r\n\r\n"),
        ([[b"to", b"Value\r\n"]], b"Body Three LF\r\n"),
    ),
}


def doctests() -> None:
    from doctest import ELLIPSIS, testmod

    testmod(dkim_id, optionflags=ELLIPSIS)
    testmod(__import__("generators"), optionflags=ELLIPSIS)
    testmod(optionflags=ELLIPSIS)


def main() -> None:
    from os import environ

    # from pprint import pprint
    from hypothesis import given
    from hypothesis.strategies import text

    if "HTML" in environ:
        import sys

        import docutils.core

        data = docutils.core.publish_string(__doc__, writer_name="html")
        sys.stdout.buffer.write(data)
        return

    def libopendkim_normal(text: str) -> str:
        i: int = 0
        j: Optional[int] = None
        end: int = len(text) - 1
        result: List[str] = []
        while i <= end:
            prev: str
            if j is None:
                prev = "\0x00"
            else:
                prev = text[j]
            if (text[i] == "\n") and (prev != "\r"):
                result.append("\r\n")
            elif (prev == "\r") and (text[i] != "\n"):
                result.append("\n")
                result.append(text[i])
            else:
                result.append(text[i])
            i += 1
            j = i - 1
        if j is not None:
            if text[j] == "\r":
                result.append("\n")
        return "".join(result)

    # We use text because its alphabet can be constrained
    @given(text(alphabet="\t\r\n\f:."))
    def test_normal_equality(text: str) -> None:
        a: bytes = bytes(libopendkim_normal(text), "ascii")
        b: bytes = dkim_id.rfc5322_endings(bytes(text, "ascii"))
        assert a == b, repr(text)

    test_normal_equality()

    pid: str
    msg: bytes
    if False:
        pooled: Dict[Tuple[str, bytes], Set[bytes]] = {}
        for pid in pools:
            for msg in pools[pid]:
                got: str = dkim_id.dkim_id(msg)
                ras: bytes = dkim_id.rfc6376_rascal(msg)
                if (got, ras) not in pooled:
                    pooled[(got, ras)] = set()
                pooled[(got, ras)].add(msg)
        print("{")
        for key in sorted(pooled):
            print(repr(key) + ":", pooled[key], end=",\n")
        print("}")
        return
    for (pid, rascal) in pools:
        for msg in pools[(pid, rascal)]:
            pid_: str = dkim_id.dkim_id(msg)
            rascal_: bytes = dkim_id.rfc6376_rascal(msg)
            assert pid == pid_
            assert rascal == rascal_

    doctests()
    print("ok")


if __name__ == "__main__":
    main()
