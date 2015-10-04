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
        var a = document.createElement("a")
        var t = document.createTextNode(dom)
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
    
    var obj = document.getElementById('domains')
    if (!obj) {
        return
    }
    document.getElementById('login_disclaimer').style.display = "block"
    if (json.login && json.login.credentials && json.login.credentials.fullname) {
        document.getElementById('welcome').innerHTML = "Welcome, " + json.login.credentials.fullname.split(/ /)[0] + "!"
        document.getElementById('login_disclaimer').innerHTML = "Not " + json.login.credentials.fullname.split(/ /)[0] + "? <a href='javascript:void(0);' onclick='logout();'>Log out</a> then!"
        setupUser(json.login)
    } else {
        document.getElementById('login_disclaimer').style.display = "block"
    }
    var doms = []
    for (var key in json.lists) {
        doms.push(key)
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


// listDomains: fetch prefs and ML stats
function listDomains() {
    GetAsync("/api/preferences.lua", null, seedDomains)
    GetAsync("/api/pminfo.lua", null, showStats)
}
