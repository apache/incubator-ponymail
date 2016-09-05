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

### dealWithKeyboard: Handles what happens when you hit the escape key ###
dealWithKeyboard = (e) ->
    splash = get('splash')
    
    ### escape key: hide composer/settings/thread ###
    if (e.keyCode == 27)
        
        if (splash and splash.style.display == 'block')
            splash.style.display = "none"
            #saveDraft()
        else if (location.href.search(/list\d?\.html/) != -1)
            ### should only work for the list view ###
            
            ### If datepicker popup is shown, hide it on escape ###
            dp = get('datepicker_popup')
            if dp and dp.style.display == "block"
                dp.show(false)
            
            else if ponymail_email_open.length > 0
                ### Close the currently open email? ###
                if ponymail_current_email
                    ponymail_current_email.hide()
                else
                    ### Close all email ? ###
                    while ponymail_email_open.length > 0
                        ponymail_email_open[0].hide()

                    
                    
    ### Make sure the below shortcuts don't interfere with normal operations ###
    if splash and splash.style.display != 'block' and document.activeElement.nodeName != 'INPUT' and not e.ctrlKey
        ### H key: show help ###
        if (e.keyCode == 72)
            popup("Keyboard shortcuts",
                  "<pre>\
                  <b>H:</b>Show this help menu<br/>\
                  <b>C:</b>Compose a new email to the current list<br/>\
                  <b>R:</b>Reply to the last opened email<br/>\
                  <b>S:</b>Go to the quick search bar<br/>\
                  <b>Esc:</b>Hide/collapse current email or thread<br/>\
                  </pre>\
                  You can also, in some cases, use the mouse wheel to scroll up/down the list view",
                  10
                  )
        
        else if e.keyCode == 67
            ### C key: compose ###
            compose(null, ponymail_list, 'new')
        else if e.keyCode == 82
            ### R key: reply ###
            if (ponymail_current_email && ponymail_email_open.length > 0)
                compose(last_opened_email, null, 'reply')
        else if e.keyCode == 83
            ### S key: quick search ###
            if get('q')
                get('q').focus()

    ### Page Up - scroll list view if possible ###
    if e.keyCode == 33 and ponymail_current_listview
        ponymail_current_listview.swipe('up')
    
    ### Page Down - scroll list view if possible ###
    if e.keyCode == 34 and ponymail_current_listview
        ponymail_current_listview.swipe('down')
    
### Add listener for keys (mostly for escape key for hiding stuff) ###
window.addEventListener("keyup", dealWithKeyboard, false);
