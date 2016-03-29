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


// logout: log out a user
// call the logout URL, then refresh this page - much simple!
function logout() {
    GetAsync("/api/preferences.lua?logout=true", null, function() { location.href = document.location; })
}


// savePreferences: save account prefs to ES
function savePreferences() {
    var prefarr = []
    // for each preference
    for (var i in pref_keys) {
        var key = pref_keys[i]
        // try to fetch the input field holding this pref
        var o = document.getElementById(key)
        var val = o ? o.value : null
        // if it's a select box, fetch the selected value
        if (o && o.selectedIndex) {
            val = o.options[o.selectedIndex].value
        }
        // if we found a value, push it to a form hash and the prefs hash
        if (val) {
            prefarr.push(key + "=" + val)
            prefs[key] = val
        }
    }
    // save preferences on backend
    GetAsync("/api/preferences.lua?save=true&" + prefarr.join("&"), null, hideComposer)
    
    // Save ephemeral settings
    if (typeof(window.localStorage) !== "undefined") {
        window.localStorage.setItem("ponymail_config_ephemeral", JSON.stringify(prefs))
    }
}

// showPreferences: show the account prefs in the splash window
function showPreferences() {
    var obj = document.getElementById('splash')
    obj.style.display = "block"
    obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here<big> &#x2612;</big></a></p><h3>User preferences:</h3>"
    obj.innerHTML += "<p>You can change your preferences here. Some changes may not take place til you refresh your view.</p>"
    
    
    // set up account section
    var section = document.createElement('div')
    section.setAttribute("class", "bs-callout bs-callout-success prefs")
    section.innerHTML = "<h4>Account information:</h4>"
    
    // full name
    section.appendChild(generateFormDivs('fullname', 'Full name:', 'text', prefs.fullname ? prefs.fullname : login.credentials.fullname))
    
    obj.appendChild(section)
    
    // set up view section
    var section = document.createElement('div')
    section.setAttribute("class", "bs-callout bs-callout-primary prefs")
    section.innerHTML = "<h4>Viewing preferences:</h4>"
    
    
    // Display mode
    section.appendChild(generateFormDivs('displayMode', 'Display mode, list view:', 'select', {
        threaded: "Threaded view",
        flat: "Flat view",
        treeview: "Threaded with treeview"
    }, prefs.displayMode))
    
    // groupBy mode
    section.appendChild(generateFormDivs('groupBy', 'Display mode, email view:', 'select', {
        thread: "Threaded view, nest by reference",
        date: "Flat view, order by date"
    }, prefs.groupBy))
    
    // sortOrder mode
    section.appendChild(generateFormDivs('sortOrder', 'Sort order in email view:', 'select', {
        forward: "Sort emails by date, ascending",
        backward: "Sort emails by date, descending"
    }, prefs.sortOrder))
    
    // compactQuotes mode
    section.appendChild(generateFormDivs('compactQuotes', 'Compact quotes in emails:', 'select', {
        yes: "Yes",
        no: "No"
    }, prefs.compactQuotes))
    
    // social mode
    section.appendChild(generateFormDivs('theme', 'Email view theme:', 'select', {
        social: "Social theme",
        compact: "Compact theme",
        default: "Default theme"
    }, prefs.theme))
    
    // hideStats mode
    section.appendChild(generateFormDivs('hideStats', 'Hide statistics window:', 'select', {
        yes: "Yes",
        no: "No"
    }, prefs.hideStats))
    
    // autoScale mode
    section.appendChild(generateFormDivs('autoScale', 'Scale results per page to window height:', 'select', {
        no: "No",
        yes: "Yes"
    }, prefs.autoScale))
    
    var btn = document.createElement('input')
    btn.setAttribute("type", "button")
    btn.setAttribute("class", "btn btn-warning")
    btn.setAttribute("value", "Save preferences")
    btn.setAttribute("onclick", "savePreferences()")
    
    
    
    obj.appendChild(section)
    
    
    
    // set up notifications section
    var section = document.createElement('div')
    section.setAttribute("class", "bs-callout bs-callout-success prefs")
    section.innerHTML = "<h4>Notification preferences:</h4>"
    
    // notifications mode
    section.appendChild(generateFormDivs('notifications', 'Notify me on:', 'select', {
        direct: "Only direct replies to my emails",
        indirect: "Any reply that references my email",
        none: "Don't notify me at all!"
    }, prefs.notifications))
    
    obj.appendChild(section)
    
    // Save button
    obj.appendChild(btn)
}


// setupUser: Set up the user dropdown (top right)
function setupUser() {
    var uimg = document.getElementById('uimg')
    if (!uimg) {
        return
    }
    var base = pm_config.URLBase ? pm_config.URLBase : ""
    base = base.replace(/\/+/g, "/")
    
    uimg.setAttribute("src", base + "/images/user.png")
    uimg.setAttribute("title", "Logged in as " + login.credentials.fullname)
    if (login.notifications && login.notifications > 0) {
        uimg.setAttribute("src", base + "/images/user_notif.png")
        uimg.setAttribute("title", "Logged in as " + login.credentials.fullname + " - You have " + login.notifications + " new notifications!")
    }
    var pd = document.getElementById('prefs_dropdown')
    pd.innerHTML = ""
    
    // thread item
    var li = document.createElement("li")
    var a = document.createElement("a")
    var t = document.createTextNode("Start a new discussion")
    a.setAttribute("href", "javascript:void(0);")
    a.setAttribute("onclick", "compose(null, 'xlist')")
    a.appendChild(t)
    li.appendChild(a)
    pd.appendChild(li)
    
    
    // Prefs item
    var li = document.createElement("li")
    var a = document.createElement("a")
    var t = document.createTextNode((prefs.fullname ? prefs.fullname : login.credentials.fullname) + "'s preferences")
    a.setAttribute("href", "javascript:void(0);")
    a.setAttribute("onclick", "showPreferences()")
    a.appendChild(t)
    li.appendChild(a)
    pd.appendChild(li)
    
    // Notifications item
    var li = document.createElement("li")
    var a = document.createElement("a")
    var t = document.createTextNode("Notifications")
    a.setAttribute("href", "notifications.html")
    
    a.appendChild(t)
    if (login.notifications && login.notifications > 0) {
        a.setAttribute("style", "font-weight: bold;")
        t.nodeValue = "Notifications (" + login.notifications + ")"
        a.innerHTML += ' <span class="glyphicon glyphicon-star"> </span>'
    }
    
    li.appendChild(a)
    pd.appendChild(li)
    
    // Favorites
    if (login.favorites && login.favorites.length > 0) {
        var li = document.createElement("li")
        li.setAttribute("class", "dropdown-submenu pull-left")
        var a = document.createElement("a")
        var t = document.createTextNode("Favorite lists")
        a.setAttribute("href", "#")
        a.appendChild(t)
        var ul = document.createElement('ul')
        ul.setAttribute("class", "dropdown-menu")
        a.setAttribute("tabindex", "-1")
        li.appendChild(a)
        ul.style.left = "0"
        li.appendChild(ul)
        for (var i in login.favorites) {
            var l = login.favorites[i]
            var sli = document.createElement('li')
            sli.setAttribute("class", "pull-left")
            var st = document.createTextNode(l)
            var sa = document.createElement('a')
            sa.setAttribute("href", "list.html?" + l)
            sa.appendChild(st)
            sli.appendChild(sa)
            ul.appendChild(sli)
        }
        
        pd.appendChild(li)
    }
    
    
    // Merge accounts item
    var li = document.createElement("li")
    var a = document.createElement("a")
    var t = document.createTextNode("Manage email addresses")
    a.setAttribute("href", "merge.html")
    a.appendChild(t)
    
    li.appendChild(a)
    pd.appendChild(li)
    
    // Logout item
    var li = document.createElement("li")
    var a = document.createElement("a")
    var t = document.createTextNode("Log out")
    a.setAttribute("href", "javascript:void(0);")
    a.setAttribute("onclick", "logout()")
    a.appendChild(t)
    li.appendChild(a)
    pd.appendChild(li)
}


// set theme, both in prefs and localstorage (for non-logged-in-users)
function setTheme(theme) {
    prefs.theme = theme
    if (typeof(window.localStorage) !== "undefined") {
        window.localStorage.setItem("pm_theme", theme)
    }
    if (document.getElementById('emails')) {
        buildPage()
    }
}
