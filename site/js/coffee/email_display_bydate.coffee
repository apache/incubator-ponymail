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

### date-sorted multi email display class - extends BasicEmail Display ###
class DateEmailDisplay extends BasicEmailDisplay
    constructor: (@parent, @mid, index) ->
        @placeholder = get("placeholder_" + @mid) || new HTML('div', { class: "email_placeholder", id: "placeholder_" + @mid})
        
        
        ### Inject into listview or body ###
        @parent.inject(@placeholder)
        
        ### Make sure it's empty, may have been used before! ###
        @placeholder = @placeholder.empty()
        @placeholder.show(true)
        
        me = this
        
        ### Find the thread or fake one ###
        thread = {tid: @mid}
        if index and ponymail_current_listview and ponymail_current_listview.json.thread_struct[index]
            thread = ponymail_current_listview.json.thread_struct[index]
        
        
        emails = [[@mid, 0]]
        for item in @dateSort(thread)
            emails.push(item)
        for email in emails
            @dateFetch(@placeholder, email[0])
        return this
        
    dateSort: (thread) ->
        list = []
        if thread.children and isArray(thread.children)
            for item in thread.children
                list.push([item.tid, item.epoch])
                for citem in @dateSort(item)
                    list.push(citem)
        list.sort((a,b) => a[1] > b[1])
        return list
        
    dateFetch: (parent, thread) ->
        ### Make the thread item placeholder ###
        bodyplace = new HTML('div', {id: "placeholder_#{@mid}_#{thread}", class:"email_boxed"})
        
        ### Assign a random color to the left ###
        @prevColor = @prevColor || ""
        bcolors = ['#C93F20', '#20C94A', '#2063C9', '#C9AA20', '#AD20C9', '#99C920', '#20C9C3']
        bcolor = bcolors[Math.round(Math.random()*bcolors.length)]
        ### ensure we don't get the same color twice in a row ###
        while bcolor == @prevColor
            bcolor = bcolors[Math.round(Math.random()*bcolors.length)]
        @prevColor = bcolor
        
        bodyplace.style.borderLeft = "4px solid " + bcolor
        
        replyplace = new HTML('div', {
                                id: "thread_replies_#{@mid}_#{thread}",
                                style: {
                                    
                                    marginLeft: "20px"
                                  }
                              })
        place = new HTML('div',
                         {
                            id: "thread_parent_#{@mid}_#{thread}",
                            style: {
                                float: "left"
                                width: "100%"
                                    }
                        }, [
                            bodyplace,
                            replyplace
                        ]
                        )
        parent.inject(place)
        
        ### Do we have this email in cache? ###
        if ponymail_stored_email[thread]
            @render(ponymail_stored_email[thread])
        else
            me = this
            ### Not stored, fetch the email first ###
            r = new HTTPRequest("api/email.lua?", {
                get: {
                    id: thread
                }
                callback: (json, state) ->
                    me.render(json, state)
            })
        
ponymail_register_display('date', "Stacked view", DateEmailDisplay)
