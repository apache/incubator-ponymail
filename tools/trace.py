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
Simple trace facility for local debugging.
Shows a message together with its location.

N.B. This is intended as a handy tool for local use only;
not intended for use in deployed code.

Usage:

from trace import trace
...
    trace("Message-id %s" % message-id)
    ...
    trace("Message-id %s" % message-id)
    ...
    trace("Message-id %s" % message-id)

The output includes the line number so there is
no need to customise the messages to id them.
"""
import inspect
from os.path import basename

def trace(s='', depth=1):
    """
    Show message with context from the caller
    """
    stack=inspect.stack()
    maxIndex = len(stack) - 1
    depth = maxIndex if depth >= maxIndex else depth
    _frame,filename,line_number,function_name,_lines,_index = stack[depth]
    print(">>>>[%d]%s@%s#%s: %s"%(depth,basename(filename),line_number,function_name,s))

def func_name(depth=1):
    """
    Return the caller's name
    """
    stack=inspect.stack()
    maxIndex = len(stack) - 1
    depth = maxIndex if depth >= maxIndex else depth
    _frame,_filename,_linenumber,function_name,_lines,_index = stack[depth]
    return function_name

if __name__ == '__main__':
    trace("test")
    trace("test",0)
    trace("test",2)
