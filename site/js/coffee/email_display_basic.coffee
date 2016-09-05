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

### readMail: figure out how to display an email/thread ###
readEmail = (obj) ->
    ### find the original email ID and point of origin ###
    mid = null
    parent = null
    if typeof obj is 'string'
        mid = obj
        parent = document.body
    else if typeof obj is 'object'
        mid = obj.getAttribute("data")
        parent = obj

    ### We good to go? ###
    if (not mid) or (not parent)
        alert("Couldn't find the email or insertion point!")
        return
    
    ### First check if the MID is already open
    # If so, close it instead ###
    closedOne = false
    for email in ponymail_email_open
        if mid == email.mid
            email.hide()
            closedOne = true
            
    if not closedOne
        ### We have an(other) email open now ###
        ponymail_current_email = new BasicEmailDisplay(parent, mid)
        ponymail_email_open.push(ponymail_current_email)

    
class BasicEmailDisplay
    constructor: (@parent, @mid) ->
        @placeholder = get("placeholder_" + @mid) || new HTML('div', { class: "email_placeholder", id: "placeholder_" + @mid})
        
        
        ### Inject into listview or body ###
        @parent.inject(@placeholder)
        
        ### Make sure it's empty, may have been used before! ###
        @placeholder = @placeholder.empty()
        @placeholder.show(true)
        
        me = this
        
        ### Do we have this email in cache? ###
        if ponymail_stored_email[@mid]
            @render(ponymail_stored_email[@mid])
        else
            ### Not stored, fetch the email first ###
            r = new HTTPRequest("api/email.lua?", {
                get: {
                    id: @mid
                }
                callback: (json, state) ->
                    me.render(json, state)
            })
        
    render: (json, state) ->
        
        ### Store email in cache if not there already ###
        if not ponymail_stored_email[@mid]
            ponymail_stored_email[@mid] = json
            
        ### Display email headers ###
        headers = new HTML('div')
        
        from_line = new HTML('div', {},
            [
                new HTML('div', {class:"header_key"}, "From: ")
                new HTML('div', {class:"header_value"}, json.from)
            ])
        headers.inject(from_line)
        
        subject_line = new HTML('div', {},
            [
                new HTML('div', {class:"header_key"}, "Subject: ")
                new HTML('div', {class:"header_value"}, json.subject)
            ])
        headers.inject(subject_line)
        
        date_line = new HTML('div', {},
            [
                new HTML('div', {class:"header_key"}, "Date: ")
                new HTML('div', {class:"header_value"}, new Date(json.epoch*1000).ISOBare())
            ])
        headers.inject(date_line)
        
        ### <a.b.c> -> a@b.c ###
        @list = json.list_raw.replace(/<([^.]+)\.(.+)>/, (a,b,c) => "#{b}@#{c}")
        list_line = new HTML('div', {},
            [
                new HTML('div', {class:"header_key"}, "List: ")
                new HTML('div', {class:"header_value"},
                         new HTML('a', { href: "list.html?#{@list}"}, @list)
                        )
            ])
        headers.inject(list_line)
        
        @placeholder.inject(headers)
        
        ### Now inject the body ###
        b = new HTML('pre', {}, json.body)
        @placeholder.inject(b)
        
        
    hide: () ->
        @placeholder.show(false)
        ponymail_email_open.remove(this)
        ponymail_current_email = null
        