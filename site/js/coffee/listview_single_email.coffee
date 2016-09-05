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
# Single email list view - extends BasicListView
###
class SingleListView extends BasicListView
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
        if isArray(@json.emails) and @json.emails.length > 0
            
            ### Set some internal vars ###
            @listsize = @json.emails.length
        
            ### Reverse thread struct, but only if we're not using an
            # already reversed cache ###
            if not @json.cached
                @json.emails.reverse()
            @scroll(@rpp, @pos)
        else
            ### No results, just say...that ###
            @lv.inject("No emails found matching this criterion.")
        
        
        # set current list view to this class
        ponymail_current_listview = this
        return this
    
    renderItems: () ->
        ### For each email result,...###
        @lvitems = new HTML('div', { class: "listview_table" })
        lastitem = null
        for original in @json.emails[@pos...(@pos+@rpp)]
            ### Be sure we actually have an email here ###
            if original
                ### Call listViewItem to compile a list view HTML element ###
                item = @listViewItem(original, null)
                lastitem = item
                ### Inject new item into the list view ###
                @lvitems.inject(item)
        @lv.inject(@lvitems)
        return lastitem
        
    listViewItem: (original, thread) ->
        ### Be sure we actually have an email here ###
        if original
            now = new Date().getTime()/1000
            
            ### Render the email in the LV ###
            
            ### First set some data points for later ###
            uid = parseInt(Math.random() * 999999999999).toString(16)
            
            
            ### Gravatar ###
            avatar = new HTML('img', { class: "gravatar", src: "https://secure.gravatar.com/avatar/#{original.gravatar}.png?s=24&r=g&d=mm"})
            
            ### Sender, without the <foo@bar> part - just the name ###
            sender = new HTML('div', {style: {fontWeight: "bold"}}, original.from.replace(/\s*<.+>/, "").replace(/"/g, ''))
            
            ### readStyle: bold if new email, normal if read before ###
            readStyle = "bold"
            if hasRead(original.id)
                readStyle = "normal"
                
            ### Subject, PLUS a bit of the body with a break before ###
            subject = new HTML('div', {}, [
                new HTML('a', { style: {fontWeight: readStyle}, href: "thread.html/#{original.id}", onclick: "readEmail(this.parentNode.parentNode.parentNode); return false;"}, original.subject),
            ])
            
            
            ### Add date; yellow if <= 1day, grey otherwise ###
            date_style = "listview_grey"
            if (now-86400*4) < original.epoch
                date_style = "listview_yellow"
            date = new HTML('div', {class:"listview_right #{date_style}"}, new Date(original.epoch*1000).ISOBare())
            
            
            ### Finally, pull it all together in a div and add that to the listview ###
            item = new HTML('div', {id: uid, data: original.id, class: "listview_item"},
                            new HTML('div', {class:"listview_summary"}, [avatar, sender, subject, date])
                            )
            return item
        
ponymail_register_listview('single', 'Single email theme', SingleListView)