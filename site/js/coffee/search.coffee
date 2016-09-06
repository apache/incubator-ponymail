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

quickSearchBar = () ->
    qs = new HTML('form', { class: "quicksearch", onsubmit: 'quickSearch(); return false;'})
    
    ### Options area ###
    options = new HTML('div', { class: 'qs_options'})
    
    ### Timespan to search within ###
    datedata = "lte=1M"
    span = new HTML('a', { id: 'qs_span', data: datedata, href: 'javascript:void(0);'}, "Less than 1 month ago")
    
    ### Lists(s) to search ###
    listname = 'This list'
    listdata = ponymail_listname
    if ponymail_listname.length == 0
        listname = 'All lists'
        listdata = "*@*"
    list = new HTML('a', { id: 'qs_list', href: 'javascript:void(0);', data: listdata}, listname)
    
    options.inject([span, new HTML('br'), list])
    
    
    input = new HTML('input', { type: "text", id: 'qs_input', class: "qs_input", placeholder: "Type search terms..."})
    button = new HTML('input', { type: 'submit', class: 'qs_button'})
    qs.inject(options)
    qs.inject(input)
    qs.inject(button)
    
    return qs

### Quick Search function ###
quickSearch = () ->
    ### Get the QS input ###
    