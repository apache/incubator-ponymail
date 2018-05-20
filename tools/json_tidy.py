#!/usr/bin/env python3

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
 Prettify json: indent, sort
 Can also drop keys that aren't wanted, e.g. the debug array, to make diffs easier
"""

import sys
import json
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--indent", type=int, help="Indentation to use for the output file (default 1)", default=1)
parser.add_argument("--drop", help="Comma-separated list of top-level keys to drop (e.g. debug,took)", default='')

args = parser.parse_args()

inp = json.loads(sys.stdin.read())
for key in args.drop.split(','):
    try:
        del inp[key]
    except KeyError:
        pass

json.dump(inp, sys.stdout, indent=args.indent, sort_keys=True)
print("") # EOL at EOF
