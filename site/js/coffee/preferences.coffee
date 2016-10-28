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

### maxLists: default max lists to show in top menu before resorting to 'more lists' ###
maxLists = 2

setupAccount = (json, state) ->
    myDomain = []
    
    ### run parseURL for fetch list and domain ###
    parseURL()
    
    ### set up the list of...lists ###
    if json and isHash(json.lists)
        for domain, lists of json.lists
            ponymail_lists[domain] = lists
            ### if current domain, set up the top menu to use it ###
            if domain == ponymail_domain
                myDomain = lists
        
    ### Are we on list.html? ###
    if state.listview
        ### Generate the lists part of the top menu ###
        lmenu = get('listmenu')
        if lmenu
            ### Make an array of mailing lists ###
            sortedList = []
            for list, number of myDomain
                sortedList.push(list)
            ### Sort descending by business ###
            sortedList.sort((a,b) => if myDomain[a] < myDomain[b] then 1 else -1)
            for list in sortedList[0..maxLists-1]
                li = new HTML('li', {},
                              new HTML('a', { href: "?#{list}@#{ponymail_domain}", onclick: "listView({month: '', list: '#{list}@#{ponymail_domain}'}); return false;"}, list+'@')
                              )
                lmenu.inject(li)
                
            ### Do we have more lists?? ###
            if sortedList.length > maxLists
                ### Remove the first N lists, sort the rest by name ###
                sortedList.splice(0,maxLists)
                sortedList.sort()
                
                li = new HTML('li', {}, "More lists ⌄")
                lmenu.inject(li)
                
        ### Call listView to fetch email ###
        listView(null, true)
