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

###*
# This is the listview basic library
###

### Generally, popping a window state should run a listView update ###
window.onpopstate = (event) ->
    listView(null, true)



listView = (hash, reParse) ->
    ### Get the HTML filename ###
    [htmlfile, etc] = location.href.split("?")
    
    ### Do we need to call the URL parser here? ###
    if reParse
        parseURL()
        
    ### Any new settings passed along? ###
    if isHash(hash)
        if hash.month
            ponymail_month = hash.month
        if hash.list
            ponymail_list = hash.list
        if hash.query
            ponymail_query = hash.query
    
    ### First, check that we have a list to view! ###
    if not (ponymail_list and ponymail_list.match(/.+@.+/))
        ### Do we at least have a domain part? ###
        if ponymail_list and ponymail_list.match(/.+?\..+/)
            ### Check if there's a $default list in this domain ###
            d = ponymail_list
            ### Do we have this domain listed? If not, redirect to front page ###
            if not ponymail_domains[d]
                location.href = "./"
                return
            
            if ponymail_domains[d] and ponymail_domains[d][pm_config.default_list]
                ### Redirect to this list then ... ###
                location.href = "#{htmlfile}?#{pm_config.default_list}@#{d}"
                return
        else
            ### No domain specified, redirect to front page ###
            location.href = "./"
            return
    
    ### Construct arg list for URL ###
    args = ""
    if ponymail_list and ponymail_list.length > 0
        args += ponymail_list
    if ponymail_month and ponymail_month.length > 0
        args += ":" + ponymail_month
    if ponymail_query and ponymail_query.length > 0
        args += ":" + ponymail_query
        
    ### Push a new history state using new args ###
    window.history.pushState({}, "", "#{htmlfile}?#{args}")
    
    ### Request month view from API, send to list view callback ###
    r = new HTTPRequest(
        "api/stats.lua?list=#{ponymail_list}&d=#{ponymail_month}",
        {
            callback: renderListView
        }
        )
    