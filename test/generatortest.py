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
This file tests the generators against mbox files
"""

# PYTHONPATH is used to give access to archiver.py
# PYTHONPATH=../tools python3 generatortest.py generatortest.yaml
 
import mailbox
import archiver
import sys
import yaml
from pprint import pprint

list_override = None # could affect id
private = False # does not affect id generation
parseHTML = False # can this affect id generation?

archie = archiver.Archiver(parseHTML = parseHTML)

for arg in sys.argv[1:]:
    if arg.endswith('.yml') or arg.endswith('.yaml'):
        with open(arg, 'r') as stream:
            data = yaml.safe_load(stream)
            for test in data['tests']:
                for file in test:
                    print("Testing with %s" % file)
                    mbox = mailbox.mbox(file, None, create=False)
                    scripts = test[file]
                    msgcnt = len(mbox)
                    scrcnt = len(scripts)
                    if msgcnt != scrcnt:
                        print("WARN: mbox contains %d messages, but there are %d unit tests" % (msgcnt, scrcnt))
                    messages=iter(mbox)
                    for script in scripts:
                        if 'exit' in script:
                            break
                        if 'gen' in script:
                            print("Generator %s" % script['gen'])
                            archiver.archiver_generator = script['gen']
                        message = next(messages)
                        json, contents, _msgdata, _irt = archie.compute_updates(list_override, private, message)
                        for key in script:
                            if key == 'gen':
                                continue
                            if not key in json:
                                print("key %s is not in response" % key)
                            elif script[key] == json[key]:
                                pass
                            else:
                                print("key %s: expected vs. actual\n %s\n %s\n%s %s" % (key, script[key], json[key], json['date'], json['subject']))
        print("Completed %d tests" % scrcnt)        
    elif arg.endswith('.mbox'):
        messages = mailbox.mbox(arg, None, create=False)
        for message in messages:
            print(message.get_from())
            json, contents, _msgdata, _irt = archie.compute_updates(list_override, private, message)
            print(json['mid'])
            archiver.archiver_generator = 'medium'
    else:
        print("Unknown file type %s" % arg)
