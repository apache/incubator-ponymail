/*
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
*/

var phonebook_json, table_json

// showDomains: Show domains in the phone book display
function showDomains(l) {
    var pg = document.getElementById('active_domlist')
    pg.innerHTML = ""
    var ul = document.createElement('ul')
    ul.style.textAlign = "left"
    ul.style.listStyle = "none"
    ul.style.paddingTop = "12px"
    for (var i in domlist[l]) {
        var dom = domlist[l][i]
        var letter = dom.substr(0,1)
        // Make ML entry
        var li = document.createElement("li")
        li.style.padding = "2px"
        //li.setAttribute("class", "phonebook_entry")
        var extend =  ""
        if (pm_config.indexMode == 'phonebook_short' && phonebook_json && phonebook_json.descriptions) {
            for (var g in phonebook_json.descriptions) {
                if (phonebook_json.descriptions[g] == '<'+dom+'>') {
                    extend = ": " + phonebook_json.descriptions[g].description
                }
            }
        }
        var a = document.createElement("a")
        var t = document.createTextNode(dom + extend)
        a.setAttribute("href", "list.html?" + dom)
        a.appendChild(t)
        li.appendChild(a)
        ul.appendChild(li)
    }
    pg.appendChild(ul)
    
    var ls = "abcdefghijklmnopqrstuvwxyz".split("")
    for (var i in ls) {
        var xl = ls[i]
        if (l == xl) {
            document.getElementById('letter_' + xl).setAttribute("class", "phonebook_topletter_active")
        } else {
            document.getElementById('letter_' + xl).setAttribute("class", "phonebook_topletter")
        }
    }
}


// seedDomains: get account info and seed the phonebook
function seedDomains(json) {
    phonebook_json = json
    var obj = document.getElementById('domains')
    if (!obj) {
        return
    }
    document.getElementById('login_disclaimer').style.display = "block"
    if (prefs.fullname && json.login) {
        json.login.credentials.fullname = prefs.fullname
    }
    if (json.login && json.login.credentials && json.login.credentials.fullname) {
        document.getElementById('welcome').innerHTML = "Welcome, " + json.login.credentials.fullname.split(/ /)[0] + "!"
        document.getElementById('login_disclaimer').innerHTML = "Not " + json.login.credentials.fullname.split(/ /)[0] + "? <a href='javascript:void(0);' onclick='logout();'>Log out</a> then!"
        login = json.login
        setupUser(json.login)
    } else {
        document.getElementById('login_disclaimer').style.display = "block"
    }
    var doms = []
    if (pm_config.indexMode == 'phonebook_short') {
        for (var key in json.lists) {
            for (var list in json.lists[key]) {
                doms.push(list + '@' + key)
            }
        }
    } else {
        for (var key in json.lists) {
            doms.push(key)
        }
    }
    
    doms.sort()
    var lu = {}
    var pg;
    var letters = []
    for (var i in doms) {
        var dom = doms[i]
        var letter = dom.substr(0,1)
        letters.push(letter)
        domlist[letter] = domlist[letter] ? domlist[letter] : []
        domlist[letter].push(dom)
    }
    
    var po = document.createElement("div")
    
    po.style.textAlign = "left"
    po.style.margin = "0px"
    var x = 0;
    var ls = "abcdefghijklmnopqrstuvwxyz".split("")
    for (var i in ls) {
        var l = ls[i]
        fl = fl ? fl : l
        var pc = document.createElement("label")
        pc.setAttribute("class", "phonebook_topletter")
        pc.setAttribute("id", "letter_" + l)
        pc.appendChild(document.createTextNode(l.toUpperCase()))
        pc.setAttribute("onclick", "showDomains('" + l + "');")
        pc.style.cursor = "pointer"
        po.appendChild(pc)
    }
    obj.appendChild(po)
    var dshow = document.createElement('div')
    dshow.setAttribute("class", "phonebook_page")
    dshow.setAttribute("id", "active_domlist")
    obj.appendChild(dshow)
    if (doms.length == 0) {
        obj.innerHTML = "There doesn't seem to be any domains or mailing lists here yet..."
    } else {
        showDomains(fl)
    }
}



// seedTable: get account info and seed a table view instead of a phonebook view
function seedTable(json) {
    table_json = json
    var obj = document.getElementById('domains')
    if (!obj) {
        return
    }
    
    // This is the usual login message, same in all view modes
    document.getElementById('login_disclaimer').style.display = "block"
    if (prefs.fullname && json.login) {
        json.login.credentials.fullname = prefs.fullname
    }
    if (json.login && json.login.credentials && json.login.credentials.fullname) {
        document.getElementById('welcome').innerHTML = "Welcome, " + json.login.credentials.fullname.split(/ /)[0] + "!"
        document.getElementById('login_disclaimer').innerHTML = "Not " + json.login.credentials.fullname.split(/ /)[0] + "? <a href='javascript:void(0);' onclick='logout();'>Log out</a> then!"
        login = json.login
        setupUser(json.login)
    } else {
        document.getElementById('login_disclaimer').style.display = "block"
    }
    var lists = []
    var lnum = {}
    
    
    // Push lists and the no. of messages into lists
    for (var key in json.lists) {
        for (var list in json.lists[key]) {
            var num = json.lists[key][list]
            lists.push(list + '@' + key)
            lnum[list+'@'+key] = num
        }
    }
    
    // sort lists by name before iterating
    lists.sort()
    
    var po = document.createElement("div")
    
    po.style.textAlign = "left"
    po.style.margin = "0px"
    
    // Got any lists?
    if (lists.length == 0) {
        obj.innerHTML = "There doesn't seem to be any domains or mailing lists here yet..."
    } else {
        var title = document.createElement('h4')
        title.appendChild(document.createTextNode('Available lists:'))
        obj.appendChild(title)
        // for each list, show the name and the no. of emails in the past 90 days (3 months)
        for (var i in lists) {
            var list = lists[i]
            var d = document.createElement('div')
            d.setAttribute("class", "listtablekid")
            d.innerHTML = "<a href='list.html?" + list + "'><b>" + list + "</b></a> - " + lnum[list] + " messages in the past 3 months."
            d.setAttribute("onclick", "location.href = 'list.html?" + list + "';")
            
            // if possible, append description of list here
            for (var z in json.descriptions) {
                if (json.descriptions[z].lid == list) {
                    d.innerHTML += "<br/><small>" + json.descriptions[z].description.replace(/</, "&lt;") + "</small>"
                }
            }
            obj.appendChild(d)
        }
    }
    document.getElementById('phonebook_help').innerHTML = "Pick a mailing list to start viewing emails"
}


// listDomains: fetch prefs and ML stats
function listDomains() {
    
    // phonebook modes?
    if (pm_config.indexMode.match(/phonebook/)) {
        GetAsync("/api/preferences.lua", null, seedDomains)
        
    // Table view mode?
    } else if (pm_config.indexMode == 'table') {
        GetAsync("/api/preferences.lua?detailed=true", null, seedTable)
    }
    
    GetAsync("/api/pminfo.lua", null, showStats)
}
