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

// displayEmail: Shows an email inside a thread
function displayEmail(json, id, level) {
    // Level indicates the nestedness if threaded view (indentation)
    level = level ? level : 1
    if (!json.mid && !json.tid) {
        alert("404: Could not find this email!")
        return
    }
    if (current_thread_mids[json.mid]) {
        return
    } else {
        current_thread_mids[json.mid] = true
        current_email_msgs.push(json)
    }
    
    // URI Base
    var base = pm_config.URLBase ? pm_config.URLBase : ""
    base = base.replace(/\/+/g, "/")
    
    // Save the JSON in our JS array so we don't have to fetch it again later
    saved_emails[json.mid] = json
    var estyle = ""
    last_opened_email = json.mid
    
    // color based on view before or not??
    if (storageAvailable) {
        if (typeof(window.localStorage) !== "undefined") {
            if (! window.localStorage.getItem("viewed_" + json.mid) ){
                //estyle = "linear-gradient(to bottom, rgba(252,255,244,1) 0%,rgba(233,233,206,1) 100%)"
                
                try {
                    window.localStorage.setItem("viewed_" + json.mid, json.epoch)
                } catch(e) {
                    
                }
            }
            if (window.localStorage.getItem("viewed_" + json.mid) && window.localStorage.getItem("viewed_" + json.mid).search("!") == 10){
                //estyle = "linear-gradient(to bottom, rgba(252,255,244,1) 0%,rgba(233,233,206,1) 100%)"
                var epoch = parseInt(window.localStorage.getItem("viewed_" + json.mid))
                try {
                    window.localStorage.setItem("viewed_" + json.mid, epoch + ":")
                } catch(e) {
                    
                }
                
            }
        }
    }
    // Coloring for nested emails
    var cols = ['primary', 'success', 'info', 'warning', 'danger']
    
    // Sanitise email ID and find the <div> object it's supposed to go into
    var id_sanitised = id.toString().replace(/@<.+>/, "")
    var thread = document.getElementById('thread_' + id_sanitised)
    if (thread) {
        json.date = formatDate(new Date(json.epoch*1000), true)
        // transform <foo.bar.tld> to foo@bar.tld
        var lid = json.list.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
        
        // Escape email body, convert < to &lt;
        var ebody = json.body
        ebody = ebody.replace(/</mg, "&lt;")
        ebody = "\n" + ebody // add a newline at top
        var base = pm_config.URLBase ? pm_config.URLBase : ""
        base = base.replace(/\/+/g, "/")
        // If we're compacting quotes in the email, let's...do so with some fuzzy logic
        if (prefs.compactQuotes == 'yes') {
            ebody = ebody.replace(/((?:\r?\n)((on .+ wrote:[\r\n]+)|(sent from my .+)|(>+[ \t]+[^\r\n]*\r?\n[^\n]*\n*)+)+)+/mgi, function(inner) {
                var rnd = (Math.random() * 100).toString()
                inner = inner.replace(/>/g, "&gt;")
                var html = "<div class='bs-callout bs-callout-default' style='margin: 3px; padding: 2px;' id='parent_" + rnd + "'>" +
                    "<img src='" + base + "/images/quote.png' title='show/hide original text' onclick='toggleView(\"quote_" + rnd + "\")'/><br/>" +
                    "<div style='display: none;' id='quote_" + rnd + "'>" + inner + "</div></div>"
                return html
            })
        }
        
        // Turn URLs into <a> tags
        ebody = ebody.replace(re_weburl, "<a href='$1'>$1</a>")
        
        // Get theme (social, default etc) if set locally in browser
        if (storageAvailable) {
            if (typeof(window.localStorage) !== "undefined") {
                var th = window.localStorage.getItem("pm_theme")
                if (th) {
                    prefs.theme = th
                }
            }
        }
        
        // Social theme rendering
        if (prefs.theme && prefs.theme == "social") {
            
            // Date and sender formatting
            var sdate = new Date(json.epoch*1000).toLocaleString('en-US',  { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' })
            var fr = json['from'].replace(/"/g, "").replace(/<.+>/, "").replace(/</g, "&lt;")
            thread.style.background = estyle
            
            // Don't indent if we're too deeply nested, it gets weird looking
            if (level <= 6) {
                thread.style.marginLeft = "40px"
            }
            
            thread.style.marginTop = "40px"
            thread.innerHTML = "<img src='https://secure.gravatar.com/avatar/" + json['gravatar'] + ".jpg?s=48&r=g&d=mm' style='vertical-align:middle'/> &nbsp; <b>" + fr + "</b> - " + sdate
            thread.innerHTML += ' &nbsp; <label class="label label-success" onclick="compose(\'' + json.mid + '\');" style="cursor: pointer; float: right; margin-left: 10px;">Reply</label>'
            if (level > 1) {
                thread.innerHTML += ' &nbsp; <a href="javascript:void(0);" onclick="rollup(\'' + id_sanitised + '\');"><label class="label label-primary" title="roll up" style="cursor: pointer; float: right; margin-right: 10px;"><span id="rollup_' + id_sanitised + '" class="glyphicon glyphicon-chevron-up"> </span></label></a> &nbsp; '
            }
            thread.innerHTML += "<br/><br/>"
            
            // Make the colored bar to the left that indicates nest level
            var bclass = "bubble-" + cols[parseInt(Math.random() * cols.length - 0.01)]
            // append body
            thread.innerHTML += "<div class='" + bclass + "' style='padding: 8px; font-family: Hack; word-wrap: normal; white-space: pre-line; word-break: normal;'>" + ebody + '</div>'
            
            // Do we have attachments in this email?
            if (json.attachments && json.attachments.length > 0) {
                thread.innerHTML += "<b>Attachments: </b>"
                for (var a in json.attachments) {
                    // figure out name and size in kb (or bytes if < 1024)
                    var fd = json.attachments[a]
                    var size = parseInt(fd.size/1024)
                    if (size > 0) {
                        size = size.toLocaleString() + " kb"
                    } else {
                        size = fd.size.toLocaleString() + " bytes"
                    }
                    thread.innerHTML += "<a href='" + base + "/api/email.lua?attachment=true&id=" + json.tid + "&file=" + fd.hash + "'>" + fd.filename.replace(/</g, "&lt;") + "</a> (" + size + ") &nbsp; "
                }
                thread.innerHTML += "<br/>"
            }
            // This is for the 'highlight new emails' feature
            if (thread.hasAttribute("meme")) {
                thread.scrollIntoView()
                thread.style.background = "rgba(200,200,255, 0.25)"
            }
        }
        // Default theme
        else {
            thread.setAttribute("class", "reply bs-callout bs-callout-" + cols[parseInt(Math.random() * cols.length - 0.01)])
            thread.style.background = estyle
            thread.style.marginTop = "30px"
            thread.innerHTML += ' &nbsp; <label class="label label-success" onclick="compose(\'' + json.mid + '\');" style="cursor: pointer; float: right; margin-left: 10px;">Reply</label>'
            thread.innerHTML += ' &nbsp; <a href="' + base + '/thread.html/'+(pm_config.shortLinks ? shortenID(json.mid) : json.mid)+'"><label class="label label-warning" style="cursor: pointer; float: right;">Permalink</label></a>'
            thread.innerHTML += ' &nbsp; <a href="' + base + '/api/source.lua/'+json.mid+'"><label class="label label-danger" style="cursor: pointer; float: right; margin-right: 10px;">View Source</label></a> &nbsp; '
            if (level > 1) {
                thread.innerHTML += ' &nbsp; <a href="javascript:void(0);" onclick="rollup(\'' + id_sanitised + '\');"><label class="label label-primary" title="roll up" style="cursor: pointer; float: right; margin-right: 10px;"><span id="rollup_' + id_sanitised + '" class="glyphicon glyphicon-chevron-up"> </span></label></a> &nbsp; '
            }
            
            
            thread.innerHTML += "<br/>"
            //thread.style.border = "1px dotted #666"
            thread.style.padding = "5px"
            thread.style.fontFamily = "Hack"
            
            var fields = ['From', 'To', 'CC', 'Subject', 'Date']
            for (var i in fields) {
                var key = fields[i]
                if (json[key.toLowerCase()] != undefined && json[key.toLowerCase()].length > 0) {
                    thread.innerHTML += "<b>" + key + ": </b>" + json[key.toLowerCase()].replace(/</g, "&lt;") + "<br/>"
                }
            }
            if (json.private) {
                thread.innerHTML += "<font color='#C00'><b>Private: </b> YES</font><br/>"
                if (level == 1) {
                    thread.style.backgroundImage = "url(/images/private.png)"
                }
            }
            
            thread.innerHTML += "<b>List: </b><a href='" + base + "/list.html?" + lid + "'>" + lid + "</a><br/>"
            if (json.attachments && json.attachments.length > 0) {
                thread.innerHTML += "<b>Attachments: </b>"
                for (var a in json.attachments) {
                    var fd = json.attachments[a]
                    var size = parseInt(fd.size/1024)
                    if (size > 0) {
                        size = size.toLocaleString() + " kb"
                    } else {
                        size = fd.size.toLocaleString() + " bytes"
                    }
                    var base = pm_config.URLBase ? pm_config.URLBase : ""
                    base = base.replace(/\/+/g, "/")
                    thread.innerHTML += "<a href='" + base + "/api/email.lua?attachment=true&id=" + json.tid + "&file=" + fd.hash + "'>" + fd.filename.replace(/</g, "&lt;") + "</a> (" + size + ") &nbsp; "
                }
                thread.innerHTML += "<br/>"
            }
            
            var pv = ""
            if (json.private) {
                    pv = "background: none !important;"
                }
            thread.innerHTML += "<pre style='color: inherit; padding: 8px; font-family: Hack; word-wrap: normal; white-space: pre-line; word-break: normal; " + pv + "'>" + ebody + '</pre>'
            
            // Same as with social theme - "highlight new emails"
            if (thread.hasAttribute("meme")) {
                thread.scrollIntoView()
                thread.style.background = "rgba(200,200,255, 0.25)"
            }
        }
    } else {
        alert("Error, " + id + " not found :(")
    }
}


// displaySingleEmail: shows a single email. Used for permalinks
function displaySingleEmail(json, id) {

    var thread = document.getElementById('email')
    if (thread) {
        if (storageAvailable) {
            if (typeof(window.localStorage) !== "undefined") {
                if (! window.localStorage.getItem("viewed_" + json.id) ){
                    estyle = "background: background: linear-gradient(to bottom, rgba(252,255,244,1) 0%,rgba(233,233,206,1) 100%);"
                    try {
                        window.localStorage.setItem("viewed_" + json.id, latestEmailInThread + "!")
                    } catch(e) {
                        
                    }
                }
            }
        }
        thread.setAttribute("class", "reply bs-callout bs-callout-info")
        thread.innerHTML = ''
        thread.style.padding = "5px"
        thread.style.fontFamily = "Hack"
        if (json.error) {
            thread.innerHTML = "<h4>Error: " + json.error + "</h4>"
            return;
        }
        json.date = new Date(json.epoch*1000).toLocaleString();
        var fields = ['From', 'To', 'Subject', 'Date']
        var fields = ['From', 'To', 'CC', 'Subject', 'Date']
        for (var i in fields) {
            var key = fields[i]
            if (json[key.toLowerCase()] != undefined) {
                thread.innerHTML += "<b>" + key + ": </b>" + json[key.toLowerCase()].replace(/</g, "&lt;") + "<br/>"
            }
        }
        if (json.private) {
            thread.innerHTML += "<font color='#C00'><b>Private list: </b> YES</font><br/>"
        }
        var lid = json.list.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")

        var ebody = json.body
        ebody = ebody.replace(/</, "&lt;")
        ebody = "\n" + ebody
        var base = pm_config.URLBase ? pm_config.URLBase : ""
        base = base.replace(/\/+/g, "/")
        if (true) {
            ebody = ebody.replace(/(?:\r?\n)((>+[ \t]+[^\r\n]*\r?\n+)+)/mg, function(inner) {
                var rnd = (Math.random() * 100).toString()
                var html = "<div class='bs-callout bs-callout-default' style='padding: 2px;' id='parent_" + rnd + "'>" +
                    "<img src='" + base + "/images/quote.png' title='show/hide original text' onclick='toggleView(\"quote_" + rnd + "\")'/><br/>" +
                    "<div style='display: none;' id='quote_" + rnd + "'>" + inner + "</div></div>"
                return html
            })
        }

        ebody = ebody.replace(re_weburl, "<a href=\"$1\">$1</a>")

        thread.innerHTML += "<b>List ID: </b><a href='" + base + "/list.html?" + lid + "'>" + lid + "</a><br/>"
        thread.innerHTML += "<br/><pre style='font-family: Hack;'>" + ebody + '</pre>'
    } else {
        alert("Error, " + id + " not found :(")
    }
}




// displayEmailThreaded: Appends an email to a threaded display of a topic
function displayEmailThreaded(json, state, threadobj) {
    var level = state.level ? state.level : 1
    var b = state.before
    var cobj = document.getElementById("thread_" + b.toString().replace(/@<.+>/, ""))
    var obj = (threadobj && (typeof threadobj).match(/object/i)) ? threadobj :  ((cobj && (typeof cobj).match(/object/i)) ? cobj : document.getElementById("thread_" + state.main))
    if (!json.mid && !json.tid) {
        if (obj) {
            obj.innerHTML = "<h2>404!</h2><p>Sorry, we couldn't find this email :("
        }
        return
    }
    if (state.main == json.mid || state.main == json.tid) {
        return
    }
    saved_emails[json.mid] = json
    if (obj) {
        var eobj = document.getElementById("thread_" + (json.mid ? json.mid : json.tid).toString().replace(/@<.+>/, ""))
        var node = eobj ? eobj : document.createElement('div')
        node.setAttribute("epoch", json.epoch.toString())
        node.style.marginBottom = "20px";
        node.setAttribute("id", "thread_" + (json.mid ? json.mid : json.tid).toString().replace(/@<.+>/, ""))
        node.style.display = "block" // hack so openEmail will state that there's an email open.
        if (json.mid != b) {
            
            if (state.pchild && document.getElementById("thread_" + state.pchild.toString().replace(/@<.+>/, ""))) {
                var pc = document.getElementById("thread_" + state.pchild.toString().replace(/@<.+>/, ""))
                try {
                    if (prefs.sortOrder == 'forward') {
                        obj.insertAfter(pc, node)
                    } else {
                        obj.insertBefore(pc, node)
                    }
                } catch (e) {
                    obj.appendChild(node)
                }
            } else {
                if (prefs.sortOrder == 'forward') {
                    obj.appendChild(node)
                } else {
                    obj.insertBefore(node, obj.firstChild)
                }
            }
            displayEmail(json, (json.tid ? json.tid : json.mid), level)
        } else {
            document.getElementById("thread_" + state.main).appendChild(node)
        }
        if (state.child && state.child.children && state.child.children.length > 0) {
            getChildren(state.main, state.child, level, node)
        }
    } else {
        alert("Could not find parent object, thread_" + state.main)
    }
}



// toggleEmails_threaded: Open up a threaded display of a topic
function toggleEmails_threaded(id, close, toverride, threadobj) {
    current_thread_mids = {}
    current_email_msgs = []
    var thread = threadobj ? threadobj : document.getElementById('thread_' + id.toString().replace(/@<.+>/, ""))
    if (thread) {
        current_thread = id
        if (storageAvailable) {
            if (typeof(window.localStorage) !== "undefined") {
                var epoch = latestEmailInThread + "!"
                if (current_thread_json[id]) {
                    var xx = window.localStorage.getItem("viewed_" + current_thread_json[id].tid)
                    if (xx) {
                        var yy = parseInt(xx)
                        if (yy >= parseInt(latestEmailInThread)) {
                            epoch = yy
                        }
                    }
                    try {
                        window.localStorage.setItem("viewed_" + current_thread_json[id].tid, epoch)
                    } catch(e) {
                        
                    }
                }
            }
        }
        
        thread.style.display = (thread.style.display == 'none') ? 'block' : 'none';
        // Bail if we can't find the thread struct
        if (!current_thread_json[id]) {
            return;
        }
        var helper = document.getElementById('helper_' + id)
        if (!helper) {
            helper = document.createElement('div')
            helper.setAttribute("id", "helper_" + id)
            helper.style.padding = "10px"
            thread.parentNode.insertBefore(helper, thread)
        }
        
        if (prefs.groupBy == 'thread' && !(toverride == true)) {
            // View as flat
            helper.innerHTML = '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'date\'; toggleEmails_threaded(' + id + ', true); toggleEmails_threaded(' + id + ', false, true); sortByDate(' + id + ');" style="cursor: pointer; float: right;">Click to view as flat thread, sort by date</label> &nbsp;'
            
            // Highlight new emails since last view
            helper.innerHTML += '<label style="margin-right: 10px; padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-success" onclick="highlightNewEmails('+id+');" style="cursor: pointer; float: right;">Highlight new messages</label> &nbsp;'
        } else {
            helper.innerHTML = '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'thread\'; toggleEmails_threaded(' + id + ', true);toggleEmails_threaded(' + id + ');" style="cursor: pointer; float: right;">Click to view as nested thread</label> &nbsp;'
        }
        // time travel magic!
        var ml = findEml(current_thread_json[id].tid)
        if (!current_thread_json[id].magic && ml.irt && ml.irt.length > 0) {
            helper.innerHTML += "<p id='magic_"+id+"'><i><b>Note:</b> You are viewing a search result/aggregation in threaded mode. Only results matching your keywords or dates are shown, which may distort the thread. For the best result, go to the specific list and view the full thread there, or view your search results in flat mode. Or we can <a href='javascript:void(0);' onclick='timeTravelList("+id+")'>do some magic for you</a>.</i></p>"
            // Why was this here??
            /*
            var btn = document.createElement('a')
            btn.setAttribute("href", "javascript:void(0);")
            btn.setAttribute("class", "btn btn-success")
            btn.setAttribute("onclick", "prefs.displayMode='flat'; buildPage();")
            btn.style.marginRight = "10px"
            btn.innerHTML = "View results in flat mode instead"
            helper.appendChild(btn)
            */
        } else if (!current_thread_json[id].magic) {
            helper.innerHTML += "<p id='magic_"+id+"'></p>"
        }

        if (close == true) {
            thread.style.display = 'none'
        }
        if (thread.style.display == 'none') {
            helper.style.display = 'none'
            prefs.groupBy = 'thread' // hack for now
            thread.innerHTML = ""
            if (document.getElementById('bubble_' + id)) document.getElementById('bubble_' + id).style.display = 'block'
            return
        } else {
            helper.style.display = 'block'
            if (document.getElementById('bubble_' + id)) document.getElementById('bubble_' + id).style.display = 'none'
        }
        if (!open_emails[id]) {
            open_emails[id] = true

        }
        var eml = saved_emails[current_thread_json[id].tid]
        if (!eml || !eml.from) {
            GetAsync("/api/email.lua?id=" + current_thread_json[id].tid, {
                blockid: id,
                thread: current_thread_json[id],
                object: threadobj,
            }, loadEmails_threaded)
        } else {
            loadEmails_threaded(eml, {
                blockid: id,
                thread: current_thread_json[id],
                object: threadobj
            })
        }
    }
}

// func for highlighting emails that have shown up during a recent page build, that we haven't
// actually viewed before.
function highlightNewEmails(id) {
    // This currently requires localStorage to store the view data
    if (storageAvailable) {
        if (typeof(window.localStorage) !== "undefined") {
            kiddos = []
            var t = document.getElementById("thread_" + id)
            if (t) {
                traverseThread(t, 'thread') // find all child elements called 'thread*'
                // For each email in this thread, check (or set) when it was first viewed
                for (var i in kiddos) {
                    var mid = kiddos[i].getAttribute("id")
                    var epoch = window.localStorage.getItem("first_view_" + mid)
                    if (epoch && epoch != pb_refresh) { // did we view this before the last page build?
                        kiddos[i].style.color = "#AAA"
                    } else { // never seen it before, have it at normal color and set the first-view-date
                        
                        try {
                            window.localStorage.setItem("first_view_" + mid, pb_refresh)
                        } catch(e) {
                            
                        }
                        kiddos[i].style.color = "#000"
                    }
                }
            }
        }
    }
}

function displaySingleThread(json) {
    if (json && json.thread) {
        current_thread_json = [json.thread]
        current_flat_json = json.emails
    }
    var thread = document.getElementById('thread_0')
    thread.innerHTML = ""
    var helper = document.createElement('div')
    helper.setAttribute("id", "helper_0")
    thread.appendChild(helper)
    
    // Sometimes emails are hidden for anonymous users, let's make 'em know...
    if (!current_thread_json[0]) {
        if (!login || !login.credentials) {
            popup("Email not found!", "Sorry, it seems like we couldn't find this email for you. It may be private and hidden for non-authenticated users, in which case you could <a href='/oauth.html'>Log in</a> and see if that helps.", 60)
        }
    }
    var mid = current_thread_json[0].mid.replace(/[<>]/g, "")
    if (mid.length > 40) {
        mid = mid.substring(0,40) + "..."
    }
    // set tab title
    document.title = current_thread_json[0].subject + " - Pony Mail"
    
    // Set up for reply-to pane if not present already (for permalink view)
    last_opened_email = current_thread_json[0].eid
    if (!saved_emails[last_opened_email]) {
        saved_emails[last_opened_email] = current_thread_json[0]
        xlist = current_thread_json[0].list
    }
     
    
    helper.innerHTML = "<h4 style='margin: 0px; padding: 5px;'>Viewing email #" + mid + " (and replies):</h4>"
    if (prefs.groupBy == 'thread') {
        helper.innerHTML += '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'date\'; displaySingleThread();" style="cursor: pointer; float: right;">Click to view as flat thread, sort by date</label> &nbsp;'
    } else {
        helper.innerHTML += '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'thread\'; displaySingleThread();" style="cursor: pointer; float: right;">Click to view as nested thread</label> &nbsp;'
    }
    if (current_thread_json[0]['in-reply-to']) {
        helper.innerHTML += '<div class="alert alert-warning" style="margin-top: 10px;"><p><b>Notice!</b><br>This appears to not be the first email in this thread (it has <q><b>in-reply-to</b></q> set).<br/>If you like, we can try to find the first email in the thread for you:<br/><a href="javascript:void(0);" style="font-size: 10pt; cursor: pointer;" onclick="timeTravelSingleThread();" style="cursor: pointer; " class="btn btn-success">Go to the first email in this thread</a> &nbsp;</p></div>'
    }
    
    loadEmails_threaded(current_thread_json[0], {
                blockid: 0,
                thread: current_thread_json[0]
            })
    if (prefs.groupBy != 'thread') {
        sortByDate(0)
    }
}


// getSingleThread: fetch a thread from ES and go to callback
function getSingleThread(id) {
    GetAsync("/api/thread.lua?id=" + id, null, displaySingleThread)
}
