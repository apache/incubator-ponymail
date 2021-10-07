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
import sys
import os
import yaml
import subprocess
from pprint import pprint
from collections import namedtuple


TOOLS = os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(__file__))),"tools")
sys.path.append(TOOLS)
import archiver
ARCHIVER=os.path.join(TOOLS,"archiver.py")
import generators

list_override = None # could affect id
private = False # does not affect id generation
parseHTML = False # can this affect id generation?
GENS=generators.generator_names()

archie = archiver.Archiver(parse_html = parseHTML)


for arg in sys.argv[1:]:
    if arg.endswith('.yml') or arg.endswith('.yaml'):
        errors = 0
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
                            archie.generator = script['gen']
                        message = next(messages)
                        json, contents, _msgdata, _irt = archie.compute_updates(list_override, private, message)
                        error = 0
                        for key in script:
                            if key == 'gen':
                                continue
                            if not key in json:
                                print("key %s is not in response" % key)
                            elif script[key] == json[key]:
                                pass
                            else:
                                error = 1
                                print("key %s\nexp: %s\nact: %s\n%s %s" % (key, script[key], json[key], json['date'], json['subject']))
                        errors += error
        print("Completed %d tests (%d errors)" % (scrcnt, errors))        
    elif arg.endswith('.mbox'):
        messages = mailbox.mbox(arg, None, create=False)
        for message in messages:
            print(message.get_from())
            for gen in GENS:
                archie.generator = gen
                json, contents, _msgdata, _irt = archie.compute_updates(list_override, private, message)
                print("%15s: %s" % (gen,json['mid']))
    elif arg.endswith('.eml'): # a single email
        for gen in GENS:
            with open(arg,'rb') as f:
                out = subprocess.run([ARCHIVER,"--dry","--generator",gen], stdin=f, capture_output=True, text=True)
                try:
                    mid = out.stdout.splitlines()[1].strip('!').split()[-1]
                    print("%15s: %s" % (gen,mid))
                except:
                    print(out.stdout)
    else:
        print("Unknown file type %s" % arg)
