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
# Basic listview class, to be extended by other designs
###
class BasicListView
    ### json: from stats.lua, rpp = results per page, pos = starting position (from 0) ###
    constructor: (@json, @rpp = 15, @pos = 0) ->
        
        ### Get and clear the list view ###
        @lv = get('listview')
        @lv = @lv.empty()
        
        ### If we got results, use scroll() to display from result 0 on ###
        if isArray(@json.thread_struct) and @json.thread_struct.length > 0
            @scroll(@rpp, @pos)
        else
            ### No results, just say...that ###
            @lv.inject("No emails found matching this criterion.")
            
            
    ### scroll: scroll to a position and show N emails/threads ###
    scroll: (rpp, pos) ->
        ### Clear the list view ###
        @lv = @lv.empty()
        
        ### For each email result,...###
        for item in @json.thread_struct
            original = @findEmail(item.tid)
            
            ### Be sure we actually have an email here ###
            if original
                people = @countPeople(item)
                noeml = @countEmail(item)
                
                ### Render the email in the LV ###
                item = new HTML('div', {class: "listview_item"}, "#{original.subject} - #{people} and #{noeml} replies.")
                @lv.inject(item)
    
    ### findEmail: find an email given an ID ###
    findEmail: (id) ->
        for email in @json.emails
            if email.id == id
                return email
        return null
    
    ### countEmail: func for counting how many emails are in a thread ###
    countEmail: (thread) ->
        n = 0
        if thread.children
            for item in (if isArray(thread.children) then thread.children else [])
                n++
                if isArray(item.children) and item.children.length > 0
                    n += @countEmail(item.children)
        return n
    
    ### countPeople: func for counting how many people are in a thread ###
    countPeople: (thread, p) ->
        np = p || {}
        n = 0
        if thread.tid
            eml = @findEmail(thread.tid)
            if eml
                np[eml.from] = true
                for item in (if isArray(thread.children) then thread.children else [])
                    t = item.tid
                    email = @findEmail(t)
                    if email
                        np[email.from] = true
                    if isArray(item.children) and item.children.length > 0
                        np = @countPeople(item.children, np)
        if p
            return np
        else
            for k,v of np
                n++
            return n
        