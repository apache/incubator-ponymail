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
# Building Pony Mail for Production #
Most of Pony Mail is ready-for-deployment files that just need to be checked out
in order to work. Some areas, such as the JavaScript needs to be combined by a script,
as they have been split into several smaller files to make it easier to find and
work on various elements of the rendering process.

### Building the JavaScript chunks ###
All JavaScript edits should be done to the `site/js/dev/*.js` files.
Once done, you should run combine.sh in the `site/js/dev` directory 
to generate ponymail.js from the scripts in the dev dir:

    $cd site/js/dev
    $bash combine.sh
    Combining JS...
    Done!
    $

You may choose to commit the initial JS changes first before 
committing the new combined JS, but that's up to you.
