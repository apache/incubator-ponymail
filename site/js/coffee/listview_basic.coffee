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
        
        ### Set the header first ###
        hd = get('header')
        if @json.list
            if ponymail_month.length > 0
                [y, m] = ponymail_month.split("-", 2)
                date = calendar_months[parseInt(m)-1] + ", #{y}"
                hd.empty().inject([
                    "#{@json.list} (#{date}):",
                    new HTML('a', { href: "api/mbox.lua?list=#{ponymail_list}&date=#{ponymail_month}", title: "Download as mbox archive"},
                        new HTML('img', { src: 'images/floppy.svg', style: {marginLeft: "10px", width:"20px", height: "20px", verticalAlign: 'middle'}} )
                    )
                    ])
                
            else    
                hd.empty().inject("#{@json.list}, past 30 days:")
            
        ### Get and clear the list view ###
        @lv = get('listview')
        @lv = @lv.empty()
        
        ### Set some internal vars ###
        @listsize = 0
        
        ### If we got results, use scroll() to display from result 0 on ###
        if isArray(@json.thread_struct) and @json.thread_struct.length > 0
            
            ### Set some internal vars ###
            @listsize = @json.thread_struct.length
        
            ### Reverse thread struct, but only if we're not using an
            # already reversed cache ###
            if not @json.cached
                @json.thread_struct.reverse()
            @scroll(@rpp, @pos)
        else
            ### No results, just say...that ###
            @lv.inject("No emails found matching this criterion.")
        
        
        # set current list view to this class
        ponymail_current_listview = this
        return this
            
    ### scroll: scroll to a position and show N emails/threads ###
    scroll: (rpp, pos) ->
        @lastScroll = new Date().getTime()
        ### Clear the list view ###
        @lv = @lv.empty()
        topButtons = null
        
        @rpp = rpp
        @pos = pos
        
        ### Show how many threads out of how many we are showing ###
        f = pos+1
        l = Math.min(@listsize - pos, pos+rpp)
        dStat = new HTML('div', { style: {float: "left", width: "100%", fontSize: "80%", textAlign: "center"}}, "Showing threads #{f} through #{l} out of #{@listsize}")
        @lv.inject(dStat)
        
        ### First, build the prev/next buttons if needed ###
        if pos > 0 or (pos+rpp) < @json.thread_struct.length
            topButtons = new HTML('div', { style: {float: "left", width: "100%"}})
            ## Prev button
            if pos > 0
                pno = Math.min(rpp, pos)
                pp = Math.max(0, pos-rpp)
                pbutton = new HTML('input', {
                    type: 'button'
                    value: 'Previous ' + pno + " message" + (if pno == 1 then '' else 's')
                    onclick: "ponymail_current_listview.scroll(#{rpp}, #{pp});"
                    class: "listview_button_green"
                    style: { float: "left" }
                    })
                topButtons.inject(pbutton)
            ### Next button ###
            if (pos+rpp) < @json.thread_struct.length
                nno = Math.min(rpp, @json.thread_struct.length - pos - rpp)
                np = pos+rpp
                nbutton = new HTML('input', {
                    type: 'button'
                    value: 'Next ' + nno + " message" + (if nno == 1 then '' else 's')
                    onclick: "ponymail_current_listview.scroll(#{rpp}, #{np});"
                    class: "listview_button_green"
                    style: { float: "right" }
                    })
                topButtons.inject(nbutton)
            @lv.inject(topButtons)
            
        ### For each email result,...###
        lvitems = new HTML('div', { class: "listview_table" })
        for item in @json.thread_struct[pos...(pos+rpp)]
            original = @findEmail(item.tid)
            ### Be sure we actually have an email here ###
            if original
                ### Call listViewItem to compile a list view HTML element ###
                item = @listViewItem(original, item)
                
                ### Inject new item into the list view ###
                lvitems.inject(item)
        @lv.inject(lvitems)
        
        ### If we made buttons, clone them at the bottom ###
        if topButtons
            @lv.inject(topButtons.cloneNode(true))
        
        now = new Date().getTime()
        diff = now - @lastScroll
        if @json.cached
            @lv.inject("Fetched from cache (no updates detected), rendered in " + parseInt(diff) + "ms.")
        else
            @lv.inject("Fetched in " + parseInt(@json.took/1000) + "ms, rendered in " + parseInt(diff) + "ms.")
        
        tmpthis = this
        ### Finally, enable scrolling ###
        @lv.addEventListener("mousewheel", (e) ->
            tmpthis.swipe(e)
        , false);
        @lv.addEventListener("DOMMouseScroll", (e) ->
            tmpthis.swipe(e)
        , false);
        
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
        
    listViewItem: (original, thread) ->
        ### Be sure we actually have an email here ###
        if original and thread
            now = new Date().getTime()/1000
            
            ### Gather stats ###
            people = @countPeople(thread)
            noeml = @countEmail(thread)
            
            ### Render the email in the LV ###
            
            ### First set some data points for later ###
            uid = parseInt(Math.random() * 999999999999).toString(16)
            
            
            ### Gravatar ###
            avatar = new HTML('img', { class: "gravatar", src: "https://secure.gravatar.com/avatar/#{original.gravatar}.png?s=24&r=g&d=mm"})
            
            ### Sender, without the <foo@bar> part - just the name ###
            sender = new HTML('div', {style: {fontWeight: "bold"}}, original.from.replace(/\s*<.+>/, "").replace(/"/g, ''))
            
            ### readStyle: bold if new email, normal if read before ###
            readStyle = "bold"
            if hasRead(thread.tid)
                readStyle = "normal"
                
            ### Subject, PLUS a bit of the body with a break before ###
            subject = new HTML('div', {}, [
                new HTML('a', { style: {fontWeight: readStyle}, href: "thread.html/#{thread.tid}", onclick: "readEmail(this.parentNode.parentNode.parentNode); return false;"}, original.subject),
                new HTML('br'),
                new HTML('span', {class: "listview_item_body"}, thread.body)
            ])
            
            ### show number of replies and participants ###
            peopleimg = new HTML('img', {src: 'images/avatar.png', style: { verticalAlign: 'middle', width: "12px", height: "12px"}})
            envelopeimg = new HTML('img', {src: 'images/envelope.png', style: { verticalAlign: 'middle', width: "16px", height: "12px"}})
            stats = new HTML('div', {class:"listview_right"}, [
                peopleimg,
                " #{people}  ",
                envelopeimg,
                " #{noeml}"
                ])
            
            ### Add date; yellow if <= 1day, grey otherwise ###
            date_style = "listview_grey"
            if (now-86400*4) < thread.epoch
                date_style = "listview_yellow"
            date = new HTML('div', {class:"listview_right #{date_style}"}, new Date(thread.epoch*1000).ISOBare())
            
            
            ### Finally, pull it all together in a div and add that to the listview ###
            item = new HTML('div', {id: uid, data: thread.tid, class: "listview_item"},
                            new HTML('div', {class:"listview_summary"}, [avatar, sender, subject, date, stats])
                            )
            return item
        
    ### swipe: go to next or previous page of emails, depending on mouse wheel direction ###
    swipe: (e) ->
        direction = ""
        if typeof e is 'string'
            direction = e
        else
            direction = if ((e.wheelDelta || -e.detail) < 0) then 'down' else 'up'
        style = document.body.currentStyle || window.getComputedStyle(document.body, "")
        
        ### Use the footer to determine whether scrollbar is present or not ###
        obj = get('footer').getBoundingClientRect()
        scrollBar = window.innerHeight < obj.bottom
        
        ### Abort swiping if an email is open or scrollbar is present ###
        if ponymail_email_open or scrollBar
            return
        
        if direction == 'down'
            ### Next page? ###
            if @listsize > (@pos+@rpp+1)
                @scroll(@rpp, @pos+@rpp)
        else if direction == 'up'
            ### Previous page? ###
            if @pos > 0
                @scroll(@rpp, Math.max(0,@pos-@rpp))
                