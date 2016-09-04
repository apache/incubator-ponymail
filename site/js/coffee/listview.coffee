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

parseURL = () ->
    [list, month, query] = window.location.search.substr(1).split(":", 3)
    ponymail_list = list
    ponymail_month = month||""
    ponymail_query = query||""
    [ponymail_listname, ponymail_domain] = list.split("@")
    
    

listView = (hash, reParse) ->
    ### Get the HTML filename ###
    [htmlfile, etc] = location.href.split("?")
    
    ### Do we need to call the URL parser here? ###
    if reParse
        parseURL()
        
    ### Any new settings passed along? ###
    if isHash(hash)
        if typeof hash.month != 'undefined'
            ponymail_month = hash.month
        if typeof hash.list != 'undefined'
            ponymail_list = hash.list
        if typeof hash.query != 'undefined'
            ponymail_query = hash.query
    
    ### First, check that we have a list to view! ###
    if not (ponymail_list and ponymail_list.match(/.+?@.+/))
        ### Do we at least have a domain part? ###
        if ponymail_list and ponymail_list.match(/.+?\..+/)
            ### Check if there's a $default list in this domain ###
            [l, d] = ponymail_list.split("@", 2)
            if not d
                d = l
                
            ### Do we have this domain listed? If not, redirect to front page ###
            if not d or not ponymail_lists[d]
                location.href = "./"
                return
            
            if ponymail_lists[d] not ponymail_lists[d][l] and ponymail_lists[d][pm_config.default_list]
                ### Redirect to this list then ... ###
                location.href = "#{htmlfile}?#{pm_config.default_list}@#{d}"
                return
        else
            ### No domain specified, redirect to front page ###
            location.href = "./"
            return
    
    ### Set window title ###
    document.title = "#{ponymail_list} - Pony Mail!"
    
    ### Construct arg list for URL ###
    args = ""
    if ponymail_list and ponymail_list.length > 0
        args += ponymail_list
    if ponymail_month and ponymail_month.length > 0
        args += ":" + ponymail_month
    if ponymail_query and ponymail_query.length > 0
        args += ":" + ponymail_query
        
    ### Push a new history state using new args ###
    newhref = "#{htmlfile}?#{args}"
    if location.href != newhref
        window.history.pushState({}, null, newhref)
    
    [list, domain] = ponymail_list.split("@", 2)
    ### Request month view from API, send to list view callback ###
    pargs = "d=30"
    if ponymail_month and ponymail_month.length > 0
        pargs = "s=#{ponymail_month}&e=#{ponymail_month}"
    
    ### If we already fetched this URL once, only do an update check ###
    if ponymail_list_json[newhref] and ponymail_list_json[newhref].unixtime > 0
        since = ponymail_list_json[newhref].unixtime
        r = new HTTPRequest(
            "api/stats.lua?list=#{list}&domain=#{domain}&#{pargs}&since=#{since}",
            {
                callback: renderListView
                state: {
                    href: newhref
                }
            }
            )
    else
        r = new HTTPRequest(
            "api/stats.lua?list=#{list}&domain=#{domain}&#{pargs}",
            {
                callback: renderListView
                state: {
                    href: newhref
                }
            }
            )
    
renderListView = (json, state) ->
    
    ### If this is a cache check callback, and nothing has changed, use the old JSON ###
    if state and state.href and typeof json.changed != 'undefined' and json.changed is false
        json = ponymail_list_json[state.href]
        json.cached = true
    else if state and state.href
        ### Save JSON in cache if new ###
        ponymail_list_json[state.href] = json
        
    ### Start by adding the calendar ###
    if json.firstYear and json.lastYear
        cal = new Calendar(json.firstYear, json.lastYear, ponymail_month)
        get('calendar').empty().inject(cal)
        
    lv = new BasicListView(json)
    