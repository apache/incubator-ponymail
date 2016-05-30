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
# AAA Examples
This directory contains example AAA (Authentication, Authorization and Access)
libraries for various use cases. 

To activate one of these scripts (or derivatives thereof), simply replace 
`site/api/lib/aaa.lua` with the AAA script of your choice.

These script will require that
`site/api/lib/config.lua` has one or more OAuth providers specified as
authorities, as such:

~~~
...,
-- This adds Persona and Google OAuth as authorities
admin_oauth = { "verifier.login.persona.org", "www.googleapis.com" }
...
~~~

### AAA by email address:
[`aaa_by_email_address.lua`](aaa_by_email_address.lua) checks against a GLOB
(`valid_email`), and if a logged-in user's email address matches this, provides
access to private lists, provided the OAuth provider used is listed in
`config.lua` as a valid authority.


### AAA by OAuth portal:
[`aaa_by_portal.lua`](aaa_by_portal.lua) checks which OAuth portal was used to
log in. If it's the right (Google in the example), then access to private lists
is granted.


### AAA with access list:
[`aaa_with_subgroups.lua`](aaa_with_subgroups.lua) checks validated accounts
against an access list, and if found, provides access to a specific set of
lists for each individual user.
