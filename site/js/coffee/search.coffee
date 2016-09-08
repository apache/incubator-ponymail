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


### Quick Search bar creation ###
quickSearchBar = () ->
    qs = new HTML('form', { class: "quicksearch", onsubmit: 'quickSearch(); return false;'})
    
    ### Cog ###
    ### The blue search button ###
    cog = new HTML('input', { type: 'submit', class: 'qs_cog', title: "Search settings"})
    
    ### Options area ###
    options = new HTML('div', { class: 'qs_options'})
    
    ### Timespan to search within ###
    datedata = "lte=1M"
    span = new HTML('a', { id: 'qs_span', data: datedata, href: 'javascript:void(0);'}, "Less than 1 month ago")
    
    ### Lists(s) to search ###
    listname = 'this list'
    listdata = ponymail_listname
    if ponymail_listname.length == 0
        listname = 'all lists'
        listdata = "*@*"
    list = new HTML('a', { id: 'qs_list', href: 'javascript:void(0);', data: listdata}, listname)
    
    options.inject([span, new HTML('br'), list])
    
    ### Input field for text search ###
    input = new HTML('input', { type: "text", id: 'qs_input', class: "qs_input", placeholder: "Search #{listname}..."})
    
    ### The blue search button ###
    button = new HTML('input', { type: 'submit', class: 'qs_button'})
    
    ### Link to advanced search ###
    advanced = new HTML('a', {href: 'javascript:void(advancedSearch());', class: "qs_link"},
                        new HTML('img', { src: 'images/advanced.png', style: { verticalAlign: 'middle', height: "24px"}})
                       )
    
    ### Add it all to the form ###
    qs.inject(cog)
    #qs.inject(options)
    qs.inject(input)
    qs.inject(button)
    qs.inject(advanced)
    
    return qs

### Quick Search function ###
quickSearch = () ->
    ### Get the QS input ###
    