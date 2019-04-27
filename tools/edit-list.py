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

""" Modify lists and messages

This utility can be used to:
- rename a list
- make a list private
- make a list public
- update the description for a list
- delete mails from a list (does not delete mbox_source entries)
- obfuscate some fields (from, subject, body) in an mbox entry (does not obfuscate the raw source document)

"""

import sys
import time
import argparse
import json

from elastic import Elastic

class options:
    def __init__(self):
        parser = argparse.ArgumentParser(description='Command line options.')
        # Cannot have both source and mid as input
        source_group = parser.add_mutually_exclusive_group()
        source_group.add_argument('--source', dest='source', type=str,
                           help='Source list to edit')
        source_group.add_argument('--mid', dest='mid', type=str,
                           help='Source Message-ID to edit')
        parser.add_argument('--rename', dest='target', type=str,
                           help='(optional) new list ID')
        parser.add_argument('--desc', dest='desc', type=str,
                           help='(optional) new list description')
        parser.add_argument('--obfuscate', dest='obfuscate', type=str,
                           help='Things to obfuscate in body, if any')
        # private and public are mutually exclusive
        privacy_group = parser.add_mutually_exclusive_group()
        privacy_group.add_argument('--private', dest='private', action='store_true',
                           help='Make all emails in list private')
        privacy_group.add_argument('--public', dest='public', action='store_true',
                           help='Make all emails in list public')
        parser.add_argument('--delete', dest='delete', action='store_true',
                           help='Delete emails from this list')
        parser.add_argument('--wildcard', dest='glob', action='store_true',
                           help='Allow wildcards in --source')
        parser.add_argument('--debug', dest='debug', action='store_true',
                           help='Debug output - very noisy!')
        parser.add_argument('--notag', dest='notag', action='store_true',
                           help='List IDs do not have <> in them')
        parser.add_argument('--test', dest='test', action='store_true',
                           help='Only test for occurrences, do not run the chosen action (dry run)')
        
        args = parser.parse_args()
        
        self.sourceLID = args.source
        self.targetLID = args.target
        self.desc = args.desc
        self.makePrivate = args.private
        self.makePublic = args.public
        self.deleteEmails = args.delete
        self.wildcard = args.glob
        self.debug = args.debug
        self.notag = args.notag
        self.mid = args.mid
        self.obfuscate = args.obfuscate
        self.dryrun = args.test
        
        self.privacyChange = self.makePrivate or self.makePublic
        self.otherChange = self.targetLID or self.desc or self.obfuscate
        self.anyChange = self.privacyChange or self.otherChange
        
        if not self.sourceLID and not self.mid:
            print("No source list ID specified!")
            parser.print_help()
            sys.exit(-1)
        if not (self.anyChange or self.deleteEmails):
            print("Nothing to do! No target list ID or action specified")
            parser.print_help()
            sys.exit(-1)
        if self.desc and not self.sourceLID:
            print("No source list ID specified for description!")
            parser.print_help()
            sys.exit(-1)
        if self.anyChange and self.deleteEmails:
            print("Cannot both change and delete emails in the same run")
            parser.print_help()
            sys.exit(-1)
        
        # TODO does it make sense to allow --rename with --mid?
        # i.e. rename the list for a single mid?
        
        if self.sourceLID:
            self.sourceLID = ("%s" if self.notag else "<%s>")  % self.sourceLID.replace("@", ".").strip("<>")
        if self.targetLID:
            self.targetLID = "<%s>" % self.targetLID.replace("@", ".").strip("<>")


def process_hits(page, args, dbname):
    """ Processes each hit in a scroll search and proposes changes
        in the array returned """
    changes = []
    if 'hits' in page and 'hits' in page['hits']:
        for hit in page['hits']['hits']:
            doc = hit['_id']
            body = {}
            if args.obfuscate:
                body['body'] = hit['_source']['body'].replace(args.obfuscate, "...")
                body['subject'] = hit['_source']['subject'].replace(args.obfuscate, "...")
                body['from'] = hit['_source']['from'].replace(args.obfuscate, "...")
            if args.targetLID:
                body['list_raw'] = args.targetLID
                body['list'] = args.targetLID
            if args.makePrivate:
                body['private'] = True
            if args.makePublic:
                body['private'] = False
            changes.append({
                '_op_type': 'delete' if args.deleteEmails else 'update',
                '_index': dbname,
                '_type': 'mbox',
                '_id': doc,
                'doc': body
                })
    return changes

def main():
    es = Elastic()
    dbname = es.getdbname()
    # get config and set up default databas
    es = Elastic()
    # default database name
    dbname = es.getdbname()
    
    args = options()
    
    print("Beginning list edit:")
    if args.sourceLID:
        print("  - List ID: %s" % args.sourceLID)
    else:
        print("  - MID: %s" % args.mid)
    if args.targetLID:
        print("  - Target ID: %s" % args.targetLID)
    if args.makePublic:
        print("  - Action: Mark all emails public")
    if args.makePrivate:
        print("  - Action: Mark all emails private")
    if args.deleteEmails:
        print("  - Action: Delete emails (sources will be kept!)")
    if args.obfuscate:
        print("  - Action: Obfuscate parts of email containing: %s" % args.obfuscate)
    
    if args.desc:
        print("  - Action: add description: %s" % args.desc)
        if args.dryrun:
            print("DRY RUN - NO CHANGES WILL BE MADE")
        else:
            LID = args.sourceLID
            if args.targetLID:
                LID = args.targetLID
            es.index(
                doc_type="mailinglists",
                id=LID,
                body = {
                    'list': LID,
                    'name': LID,
                    'description':args.desc
                }
            )
            print("All done, updated description.")
    
    if args.targetLID or args.makePrivate or args.makePublic or args.deleteEmails or args.mid or args.obfuscate:
        if args.dryrun:
            print("DRY RUN - NO CHANGES WILL BE MADE")
        print("Updating docs...")
        then = time.time()
        terms = {
            'wildcard' if args.wildcard else 'term': {
                'list_raw': args.sourceLID
            }
        }
        if args.mid:
            terms = {
                'term': {
                    'mid': args.mid
                }
            }
        query = {
            '_source': ['body', 'subject', 'from'] if args.obfuscate else False,
            'query': {
                'bool': {
                    'must': [
                        terms
                    ]
                }
            }
        }
        proposed_changes = []
        for page in es.scan_and_scroll(body = query):
            prop = process_hits(page, args, dbname)
            if prop:
                proposed_changes.extend(prop)
        
        tmp = []
        count = len(proposed_changes)
        processed = 0
        # Handle proposed changes in batches of 500
        while len(proposed_changes) > 0:
            tmp.append(proposed_changes.pop(0))
            if len(tmp) == 500 and not args.dryrun:
                es.bulk(tmp)
                tmp = []
                processed += 500
                print("Processed %u documents..." % processed)
        # Any stragglers remaining gets processed here
        if len(tmp) > 0 and not args.dryrun:
            es.bulk(tmp)
            processed += len(tmp)
            print("Processed %u documents..." % processed)
            
        print("All done, processed %u docs in %u seconds" % (count, time.time() - then))

if __name__ == '__main__':
    main()
