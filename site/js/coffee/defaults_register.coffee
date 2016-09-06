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

### Various register functions ###

ponymail_listview_models = {}
ponymail_display_models = {}

ponymail_register_listview = (name, title, cl) ->
    ponymail_listview_models[name] = {title: title, class: cl}
    
ponymail_register_display = (name, title, cl) ->
    ponymail_display_models[name] = {title: title, class: cl}