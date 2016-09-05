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

### This is the basic scaffolding for all pages ###

headerScaffolding = () ->
    ### Start off by making the top menu ###
    menu = new HTML('div', { id: "topMenu"})
    document.body.inject(menu)
    
    # Add menu points
    ul = new HTML('ul', { id: 'listmenu'})
    
    # Add logo first
    logo = new HTML('li', {
        class: 'logo'
    }, new HTML('a', {
        href: "./"
    }, new HTML('img', {
        src: "images/logo.png",
        style: {
            paddingRight: "10px",
            height: "38px",
            width: "auto"
        }
    })))
    ul.inject(logo)
    menu.inject(ul)
    
footerScaffolding = () ->
    ### Add a footer ###
    footer = new HTML('div', { id: "footer"})
    document.body.inject(footer)
    footer.inject([
        "Powered by ",
        new HTML('a', { href: 'https://ponymail.incubator.apache.org/'}, "Apache Pony Mail (Incubating) v/#{ponymail_version}"),
        ". Copyright 2016, the Apache Software Foundation."
    ])
    
    
    
listviewScaffolding = () ->
    
    ### Header scaffolding ###
    headerScaffolding()
    
    ### Now, make the base div ###
    mainDiv = new HTML('div', { id: "contents"})
    document.body.inject(mainDiv)
    
    ### Make the title ###
    header = new HTML('h2', {id: "header"}, "Loading list data...")
    mainDiv.inject(header)
    
    ### Then make the calendar placeholder ###
    calHolder = new HTML('div', { id: "calendar"})
    mainDiv.inject(calHolder)
    calHolder.inject(new HTML('h3', {}, "Archive:"))
    
    
    
    ### Finally, make the list view placeholder ###
    listDiv = new HTML('div', { id: "listview", class: "sbox"})
    mainDiv.inject(listDiv)
    
    ### Footer ###
    footerScaffolding()
    
    ### Make an API call to the preferences script, have it call back to listView once done ###
    r = new HTTPRequest("api/preferences.lua", {
        callback: setupAccount
        state: {
            listview: true
        }
    })
    
    
    
### Permalink view callback ###
scaffoldingEmailCallback = (json, state) ->
    e = new ThreadedEmailDisplay(null, null, null, json.thread)
    return
    
    
### Permalink view ###
threadScaffolding = () ->
    
    ### Header scaffolding ###
    headerScaffolding()
    
    ### Now, make the base div ###
    mainDiv = new HTML('div', { id: "email_placeholder", style: { width: "90%"}})
    document.body.inject(mainDiv)
    
    ### Footer ###
    footerScaffolding()
    
    ### Make an API call to the preferences script, have it call back to listView once done ###
    mid = location.href.match(/thread\.html\/(.+)/)[1]
    r = new HTTPRequest("api/thread.lua?id=" + mid, {
        callback: scaffoldingEmailCallback
        
    })
    
