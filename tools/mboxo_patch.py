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
Byte stream reader to process mboxo style mailbox files.
These are not currently handled by the Python email package.

It replaces any occurrence of b'\n>From ' with b'\nFrom '

The class handles matching across read boundaries.

To use:

from mboxo_patch import MboxoFactory
...
messages = mailbox.mbox(filename, MboxoFactory)
"""
import mailbox

FROM_MANGLED  =b'\n>From '
FROM_MANGLED_LEN=len(FROM_MANGLED)
FROM_UNMANGLED=b'\nFrom '
# We want to match the 7 bytes b'\n>From ' in the input stream
# However this can be split over multiple reads.
# The split can occur anywhere after the leading b'\n'
# and the trailing b' '. If we match any of these
# we keep the trailing part of the buffer for next time
# The following are all the possible prefixes for a split:
FROMS=(FROM_MANGLED[:-1],
       FROM_MANGLED[:-2],
       FROM_MANGLED[:-3],
       FROM_MANGLED[:-4],
       FROM_MANGLED[:-5],
       FROM_MANGLED[:-6],
       )

class MboxoReader(mailbox._PartialFile):
    def __init__(self, f, start=None, stop=None):
        self.remain=0 # number of bytes to keep for next read
        super().__init__(f._file, start=f._start, stop=f._stop)

    # Override the read method to provide mboxo filtering
    def _read(self, size, read_method):
        # get the next chunk, resetting if necessary 
        if self.remain != 0:
            super().seek(whence=1, offset=-self.remain)
        # ensure we get enough to match successfully when refilling
        # size can be None; assume large enough if so
        if size:
            size = size if size > FROM_MANGLED_LEN else FROM_MANGLED_LEN
        bytes = super()._read(size, read_method)
        bufflen=len(bytes)
        # did we get anything new?
        if bufflen > self.remain:
            # is there a potential cross-boundary match?
            if bytes.endswith(FROMS):
                # yes, work out what to keep
                # N.B. rindex will fail if it cannot find the LF;
                # this should be impossible
                self.remain=bufflen - bytes.rindex(b'\n')
            else:
                # don't need to keep anything back
                self.remain=0
        else:
            # EOF
            self.remain=0
        # we cannot use -0 to mean end of array...
        end = bufflen if self.remain == 0 else -self.remain
        # exclude the potential split match from the return
        return bytes[:end].replace(FROM_MANGLED, FROM_UNMANGLED)

class MboxoFactory(mailbox.mboxMessage):
    def __init__(self, message=None):
        super().__init__(message=MboxoReader(message))
