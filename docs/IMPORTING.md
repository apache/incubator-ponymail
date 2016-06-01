<!--
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at
 
 http://www.apache.org/licenses/LICENSE-2.0
 
 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 -->
# Importing Data to Pony Mail #
Pony Mail supports many ways of importing your old mail archives via the
`import-mbox.py` script. For command line argument tips, run `python3
import-mbox.py --help`.

Imports are digested equally every time, so you can
import from the same source multiple times without creating duplicate emails in
the archive. Both the archiver and the importer use the same digest method, so
they can overlap. Usually, you'll want to set up the archiver first, and when
emails start flowing through it, you'll use the importer to import older emails.

## Importing attachments
If you wish to import attached files, add the `--attachments` flag to your import command, otherwise, attachments will be stripped.

## Importing from mod_mbox

### Importing a single domain
Provided you have the main mod_mbox page at https://your.tld/mod_mbox/ and your (sub)domain resources at
https://your.tld/mod_mbox/$list-yourdomain/, you can import all lists from that domain using:

`python3 import-mbox.py --source https://your.tld/mod_mbox/ --mod-mbox --project yourdomain`

For a quick update, which only imports the last 2 months of mail, append then `--quick` flag.

You can also import just a single list by specifying that list ID:

`python3 import-mbox.py --source https://your.tld/mod_mbox/ --mod-mbox --project listname-yourdomain`

### Importing an entire archive (multiple domains)
To import an entire site, use the same command as above, but omit the `--project` flag

`python3 import-mbox.py --source https://your.tld/mod_mbox/ --mod-mbox`

### Setting the domain or list id properly in case of variance
If your old archive varies in terms of list IDs across time, you can force harmonization by using the `--lid` or `--domain` flags:

`python3 import-mbox.py --source https://your.tld/mod_mbox/ --mod-mbox --project listid-yourdomain --lid "<listid.youdomain.tld>"`

This should only be done one list at a time.

## Importing from Pipermail
To import from pipermail, you will have to run the import one list at a time. As with mod_mbox imports, you must specify a source, but use `--pipermail` instead of `--mod-mbox`:

`python3 import-mbox.py --source https://your.tld/pipermail/foolist/ --pipermail`

### Pipermail and html-only emails
While you can convert HTML-only emails to text using `--html2text`, Pipermail has some peculiarities
where it adds a text/plain message to these emails, thus preventing html2text from working. You can
circumvent this by using the `--ignorebody "foo"` arg to ignore all text/plain bodies containing `foo`.

While the `project` flag is not needed here, you may wish to specify the list ID for the import.

## Importing from locally stored mbox files
To import from one or more local mbox files, specify a filesystem path as the source:

`python3 import-mbox.py --source /tmp/mylists/ --attachments`

If you have a mix of mbox and non-mbox files in the specific dir, you may wish to let Pony Mail know which files to scan:

`python3 import-mbox.py --source /tmp/mylists/ --ext .mbox --attachments`

## Test archives
We have a few test archives for those that wish to test large imports.
They can be found in gzip format at [http://ponymail.info/mboxes/](http://ponymail.info/mboxes/)
