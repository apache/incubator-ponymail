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

### threaded email display class - extends BasicEmail Display ###
class ThreadedEmailDisplay extends BasicEmailDisplay
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
        
        @threadedFetch(@placeholder, thread, 1)
        return this
        
    threadedFetch: (parent, thread, nestedness) ->
        ### Make the thread item placeholder ###
        bodyplace = new HTML('div', {id: "placeholder_#{@mid}_#{thread.tid}", class:"email_boxed"})
        
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
                                id: "thread_replies_#{@mid}_#{thread.tid}",
                                style: {
                                    
                                    marginLeft: "20px"
                                  }
                              })
        place = new HTML('div',
                         {
                            id: "thread_parent_#{@mid}_#{thread.tid}",
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
        if ponymail_stored_email[thread.tid]
            @render(ponymail_stored_email[thread.tid])
        else
            me = this
            ### Not stored, fetch the email first ###
            r = new HTTPRequest("api/email.lua?", {
                get: {
                    id: thread.tid
                }
                callback: (json, state) ->
                    me.render(json, state)
                state: {
                    nest: Math.min(nestedness+1, 5) # Don't wanna nest more than 5 levels!
                }
            })
        
        ### Now do the same for each child item ###
        if thread.children and isArray(thread.children) and thread.children.length > 0
            for item in thread.children
                @threadedFetch(replyplace, item, Math.min(nestedness+1, 5))
        return this
    
        