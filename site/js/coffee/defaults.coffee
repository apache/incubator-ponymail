###
 Licensed to the Apache Software Foundation (ASF) under one or more
 contributor license agreements.  See the NOTICE file distributed with
 this work for additional information regarding copyright ownership.
 The ASF licenses this file to You under the Apache License, Version 2.0
 (the "License"); you may not use this file except in compliance with
 the License.  You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
###

### Pony Mail defaults ###
ponymail_version = "0.10 (Coffee and Cake)"

ponymail_lists = {}
ponymail_list = ""
ponymail_month = ""
ponymail_query = ""

ponymail_listname = ""
ponymail_domain = ""
ponymail_list_json = {}

ponymail_current_listview = null # Current listview class
ponymail_email_open = [] # Is the user viewing an email right now? (disable scrolling then)
ponymail_current_email = null # if more than one email is open, this points to the last one opened
ponymail_stored_email = {} # Hash containing stored JSON objects of email already fetched

ponymail_preferences = {}
