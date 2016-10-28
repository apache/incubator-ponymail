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
            break
            
    if not closedOne
        ### Get thread index value if set, for threads ###
        index = parent.getAttribute("data-index")
        ### We have an(other) email open now ###
        ponymail_current_email = new ThreadedEmailDisplay(parent, mid, index)
        ponymail_email_open.push(ponymail_current_email)

### Basic email display class ###
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
        if not ponymail_stored_email[json.mid]
            ponymail_stored_email[json.mid] = json
            
        ### Mark as read ###
        markRead(json.mid)
        
        placeholder = get('placeholder_' + @mid + "_" + json.mid) || get('placeholder_' + json.mid)
            
        ### Display email headers ###
        headers = new HTML('div', {class: "email_header"})
        
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
        
        ### Attachments, if any ###
        if isArray(json.attachments) and json.attachments.length > 0
            at = []
            for file in json.attachments
                fsize = file.size
                
                ### Compact size to MB, KB or bytes ###
                if fsize > (1024*1024)
                    fsize = (fsize/(1024*1024)).toFixed(2) + "MB"
                else if fsize > 1024
                    fsize = (fsize/(1024)).toFixed(2) + "KB"
                else
                    fsize = fsize + " bytes"
                ### Make a link with the filename and size ###
                link = new HTML('a', { href: "api/email.lua?attachment=true&file=#{file.hash}&id=#{json.mid}", style: { marginRight: "8px"}}, "#{file.filename} (#{fsize})")
                at.push(link)
                
            att_line = new HTML('div', {},
            [
                new HTML('div', {class:"header_key"}, "Attachments: ")
                new HTML('div', {class:"header_value"}, at)
            ])
            headers.inject(att_line)
        
        ### Action buttons ###
        
        ### Permalink ###
        shortID = shortenURL(json.mid)
        pbutton = new HTML('a', { class: "label_yellow", href: "thread.html/#{shortID}"}, "Permalink")
        
        ### Source ###
        sbutton = new HTML('a', { class: "label_red", href: "api/source.lua/#{json.mid}"}, "View source")
        
        ### Reply ###
        rbutton = new HTML('a', { class: "label_green", href: "javascript:void(0);"}, "Reply")
        
        buttons = new HTML('div', {class: "email_header_buttons"}, [pbutton, sbutton, rbutton])
        
        headers.inject(buttons)
        
        placeholder.inject(headers)
        
        
        ### parse body, convert quotes ###
        htmlbody = @quotify(json.body)
        
        ### Now inject the body ###
        b = new HTML('pre', {class: "email_body"}, htmlbody)
        placeholder.inject(b)
    
    ### quotify: put quotes inside quote blocks ###
    quotify: (splicer) ->
        hideQuotes = true
        if ponymail_preferences['hideQuotes'] and ponymail_preferences['hideQuotes'] == false
            hideQuotes = false
            
        ### Array holding text and quotes ###
        textbits = []
        
        ### Find the first quote, if any ###
        i = splicer.search(ponymail_quote_regex)
        quotes = 0
        
        ### While we have more links, ... ###
        while i != -1
            quotes++
            ### Only parse the first 50 quotes... srsly ###
            if quotes > 50
                break
            ### Text preceding the quote? add it to textbits first ###
            if i > 0
                t = splicer.substr(0, i)
                textbits.push(@URLify(t))
                splicer = splicer.substr(i)
                
            ### Find the quote and cut it out as a div ###
            m = splicer.match(ponymail_quote_regex)
            if m
                quote = m[1]
                i = quote.length
                t = splicer.substr(0, i)
                quote = quote.replace(/(>*\s*\r?\n)+$/g, "")
                qdiv = new HTML('div', {class: "email_quote_parent" }, [
                    new HTML('img', { src: 'images/quote.png', width: "24", height: "26", title: "Toggle quote", onclick:"toggleQuote(this)"}),
                    new HTML('br')
                    new HTML('blockquote', {class: "email_quote", style: { display: if hideQuotes then 'none' else 'block'}}, @URLify(quote))
                    ])
                textbits.push(qdiv)
                splicer = splicer.substr(i)
            ### Find the next link ###
            i = splicer.search(ponymail_quote_regex)
        
        ### push the remaining text into textbits ###
        textbits.push(@URLify(splicer))
        
        return textbits
    
    ### URLify: find links and HTML'ify them ###
    URLify: (splicer) ->
        ### Array holding text and links ###
        textbits = []
        
        ### Find the first link, if any ###
        i = splicer.search(ponymail_url_regex)
        urls = 0
        
        ### While we have more links, ... ###
        while i != -1
            urls++
            ### Only parse the first 50 URLs... srsly ###
            if urls > 50
                break
            ### Text preceding the link? add it to textbits frst ###
            if i > 0
                t = splicer.substr(0, i)
                textbits.push(t)
                splicer = splicer.substr(i)
                
            ### Find the URL and cut it out as a link ###
            m = splicer.match(ponymail_url_regex)
            if m
                url = m[1]
                i = url.length
                t = splicer.substr(0, i)
                textbits.push(new HTML('a', {href: url}, url))
                splicer = splicer.substr(i)
            ### Find the next link ###
            i = splicer.search(ponymail_url_regex)
        
        ### push the remaining text into textbits ###
        textbits.push(splicer)
        
        return textbits
        
    hide: () ->
        @placeholder.show(false)
        ponymail_email_open.remove(this)
        ponymail_current_email = null

ponymail_register_display('default', "Single email view", BasicEmailDisplay)

### toggleQuote: show/hide a quote ###
toggleQuote = (div) ->
    div.parentNode.childNodes[2].show()
