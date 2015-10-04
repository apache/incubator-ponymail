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
// THIS IS AN AUTOMATICALLY COMBINED FILE. PLEASE EDIT dev/*.js!!

// Fetched from ponymail_assign_vars.js

// These are all variables needed at some point during our work.
// They keep track of the JSON we have received, storing it in the browser,
// Thus lightening the load on the backend (caching and such)

// These are all variables needed at some point during our work.
// They keep track of the JSON we have received, storing it in the browser,
// Thus lightening the load on the backend (caching and such)

var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
var d_at = 10;
var d_ppp = 15;
var open_emails = []
var list_year = {}
var current_retention = 30
var current_cal_min = 1997
var keywords = ""
var current_thread = 0
var current_thread_mids = {}
var saved_emails = {}
var current_query = ""
var old_json = {}
var all_lists = {}
var current_json = {}
var current_thread_json = {}
var current_flat_json = {}
var current_email_msgs = []
var current_reply_eid = null
var firstVisit = true
var global_deep = false
var old_state = {}
var nest = ""
var xlist = ""
var domlist = {}
var compose_headers = {}
var login = {}
var xyz
var start = new Date().getTime()
var latestEmailInThread = 0
var composeType = "reply"
var gxdomain = ""
var fl = null
var kiddos = []

var viewModes = {
    threaded: {
        email: loadEmails_threaded,
        list: loadList_threaded
    },
    flat: {
        email: loadEmails_flat,
        list: loadList_flat
    }
}
// Fetched from ponymail_composer.js


function saveDraft() {
    // If the user was composing a new thread, let's save the contents (if any) for next time
    if (composeType == "new") {
        if (typeof(window.sessionStorage) !== "undefined") {
            window.sessionStorage.setItem("reply_body_" + xlist, document.getElementById('reply_body').value)
            window.sessionStorage.setItem("reply_subject_" + xlist, document.getElementById('reply_subject').value)
            window.sessionStorage.setItem("reply_list", xlist)
        }
        composeType = ""
    } else if (composeType == "reply" && current_reply_eid) {
        if (typeof(window.sessionStorage) !== "undefined") {
            window.sessionStorage.setItem("reply_body_eid_" + current_reply_eid, document.getElementById('reply_body').value)
            window.sessionStorage.setItem("reply_subject_eid_" + current_reply_eid, document.getElementById('reply_subject').value)
            window.sessionStorage.setItem("reply_list_eid_", current_reply_eid)
        }
        composeType = ""
    }
}

// hideComposer: hide the composer (splash) window
function hideComposer(evt) {
    var es = evt ? (evt.target || evt.srcElement) : null;
    if (!es || !es.getAttribute || !es.getAttribute("class") || (es.nodeName != 'A' && es.getAttribute("class").search(/label/) == -1))  {
        saveDraft()
        document.getElementById('splash').style.display = "none"
    }
}




// sendEmail: send an email
function sendEmail(form) {
    
    var f = new FormData();
    for (var k in compose_headers) {
        f.append(k, compose_headers[k])
    }
    f.append("subject", document.getElementById('reply_subject').value)
    f.append("body", document.getElementById('reply_body').value)
    
    var request = new XMLHttpRequest();
    request.open("POST", "/api/compose.lua");
    request.send(f);
    
    var obj = document.getElementById('splash')
    obj.innerHTML = "<h3>Email dispatched!</h3><p>Provided it passes spam checks, your email should be on its way to the mailing list now. <br/><b>Do note:</b> Some lists are always moderated, so your reply may be held for moderation for a while.</p>"
    window.setTimeout(hideComposer, 4000)
}


// compose: render a compose dialog for a reply to an email
function compose(eid, lid, type) {
    var email
    if (lid) {
        email = {
            'message-id': "",
            'list': xlist.replace("@", "."),
            'subject': "",
            'body': "",
            'from': "",
            'date': ""
        }
        composeType = "new"
    }
    else {
        composeType = "reply"
        email = saved_emails[eid]
    }
    if (email) {
        if (login.credentials) {
            current_reply_eid = eid
            var listname = email['list'].replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            compose_headers = {
                'in-reply-to': email['message-id'],
                'references': email['message-id'] + " " + (email['references'] ? email['references'] : ""),
                'to': listname
            }
            var obj = document.getElementById('splash')
            obj.style.display = "block"
            what = "Reply to email"
            if (lid) {
                what = "Start a new thread"
            }
            obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here<big> &#x2612;</big></a></p><h3>" + what + " on " + listname + ":</h3>"
            var area = document.createElement('textarea')
            area.style.width = "660px"
            area.style.height = "400px";
            area.setAttribute("id", "reply_body")
            var eml = "\n\nOn " + email.date + ", " + email.from.replace(/</mg, "&lt;") + " wrote: \n"
            email.body = email.body.replace(/\r/mg, "")
            eml += email.body.replace(/^([^\n]*)/mg, "&gt; $1")
            var eml_raw = "\n\nOn " + email.date + ", " + email.from + " wrote: \n"
            eml_raw += email.body.replace(/^([^\n]*)/mg, "> $1")

            var subject = "Re: " + email.subject.replace(/^Re:\s*/mg, "").replace(/</mg, "&lt;")
            
            if (lid) {
                eml = ""
                eml_raw = ""
                subject = ""
            }
            obj.appendChild(document.createTextNode('Subject: '))
            var txt = document.createElement('input')
            txt.setAttribute("type", "text")
            txt.setAttribute("style", "width: 500px;")
            txt.value = subject
            txt.setAttribute("id", "reply_subject")
            obj.appendChild(txt)

            area.innerHTML = eml
            obj.appendChild(area)
            
            // Do we need to fetch cache here?
            if (composeType == "new" && typeof(window.sessionStorage) !== "undefined" &&
                window.sessionStorage.getItem("reply_subject_" + xlist)) {
                area.innerHTML = window.sessionStorage.getItem("reply_body_" + xlist)
                txt.value = window.sessionStorage.getItem("reply_subject_" + xlist)
            } else if (composeType == "reply" && typeof(window.sessionStorage) !== "undefined" &&
                window.sessionStorage.getItem("reply_subject_eid_" + eid)) {
                area.innerHTML = window.sessionStorage.getItem("reply_body_eid_" + eid)
                txt.value = window.sessionStorage.getItem("reply_subject_eid_" + eid)
            }
            
            // submit button
            var btn = document.createElement('input')
            btn.setAttribute("type", "button")
            btn.setAttribute("class", "btn btn-success")
            btn.style.background = "#51A351 !important"
            btn.setAttribute("value", lid ? "Send email" : "Send reply")
            btn.setAttribute("onclick", "sendEmail(this.form)")
            obj.appendChild(btn)
            
            
            
            // reply-via-mua button
            if (!lid) {
                var xlink = 'mailto:' + listname + "?subject=" + escape(subject) + "&amp;In-Reply-To=" + escape(email['message-id']) + "&body=" + escape(eml_raw)
                var btn = document.createElement('input')
                btn.setAttribute("type", "button")
                btn.setAttribute("class", "btn btn-info")
                btn.style.float = "right"
                btn.style.background = "#51A351 !important"
                btn.setAttribute("value", "reply via your own mail client")
                btn.setAttribute("onclick", "location.href=\"" + xlink + "\";")
                obj.appendChild(btn)
            }
            
            
            // Focus on body or subject, depending on what's going on
            area.focus()
            if (composeType == "new" && txt.value.length == 0) {
                txt.focus()
            }
        } else {
            var eml_raw = "\n\nOn " + email.date + ", " + email.from + " wrote: \n"
            eml_raw += email.body.replace(/([^\r\n]*)/mg, "> $1")
            var subject = "Re: " + email.subject.replace(/^Re:\s*/mg, "").replace(/</mg, "&lt;")
            var link = 'mailto:' + email.list.replace(/[<>]/g, "").replace(/([^.]+)\./, "$1@") + "?subject=" + escape(subject) + "&In-Reply-To=" + escape(email['message-id']) + "&body=" + escape(eml_raw)
            var obj = document.getElementById('splash')
            obj.style.display = "block"
            obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here<big> &#x2612;</big></a></p><h3>Reply to email:</h3>"
            obj.innerHTML += "<p>You need to be logged in to reply online.<br/>If you have a regular mail client, you can reply to this email by clicking below:<br/><h4><a style='color: #FFF;' class='btn btn-success' onclick='hideComposer(event);' href=\"" + link + "\">Reply via Mail Client</a></h4>"
        }
    }
}
// Fetched from ponymail_dom_helpers.js



// traverseThread: finds all child divs inside an object
function traverseThread(child, name, type) {
    if (!child) {
        return
    }
    type = type ? type : 'DIV'
    for (var i in child.childNodes) {
        if (child.childNodes[i].nodeType && child.childNodes[i].nodeType == 1 && child.childNodes[i].nodeName == type) {
            if (!name || (child.childNodes[i].getAttribute("id") && child.childNodes[i].getAttribute("id").search(name) != -1)) {
                kiddos.push(child.childNodes[i])
            }
        }
        if (child.childNodes[i].nodeType && child.childNodes[i].hasChildNodes()) {
            traverseThread(child.childNodes[i], name, type)
        }
    }

}


// toggleView: show/hide a DOM object
function toggleView(el) {
    var obj = document.getElementById(el)
    if (obj) {
        obj.style.display = (obj.style.display == 'none') ? 'block' : 'none'
    }
}



// sortByDate: reshuffle a threaded display into a flat display, sorted by date
function sortByDate(tid) {
    kiddos = []
    var t = document.getElementById("thread_" + tid)
    var h = document.getElementById("helper_" + tid)
    if (t) {
        traverseThread(t, 'thread')
        if (prefs.sortOrder == 'forward') {
            kiddos.sort(function(a, b) {
                return parseInt(b.getAttribute('epoch') - a.getAttribute('epoch'));
            })
        } else {
            kiddos.sort(function(a, b) {
                return parseInt(a.getAttribute('epoch') - b.getAttribute('epoch'));
            })
        }
        for (var i in kiddos) {
            t.insertBefore(kiddos[i], t.firstChild)
        }
    }
}


// generateFormDivs: helper func for making form elements
function generateFormDivs(id, title, type, options, selval) {
    var mf = document.createElement('div')
    mf.setAttribute('id', "main_form_" + id)
    mf.style.margin = "10px"
    mf.style.padding = "10px"
    
    var td = document.createElement('div')
    td.style.width = "300px"
    td.style.float = "left"
    td.style.fontWeight = "bold"
    td.appendChild(document.createTextNode(title))
    mf.appendChild(td)
    
    var td2 = document.createElement('div')
    td2.style.width = "200px"
    td2.style.float = "left"
    if (type == 'select') {
        var sel = document.createElement('select')
        sel.setAttribute("name", id)
        sel.setAttribute("id", id)
        for (var key in options) {
            var opt = document.createElement('option')
            if (typeof key == "string") {
                opt.setAttribute("value", key)
                if (key == selval) {
                    opt.setAttribute("selected", "selected")
                }
            } else {
                if (options[key] == selval) {
                    opt.setAttribute("selected", "selected")
                }
            }
            opt.text = options[key]
            sel.appendChild(opt)
        }
        td2.appendChild(sel)
    }
    if (type == 'input') {
        var inp = document.createElement('input')
        inp.setAttribute("name", id)
        inp.setAttribute("id", id)
        inp.setAttribute("value", options)
        td2.appendChild(inp)
    }
    mf.appendChild(td2)
    return mf
}


function findEpoch(epoch) {
    kiddos = []
    traverseThread(document.body)
    for (var i in kiddos) {
        if (kiddos[i].hasAttribute('epoch') && parseInt(kiddos[i].getAttribute('epoch')) == epoch) {
            return kiddos[i]
        }
    }
    return null
}// Fetched from ponymail_email_displays.js

// displayEmail: Shows an email inside a thread
function displayEmail(json, id) {
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
    saved_emails[json.mid] = json
    var estyle = ""
    
    // color based on view before or not??
    if (typeof(window.localStorage) !== "undefined") {
        if (! window.localStorage.getItem("viewed_" + json.mid) ){
            estyle = "linear-gradient(to bottom, rgba(252,255,244,1) 0%,rgba(233,233,206,1) 100%)"
            window.localStorage.setItem("viewed_" + json.mid, json.epoch)
        }
        if (window.localStorage.getItem("viewed_" + json.mid).search("!") == 10){
            estyle = "linear-gradient(to bottom, rgba(252,255,244,1) 0%,rgba(233,233,206,1) 100%)"
            var epoch = parseInt(window.localStorage.getItem("viewed_" + json.mid))
            window.localStorage.setItem("viewed_" + json.mid, epoch + ":")
        }
    }
    var cols = ['primary', 'success', 'info', 'default', 'warning', 'danger']
    var thread = document.getElementById('thread_' + id.toString().replace(/@<.+>/, ""))
    if (thread) {
        thread.setAttribute("class", "reply bs-callout bs-callout-" + cols[parseInt(Math.random() * cols.length - 0.01)])
        thread.style.background = estyle
        thread.innerHTML = ''
        thread.innerHTML += ' &nbsp; <label class="label label-success" onclick="compose(\'' + json.mid + '\');" style="cursor: pointer; float: right; margin-left: 10px;">Reply</label>'
        thread.innerHTML += ' &nbsp; <a href="/thread.html/'+json.mid+'"><label class="label label-warning" style="cursor: pointer; float: right;">Permalink</label></a>'
        thread.innerHTML += ' &nbsp; <a href="/source.lua/'+json.mid+'"><label class="label label-danger" style="cursor: pointer; float: right;">View Source</label></a> &nbsp; '
        thread.innerHTML += "<br/>"
        //thread.style.border = "1px dotted #666"
        thread.style.padding = "5px"
        thread.style.fontFamily = "Hack"
        json.date = new Date(json.epoch*1000).toLocaleString();
        var fields = ['From', 'To', 'CC', 'Subject', 'Date']
        for (var i in fields) {
            var key = fields[i]
            if (json[key.toLowerCase()] != undefined && json[key.toLowerCase()].length > 0) {
                thread.innerHTML += "<b>" + key + ": </b>" + json[key.toLowerCase()].replace(/</g, "&lt;") + "<br/>"
            }
        }
        if (json.private) {
            thread.innerHTML += "<font color='#C00'><b>Private: </b> YES</font><br/>"
        }
        var lid = json.list.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
        thread.innerHTML += "<b>List: </b><a href='/list.html?" + lid + "'>" + lid + "</a><br/>"
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
                thread.innerHTML += "<a href='/api/email.lua?attachment=true&id=" + json.tid + "&file=" + fd.hash + "'>" + fd.filename.replace(/</g, "&lt;") + "</a> (" + size + ") &nbsp; "
            }
            thread.innerHTML += "<br/>"
        }
        var ebody = json.body
        ebody = ebody.replace(/</mg, "&lt;")
        ebody = "\n" + ebody
        if (prefs.compactQuotes == 'yes') {
            ebody = ebody.replace(/(?:\r?\n)((>+[ \t]*[^\r\n]*\r?\n+)+)/mg, function(inner) {
                var rnd = (Math.random() * 100).toString()
                var html = "<div class='bs-callout bs-callout-default' style='padding: 2px;' id='parent_" + rnd + "'>" +
                    "<img src='/images/quote.png' title='show/hide original text' onclick='toggleView(\"quote_" + rnd + "\")'/><br/>" +
                    "<div style='display: none;' id='quote_" + rnd + "'>" + inner + "</div></div>"
                return html
            })
        }
        ebody = ebody.replace(re_weburl, "<a href='$1'>$1</a>")

        thread.innerHTML += "<br/><pre style='font-family: Hack; word-wrap: normal; white-space: pre-line; word-break: normal;'>" + ebody + '</pre>'
        if (thread.hasAttribute("meme")) {
            thread.scrollIntoView()
            thread.style.background = "rgba(200,200,255, 0.25)"
        }
    } else {
        alert("Error, " + id + " not found :(")
    }
}


// displaySingleEmail: shows a single email. Used for permalinks
function displaySingleEmail(json, id) {

    var thread = document.getElementById('email')
    if (thread) {
        if (typeof(window.localStorage) !== "undefined") {
            if (! window.localStorage.getItem("viewed_" + json.id) ){
                estyle = "background: background: linear-gradient(to bottom, rgba(252,255,244,1) 0%,rgba(233,233,206,1) 100%);"
                window.localStorage.setItem("viewed_" + json.id, latestEmailInThread + "!")
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
        if (true) {
            ebody = ebody.replace(/(?:\r?\n)((>+[ \t]*[^\r\n]*\r?\n+)+)/mg, function(inner) {
                var rnd = (Math.random() * 100).toString()
                var html = "<div class='bs-callout bs-callout-default' style='padding: 2px;' id='parent_" + rnd + "'>" +
                    "<img src='/images/quote.png' title='show/hide original text' onclick='toggleView(\"quote_" + rnd + "\")'/><br/>" +
                    "<div style='display: none;' id='quote_" + rnd + "'>" + inner + "</div></div>"
                return html
            })
        }

        ebody = ebody.replace(re_weburl, "<a href=\"$1\">$1</a>")

        thread.innerHTML += "<b>List ID: </b><a href='/list.html?" + lid + "'>" + lid + "</a><br/>"
        thread.innerHTML += "<br/><pre style='font-family: Hack;'>" + ebody + '</pre>'
    } else {
        alert("Error, " + id + " not found :(")
    }
}




// displayEmailThreaded: Appends an email to a threaded display of a topic
function displayEmailThreaded(json, state) {
    var b = state.before
    var obj = document.getElementById("thread_" + b.toString().replace(/@<.+>/, "")) ? document.getElementById("thread_" + b.toString().replace(/@<.+>/, "")) : document.getElementById("thread_" + state.main)
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
        var node = document.createElement('div')
        node.setAttribute("epoch", json.epoch.toString())
        node.style.marginBottom = "20px";
        node.style.borderBottom = "3px groove #666"
        node.setAttribute("id", "thread_" + (json.mid ? json.mid : json.tid).toString().replace(/@<.+>/, ""))
        if (state.pchild && document.getElementById("thread_" + state.pchild.toString().replace(/@<.+>/, ""))) {
            var pc = document.getElementById("thread_" + state.pchild.toString().replace(/@<.+>/, ""))
            try {
                obj.insertBefore(node, pc)
            } catch (e) {
                if (prefs.sortOrder == 'forward') {
                    obj.appendChild(node)
                } else {
                    obj.insertBefore(node, obj.firstChild)
                }
            }

        } else {
            if (prefs.sortOrder == 'forward') {
                obj.appendChild(node)
            } else {
                obj.insertBefore(node, obj.firstChild)
            }
        }
        displayEmail(json, (json.tid ? json.tid : json.mid))
        if (state.child && state.child.children && state.child.children.length > 0) {
            getChildren(state.main, state.child)
        }
    } else {
        alert("Could not find parent object, thread_" + state.main)
    }
}



// toggleEmails_threaded: Open up a threaded display of a topic
function toggleEmails_threaded(id, close, toverride) {
    current_thread_mids = {}
    current_email_msgs = []
    var thread = document.getElementById('thread_' + id.toString().replace(/@<.+>/, ""))
    if (thread) {
        current_thread = id
        if (typeof(window.localStorage) !== "undefined") {
            var epoch = latestEmailInThread + "!"
            var xx = window.localStorage.getItem("viewed_" + current_thread_json[id].tid)
            if (xx) {
                var yy = parseInt(xx)
                if (yy >= parseInt(latestEmailInThread)) {
                    epoch = yy
                }
            }
            window.localStorage.setItem("viewed_" + current_thread_json[id].tid, epoch)
        }
        
        thread.style.display = (thread.style.display == 'none') ? 'block' : 'none';
        var helper = document.getElementById('helper_' + id)
        if (!helper) {
            helper = document.createElement('div')
            helper.setAttribute("id", "helper_" + id)
            helper.style.padding = "10px"
            thread.parentNode.insertBefore(helper, thread)
        }
        
        if (prefs.groupBy == 'thread' && !(toverride == true)) {
            helper.innerHTML = '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'date\'; toggleEmails_threaded(' + id + ', true); toggleEmails_threaded(' + id + ', false, true); sortByDate(' + id + ');" style="cursor: pointer; float: right;">Click to view as flat thread, sort by date</label> &nbsp;'
        } else {
            helper.innerHTML = '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'thread\'; toggleEmails_threaded(' + id + ', true);toggleEmails_threaded(' + id + ');" style="cursor: pointer; float: right;">Click to view as nested thread</label> &nbsp;'
        }
        // time travel magic!
        var ml = findEml(current_thread_json[id].tid)
        if (!current_thread_json[id].magic && ml.irt && ml.irt.length > 0) {
            helper.innerHTML += "<p id='magic_"+id+"'><i><b>Note:</b> You are viewing a search result/aggregation in threaded mode. Only results matching your keywords are shown, which may distort the thread. For the best result, go to the specific list and view the full thread there, or view your search results in flat mode. Or we can <a href='javascript:void(0);' onclick='timeTravelList("+id+")'>do some magic for you</a>.</i></p>"
            var btn = document.createElement('a')
            btn.setAttribute("href", "javascript:void(0);")
            btn.setAttribute("class", "btn btn-success")
            btn.setAttribute("onclick", "prefs.displayMode='flat'; buildPage();")
            btn.style.marginRight = "10px"
            btn.innerHTML = "View results in flat mode instead"
            helper.appendChild(btn)
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
            return
        } else {
            helper.style.display = 'block'
        }
        if (!open_emails[id]) {
            open_emails[id] = true

        }
        var eml = saved_emails[current_thread_json[id].tid]
        if (!eml || !eml.from) {
            GetAsync("/api/email.lua?id=" + current_thread_json[id].tid, {
                blockid: id,
                thread: current_thread_json[id]
            }, loadEmails_threaded)
        } else {
            loadEmails_threaded(eml, {
                blockid: id,
                thread: current_thread_json[id]
            })
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
    var mid = current_thread_json[0].mid.replace(/[<>]/g, "")
    if (mid.length > 40) {
        mid = mid.substring(0,40) + "..."
    }
    helper.innerHTML = "<h4 style='margin: 0px; padding: 5px;'>Viewing email #" + mid + " (and replies):</h4>"
    if (prefs.groupBy == 'thread') {
        helper.innerHTML += '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'date\'; displaySingleThread();" style="cursor: pointer; float: right;">Click to view as flat thread, sort by date</label> &nbsp;'
    } else {
        helper.innerHTML += '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'thread\'; displaySingleThread();" style="cursor: pointer; float: right;">Click to view as nested thread</label> &nbsp;'
    }
    if (current_thread_json[0]['in-reply-to']) {
        helper.innerHTML += '<p><i>This appears to not be the first email in this thread (it has <kbd>in-reply-to</kbd> set). If you like, we can try to find the first email in the thread for you: <a href="javascript:void(0);" style="font-size: 10pt; cursor: pointer;" onclick="timeTravelSingleThread();" style="cursor: pointer; ">Go to the first email in this thread</a> &nbsp;</p>'
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
// Fetched from ponymail_email_tools.js


// findEml: Finds and returns an email object based on message ID
function findEml(id) {
    for (var i in current_flat_json) {
        if (current_flat_json[i].id == id) {
            return current_flat_json[i]
        }
    }
}
 
 
// countSubs: counts the number of replies to an email   
function countSubs(eml, state) {
    var n = 0;
    if (!state) {
        n = -1
    }
    state = state ? state : {}
    var x = eml.tid ? eml.tid : eml.mid
    if (!state[x]) {
        n++;
        state[x] = true
    }

    for (var i in eml.children) {
        if (true) {
            //state[eml.children[i].tid] = true
            n += countSubs(eml.children[i], state);
        }

    }

    return n
}

// countNewest: finds the newest email in a thread
function countNewest(eml) {
    var n = eml.epoch;
    for (var i in eml.children) {
        n = Math.max(n, countNewest(eml.children[i]));
    }
    return n
}

// countParts: counts the number of unique participants in a thread
function countParts(eml, kv) {
    var n = 0;
    var email = findEml(eml.tid)
    kv = kv ? kv : {}
    if (!email) {
        return n
    }
    if (!kv[email.from]) {
        kv[email.from] = true
        n++;
    }
    for (var i in eml.children) {
        n += countParts(eml.children[i], kv);
    }
    return n
}




// sortIt: sort function for emails: sorts by age
function sortIt(json) {
    for (var i in json) {
        json[i].latest = countNewest(json[i])
    }
    if (json && json != undefined && json.sort) {
        json.sort(function(a, b) {
            return b.latest - a.latest
        })
    }

    return (json && json.sort) ? json : []
}


// getChildren: fetch all replies to a topic from ES
function getChildren(main, email) {
    var pchild = null
    if (email.children && email.children.sort) {
        email.children.sort(function(a, b) {
            return b.epoch - a.epoch
        })
        for (var i in email.children) {
            var child = email.children[i]
            if (child.tid != email.mid) {
                var eml = saved_emails[child.tid]
                if (!eml || !eml.from) {
                    GetAsync("/email.lua?id=" + child.tid, {
                        main: main,
                        before: email.tid,
                        pchild: pchild,
                        child: child
                    }, displayEmailThreaded)
                } else {
                    displayEmailThreaded(eml, {
                        main: main,
                        before: email.tid,
                        pchild: pchild,
                        child: child
                    })
                }
            }
            pchild = child.tid
        }
    }
}

// permaLink: redirect to an email permalink
function permaLink(id, type) {
    var t = 'thread'
    if (prefs.groupBy == 'date') {
        t = 'permalink'
    }
    var eml = findEml(id)
    if (eml) { // This is so, in case you move to another list software, you'll keep back compat
        id = eml['message-id']
    }
    window.open("/" + t + ".html/" + id, "_new")
}




// getSingleEmail: fetch an email from ES and go to callback
function getSingleEmail(id) {
    GetAsync("/api/email.lua?id=" + id, null, displaySingleEmail)
}


// seedGetSingleThread: pre-caller for the above.
function seedGetSingleThread(id) {
    GetAsync("/api/preferences.lua", {docall:["/thread.lua?id=" + id, displaySingleThread]}, seedPrefs)
}
// Fetched from ponymail_helperfuncs.js

// GetAsync: func for getting a doc async with a callback
function GetAsync(theUrl, xstate, callback) {
    var xmlHttp = null;
    if (window.XMLHttpRequest) {
        xmlHttp = new XMLHttpRequest();
    } else {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlHttp.open("GET", theUrl, true);
    xmlHttp.send(null);
    xmlHttp.onreadystatechange = function(state) {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            if (callback) {
                try {
                    callback(JSON.parse(xmlHttp.responseText), xstate);
                } catch (e) {
                    callback(JSON.parse(xmlHttp.responseText), xstate)
                }
            }

        }
        if (xmlHttp.readyState == 4 && xmlHttp.status == 404) {
            alert("404'ed: " + theUrl)
        }
    }
}
// Fetched from ponymail_listview_flat.js


// loadList_flat: Load a chunk of emails as a flat (non-threaded) list
function loadList_flat(mjson, limit, start, deep) {
    open_emails = []
    limit = limit ? limit : d_ppp;
    var json = mjson ? ('emails' in mjson && mjson.emails.constructor == Array ? mjson.emails.sort(function(a, b) {
        return b.epoch - a.epoch
    }) : []) : current_flat_json
    current_flat_json = json
    var now = new Date().getTime() / 1000
    nest = '<ul class="list-group">'
    if (!start) {
        start = 0
    }
    for (var i = start; i < json.length; i++) {
        if (i >= (start + limit)) {
            break
        }
        var eml = json[i]
        if (eml.subject.length > 90) {
            eml.subject = eml.subject.substr(0, 90) + "..."
        }
        eml.mid = eml.id

        ld = 'default'
        var ti = ''
        if (eml.epoch > (now - 86400)) {
            ld = 'warning'
            ti = "Has activity in the past 24 hours"
        }
        var d = ""
        var qdeep = document.getElementById('checkall') ? document.getElementById('checkall').checked : false
        if (qdeep || deep || global_deep && typeof eml.list != undefined && eml.list != null) {
            var elist = (eml.list ? eml.list : "").replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            var elist2 = elist
            if (pm_config.shortLists) {
                elist = elist.replace(/\.[^.]+\.[^.]+$/, "")
            }
            var d = "<a href='list.html?" + elist2 + "'><label class='label label-warning' style='width: 150px;'>" + elist + "</label></a> &nbsp;"
            if (eml.subject.length > 75) {
                eml.subject = eml.subject.substr(0, 75) + "..."
            }
        }
        mdate = new Date(eml.epoch * 1000)
        mdate = mdate.toLocaleFormat ? mdate.toLocaleFormat('%Y-%m-%d %T') : mdate.toLocaleString('en-GB', {
            hour12: false
        })
        var subject = eml.subject.replace(/</mg, "&lt;")
        var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
        from = from.replace(/\"/g, "")
        
        // style based on view before or not??
        var estyle = ""
        if (typeof(window.localStorage) !== "undefined") {
            if (! window.localStorage.getItem("viewed_" + eml.id) ){
                estyle = "font-weight: bold;"
            }
        }
        var at = ""
        if (eml.attachments && eml.attachments > 0) {
            at = "<img src='/images/attachment.png' title='" + eml.attachments + " file(s) attached' style='float: left; title='This email has attachments'/> "
        }
        nest += "<li class='list-group-item'> " + at + " &nbsp; <a style='" + estyle + "' href='javascript:void(0);' onclick='this.style=\"\"; loadEmails_flat(" + i + ");'>" + subject + "</a> <label style='float: left; width: 140px;' class='label label-info'>" + from + "</label><label style='float: right; width: 140px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label><div id='thread_" + i + "' style='display:none';></div></li>"
    }
    nest += "</ul>"


    var bulk = document.getElementById('emails')
    bulk.innerHTML = nest
    if (prefs.hideStats == 'yes') {
        bulk.setAttribute("class", "well col-md-10 col-lg-10")
    } else {
        bulk.setAttribute("class", "well col-md-10 col-lg-7")
    }
    

    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_flat(false, ' + 15 + ', ' + nstart + ');">Show previous 15</a> &nbsp '
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    
    if (login && login.credentials) {
        bulk.innerHTML += '<div style="width: 33%; float: left; text-align: center;"><a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-danger" onclick="compose(null, \'' + xlist + '\');">Start a new thread</a></div>'
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    if (json.length > (start + limit)) {
        remain = Math.min(15, json.length - (start + limit))
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_flat(false, ' + 15 + ', ' + (start + 15) + ');">Show next ' + remain + '</a></div>'
    }
}



// loadEmails_flat: Load a topic in a flat display
function loadEmails_flat(id, close) {
    var thread = document.getElementById('thread_' + id)
    if (thread) {
        current_thread = id
        thread.style.display = (thread.style.display == 'none') ? 'block' : 'none';
        if (close == true) {
            thread.style.display = 'none'
        }
        if (thread.style.display == 'none') {
            return
        }
        if (!open_emails[id]) {
            open_emails[id] = true

        }
        var eml = saved_emails[current_flat_json[id].id]
        if (!eml || !eml.from) {
            GetAsync("/api/email.lua?id=" + current_flat_json[id].id, id, displayEmail)
        } else {
            displayEmail(eml, id)
        }
    } else {
        alert("no such thread ID: " + id)
    }
}
// Fetched from ponymail_listview_threaded.js


// loadList_threaded: Same as above, but threaded display
function loadList_threaded(mjson, limit, start, deep) {
    open_emails = []
    limit = limit ? limit : d_ppp;
    var fjson = mjson ? ('emails' in mjson && mjson.emails.constructor == Array ? mjson.emails.sort(function(a, b) {
        return b.epoch - a.epoch
    }) : []) : current_flat_json
    current_flat_json = fjson
    
    var json = mjson ? sortIt(mjson.thread_struct) : current_thread_json
    current_thread_json = json
    
    var now = new Date().getTime() / 1000
    nest = '<ul class="list-group">'
    if (!start) {
        start = 0
    }
    for (var i = start; i < json.length; i++) {
        if (i >= (start + limit)) {
            break
        }
        var eml = findEml(json[i].tid)
        if (eml && eml.subject.length > 90) {
            eml.subject = eml.subject.substr(0, 90) + "..."
        }
        var subs = countSubs(json[i])
        var people = countParts(json[i])
        var latest = countNewest(json[i])

        var ls = 'default'
        if (subs > 0) {
            ls = 'primary'
        }
        var lp = 'success'
        if (people > 1) {
            lp = 'success'
        }
        var ld = 'default'
        var ti = ''
        if (latest > (now - 86400)) {
            ld = 'warning'
            ti = "Has activity in the past 24 hours"
        }
        var d = ''
        var estyle = ""
        var qdeep = document.getElementById('checkall') ? document.getElementById('checkall').checked : false
        if ((qdeep || deep || global_deep) && current_query.length > 0) {
            eml.list = eml.list ? eml.list : eml.list_raw // Sometimes, .list isn't available
            var elist = eml.list.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            var elist2 = elist
            if (pm_config.shortLists) {
                elist = elist.replace(/\.[^.]+\.[^.]+$/, "")
            }
            d = "<a href='list.html?" + elist2 + "'><label class='label label-warning' style='width: 150px;'>" + elist + "</label></a> &nbsp;"
            if (eml.subject.length > 75) {
                eml.subject = eml.subject.substr(0, 75) + "..."
            }
        }
        var subject = eml.subject.replace(/</mg, "&lt;")
        var mdate = new Date(latest * 1000)
        mdate = mdate.toLocaleFormat ? mdate.toLocaleFormat('%Y-%m-%d %T') : mdate.toLocaleString('en-GB', {
            hour12: false
        })
        var pds = people > 1 ? "visible" : "hidden"
        
        // style based on view before or not??
        if (typeof(window.localStorage) !== "undefined") {
            if (! window.localStorage.getItem("viewed_" + eml.id) || (subs > 0 && parseInt(window.localStorage.getItem("viewed_" + eml.id)) < latest )){
                estyle = "font-weight: bold;"
            }
        }
        nest += "<li class='list-group-item'>" + d + "<a style='" + estyle + "' href='javascript:void(0);' onclick='this.style=\"\"; latestEmailInThread = " + latest+ "; toggleEmails_threaded(" + i + "); latestEmailInThread = 0;'>" + subject + "</a> <label style='float: right; width: 140px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label><label id='subs_" + i + "' class='label label-" + ls + "'>" + subs + " replies</label> &nbsp; " + "<label style='visibility:" + pds + "' id='people_"+i+"' class='label label-" + lp + "'>" + people + " participants</label>" + "<div id='thread_" + i + "' style='display:none';></div></li>"
    }
    nest += "</ul>"


    var bulk = document.getElementById('emails')
    bulk.innerHTML = nest
    if (prefs.hideStats == 'yes') {
        bulk.setAttribute("class", "well col-md-10 col-lg-10")
    } else {
        bulk.setAttribute("class", "well col-md-10 col-lg-7")
    }
    var dp = (deep || (global_deep && current_query.length > 0)) ? 'true' : 'false'
    
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_threaded(false, ' + 15 + ', ' + nstart + ');">Show previous 15</a> &nbsp '
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    
    if (login && login.credentials) {
        bulk.innerHTML += '<div style="width: 33%; float: left; text-align: center;"><a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-danger" onclick="compose(null, \'' + xlist + '\');">Start a new thread</a></div>'
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    if (json.length > (start + limit)) {
        remain = Math.min(15, json.length - (start + limit))
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_threaded(false, ' + 15 + ', ' + (start + 15) + ');">Show next ' + remain + '</a></div>'
    }

}


// loadEmails_threaded: Callback for receiving a doc via ES, save and displays the email
function loadEmails_threaded(json, state) {
    current_thread_mids = {}
    saved_emails[json.tid ? json.tid : json.mid] = json
    displayEmailThreaded(json, {
        main: state.blockid,
        before: state.blockid
    })
    getChildren(state.blockid, state.thread)
}
// Fetched from ponymail_pagebuilder.js


// toggleCalendar: Expands/contracts years in the calendar (to show/hide months)
function toggleCalendar(year) {
    var cal = document.getElementById('cal_' + year)
    if (cal) {
        cal.style.display = (cal.style.display == 'none') ? 'block' : 'none';
        for (var i = 1970; i < 3000; i++) {
            var x = document.getElementById('cal_' + i)
            if (x && x != cal) {
                x.style.display = 'none'
            }
        }
    }
}


// buildCalendar: build the calendar
function buildCalendar(firstYear, lastYear) {
    
    var dp = document.getElementById('datepicker')
    dp.style.width = "150px"
    dp.innerHTML = "<h3>Archive:</h3>"
    var fyear = lastYear ? lastYear : new Date().getFullYear();
    
    // Check we don't esplode
    if (fyear > new Date().getFullYear()) {
        fyear = new Date().getFullYear();
    }

    for (var year = fyear; year >= (firstYear ? firstYear : current_cal_min); year--) {
        var n = "none";
        if (fyear == firstYear) {
            n = "block"
        }
        dp.innerHTML += "<label onmouseout='this.setAttribute(\"class\", \"label label-success\");'  onmouseover='this.setAttribute(\"class\", \"label label-warning\");' onclick='toggleCalendar(" + year + ");' class='label label-success' style='float: left; width: 120px; font-size: 11pt; cursor: pointer'>" + year + "</label><br/>"
        var cale = "<div style='float: left; width: 90%; display: " + n + "; padding-left: 20px; margin-bottom: 15px;' id='cal_" + year + "'>"
        var em = (new Date().getFullYear() == year) ? new Date().getMonth() : 11;
        for (var y = em; y >= 0; y--) {
            cale += "<label id='calmonth_" + (year+"-"+(y+1)) + "' style='width: 80px; float: left;cursor: pointer;' class='label label-default label-hover' onclick='toggleEmail(" + year + ", " + (y + 1) + ");' >" + months[y] + "</label><br/>"
        }
        cale += "</div>"
        dp.innerHTML += cale
    }
}

// dailyStats: compiles the day-by-day stats for a chunk of emails
function dailyStats(json) {
    var days = {}
    for (var i in json) {
        var day = new Date(json[i].epoch * 1000).getDate()
        days[day] = days[day] ? (days[day] + 1) : 1
    }
    var stats = []
    for (var z = 0; z < 32; z++) {
        stats.push(days[z] ? days[z] : 0)
    }
    return stats
}

function clearCalendarHover() {
    kiddos = []
    traverseThread(document.getElementById('datepicker'), 'calmonth', 'LABEL')
    for (var n in kiddos) {
        kiddos[n].setAttribute("class", "label label-default label-hover")
    }
}


// checkCalendar: keep the calendar in check with the result set
function checkCalendar(json) {
    if (json.list && !list_year[json.list]) {
        xlist = (json.list && json.list.search(/\*/) == -1) ? json.list : xlist
        list_year[json.list] = json.firstYear
        buildCalendar(json.firstYear, json.lastYear)
    }
    if (xlist != json.list || current_cal_min != json.firstYear) {
        buildCalendar(json.firstYear, json.lastYear)
        xlist = (json.list && json.list.search(/\*/) == -1) ? json.list : xlist
        current_cal_min = json.firstYear
    }
}


// buildPage: build the entire page!
function buildPage(json, state) {
    start = new Date().getTime()
    json = json ? json : old_json
    old_json = json
    old_state = state
    d_at = 10
    current_thread_mids = []
    checkCalendar(json)
    
    // if we have xdomain, rewrite the wording in quick search.
    var lcheckall = document.getElementById('lcheckall')
    if (lcheckall && gxdomain) {
        lcheckall.innerHTML = "Search all " + gxdomain + " lists"
    }
    
    // Add Opensearch title to OS image
    var os = document.getElementById('opensearch')
    if (os){
        os.setAttribute("title", "Add " + gxdomain + " archives to your search engines")
    }

    var stats = document.getElementById('stats')
    
    stats.style.width = "300px"
    stats.innerHTML = "<br/><h4>Stats for this blob of emails:</h4>"

    if (!json.emails || json.emails.length == 0) {
        stats.innerHTML = "<br/><br/>No emails found matching this criteria"
        document.getElementById('emails').innerHTML = ""
        return;
    }

    if (json.emails && json.emails.length >= json.max) {
        stats.innerHTML += "<font color='#FA0'>More than " + json.max.toLocaleString() + " emails found, truncating!</font><br/>"
    }

    stats.innerHTML += (json.emails.length ? json.emails.length : 0) + " emails sent, divided into " + json.no_threads + " topics.<br/>"

    var ts = "<table border='0'><tr>"
    var ms = dailyStats(json.emails)
    var max = 1
    for (var i in ms) {
        max = Math.max(max, ms[i])
    }
    for (var i in ms) {
        ts += "<td style='padding-left: 2px; vertical-align: bottom'><div title='" + ms[i] + " emails' style='background: #369; width: 6px; height: " + parseInt((ms[i] / max) * 60) + "px;'> </div></td>"
    }
    ts += "</tr></table>"
    stats.innerHTML += ts
    stats.innerHTML += "<h4>Top 10 contributors:</h4>"
    for (var i in json.participants) {
        if (i >= 10) {
            break;
        }
        var par = json.participants[i]
        if (par.name.length > 24) {
            par.name = par.name.substr(0, 23) + "..."
        }
        if (par.name.length == 0) {
            par.name = par.email
        }
        stats.innerHTML += "<img src='https://secure.gravatar.com/avatar/" + par.gravatar + ".jpg?s=32&r=g&d=mm' style='vertical-align:middle'/>&nbsp;<a href='javascript:void(0)' onclick='do_search(\"" + par.email + "\", " + current_retention + ")'><b>" + par.name.replace(/[<>]/g, "") + "</a>:</b> " + par.count + " email(s)<br/>";
    }


    // Show display modes
    stats.innerHTML += "<br/><br/><b>Display mode:</b><br/>"
    for (var mode in viewModes) {

        var btn = document.createElement('a')
        btn.setAttribute("href", "javascript:void(0);")
        btn.setAttribute("class", "btn btn-" + ((prefs.displayMode == mode) ? 'info' : 'default'))
        btn.setAttribute("onclick", "prefs.displayMode='" + mode + "'; buildPage();")
        btn.style.marginRight = "10px"
        btn.innerHTML = mode
        stats.appendChild(btn)
    }
    var btn = document.createElement('a')
    btn.setAttribute("href", "javascript:void(0);")
    btn.setAttribute("class", "btn btn-warning")
    btn.setAttribute("onclick", "prefs.hideStats='yes'; buildPage(old_json, old_state);")
    btn.style.marginRight = "10px"
    btn.innerHTML = "Hide me!"
    stats.appendChild(btn)
    if (prefs.hideStats == 'yes') {
        document.getElementById('emails').style.width = "calc(100% - 175px)"
        stats.setAttribute("class", "col-md-1 vertical-text")
        stats.innerHTML = "<div onclick=\"prefs.hideStats='no'; buildPage(old_json, old_state);\">Show stats panel..</div>"
    } else {
        var sw = 180 + stats.offsetWidth;
        document.getElementById('emails').style.width = "calc(100% - " + sw + "px)"
        stats.setAttribute("class", "hidden-md col-lg-3")
        stats.removeAttribute("onclick")
        stats.style.display = "block"
        if (json.cloud) {
            for (var i in json.cloud) {
                stats.innerHTML += "<h4 style='text-align: center;'>Hot topics:</h4>"
                stats.appendChild(wordCloud(json.cloud, 250, 80))
                break // so..this'll run if cloud has stuff, otherwise not.
            }
        }
    }
    
    nest = ""

    viewModes[prefs.displayMode].list(json, 0, 0, state ? state.deep : false);
    if (!json.emails || !json.emails.length || json.emails.length == 0) {
        document.getElementById('emails').innerHTML += "<h3>No emails found fitting this criteria</h3>"
    }
    if (json.private && json.private == true) {
        document.getElementById('emails').innerHTML += "<h4>Looks like you don't have access to this archive. Maybe you need to be logged in?</h4>"
    }
    if (json.took) {
        var rtime = new Date().getTime() - start
        document.getElementById('emails').innerHTML += "<br/><br/><small><i>Compiled in " + parseInt(json.took / 1000) + "ms, rendered in " + rtime + "ms</i></small>"
    }
    if (json.debug && pm_config.debug) {
        document.getElementById('emails').innerHTML += "<br/><br/><small><i>Debug times: " + json.debug.join(" + ") + "</i></small>"
    }
}


// getListInfo: Renders the top ML index
function getListInfo(list, xdomain, nopush) {
    current_query = ""
    var dealtwithit = false
    if (xdomain && xdomain.search("utm_source=opensearch") != -1) {
        var strs = xdomain.split(/&/)
        for (var i in strs) {
            var kv = strs[i].split(/=/)
            if (kv[0] == "websearch") {
                current_query = kv[1]
            }
            if (kv[0] == "domain") {
                xdomain = kv[1]
                xlist = "*@" + xdomain;
                list = xlist;
                if (document.getElementById('checkall')) {
                    document.getElementById('checkall').checked = true
                }
            }
        }
        nopush = true
        dealtwithit = true
        search(current_query, 30, true, true)
    }
    else if (xdomain && xdomain != "") {
        if (xdomain.length <= 1) {
            xdomain = null
        } else {
            if (xdomain.search(/:/) != -1) {
                var arr = xdomain.split(/:/)
                xdomain = arr[0]
                xlist = xdomain
                if (arr[1].search(/-/) != -1) {
                    var ya = arr[1].split(/-/)
                    toggleEmail(ya[0], ya[1], nopush)
                    dealtwithit = true
                } else {
                    current_retention = parseInt(arr[1])
                    current_query = arr[2]
                }
            }
            if (xdomain.search(/@/) != -1) {
                list = xdomain;
                xlist = list
                xdomain = xdomain.replace(/^.*?@/, "")

            }
        }
    }
    if (xdomain == undefined || xdomain == "" && list) {
        xdomain = list.replace(/^.*?@/, "")
    }
    if (!list || list.length <= 1) {
        list = 'dev@' + xdomain
    }
    if (!firstVisit && !nopush) {
        window.history.pushState({}, "", "list.html?" + xlist);
        firstVisit = false
    }

    //buildCalendar()
    var dp = document.getElementById('dp')
    for (var i = 0; i < dp.length; i++) {
        if (dp[i].value == current_retention) dp.selectedIndex = i;
    }
    
    document.getElementById('q').value = current_query
    document.getElementById('aq').value = current_query
    xlist = list;
    var arr = list.split('@', 2)
    var listname = arr[0]
    var domain = arr[1]


    var lc = document.getElementById('lc_dropdown');
    lc.innerHTML = ""
    var dom_sorted = []
    for (var dom in all_lists) {
        dom_sorted.push(dom)
    }

    // Sort out available domains with MLs
    for (var i in dom_sorted.sort()) {
        var dom = dom_sorted[i]
        var li = document.createElement("li")
        var a = document.createElement("a")
        var t = document.createTextNode(dom)
        a.setAttribute("href", "list.html?" + dom)
        a.appendChild(t)
        li.appendChild(a)
        lc.appendChild(li)
    }

    // If we have a domain ML listing, sort out the nav bar
    if (all_lists[xdomain]) {
        var ll = document.getElementById('listslist')
        ll.innerHTML = ""
        var listnames = []
        for (var key in all_lists[xdomain]) {
            listnames.push(key)
        }
        var overlaps = []
        listnames = listnames.sort(function(a, b) {
            return all_lists[xdomain][b] - all_lists[xdomain][a]
        })
        for (var i in listnames) {

            var key = listnames[i]
            var collapse = ''
            if (i >= 5) {
                collapse = 'hidden-xs hidden-sm hidden-md hidden-lg'
                overlaps.push(key)
            }
            var ln = key + '@' + xdomain
            //alert("adding" + ln)
            var li = document.createElement("li")
            var a = document.createElement("a")
            var t = document.createTextNode(key + '@')
            a.setAttribute("href", "javascript:void(0);")
            a.setAttribute("onclick", "getListInfo(this.getAttribute('id'))")
            a.setAttribute("id", ln)
            a.appendChild(t)
            li.appendChild(a)
            ll.appendChild(li)
            if (!all_lists[xdomain][listname]) {
                listname = key
                list = ln
                xlist = ln
            }
            if (list == ln) {
                li.setAttribute("class", "active " + collapse)
            } else {
                li.setAttribute("class", collapse)
            }
        }
        if (overlaps.length > 0) {
            ll.innerHTML += '<li class="dropdown navbar-right" id="otherlists"><a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">Other lists:<span class="caret"></span></a><ul class="dropdown-menu" id="otherlists_dropdown"></ul></li>'
            var ul = document.getElementById('otherlists_dropdown')
            for (var i in overlaps) {
                var key = overlaps[i]
                var ln = key + '@' + xdomain
                
                var li = document.createElement("li")
                var a = document.createElement("a")
                var t = document.createTextNode(key + '@')
                a.setAttribute("href", "javascript:void(0);")
                a.setAttribute("onclick", "getListInfo(this.getAttribute('id'))")
                a.setAttribute("id", ln)
                a.appendChild(t)
                li.appendChild(a)
                ul.appendChild(li)
                if (list == ln) {
                    li.setAttribute("class", "active")
                } else {
                    li.setAttribute("class", "")
                }
            }
        }

    }
    gxdomain = xdomain
    addSearchBar();
    if (!dealtwithit) {
        kiddos = []
        traverseThread(document.getElementById('datepicker'), 'calmonth', 'LABEL')
        for (var n in kiddos) {
            kiddos[n].setAttribute("class", "label label-default label-hover")
        }
        document.getElementById('listtitle').innerHTML = list + ", last 30 days"
        if (current_query == "") {
            global_deep = false
            current_query = ""
            GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain, null, buildPage)
            if (!nopush) {
                window.history.pushState({}, "", "list.html?" + xlist);
            }
        } else {
            search(current_query, current_retention, nopush)
        }
    }
    
}

// Fetched from ponymail_phonebook.js

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
// Fetched from ponymail_search.js


// toggleEmail: Fetch a list of emails from an ML in a specific year/month
function toggleEmail(year, mo, nopush) {
    global_deep = false
    current_query = ""
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var domain = arr[1]
    var s = year + "-" + mo
    var e = s
    if (year && mo) {
        kiddos = []
        traverseThread(document.getElementById('datepicker'), 'calmonth', 'LABEL')
        for (var n in kiddos) {
            if (kiddos[n].getAttribute("id") == ("calmonth_" + year + "-" + mo)) {
                kiddos[n].setAttribute("class", "label label-info")
            } else {
                kiddos[n].setAttribute("class", "label label-default label-hover")
            }
        }
    }
    
    
    var xmo = mo ? parseInt(mo).toString() : ""
    if (mo.length > 0 && mo <= 9) {
        xmo = '0' + xmo
    }
    if (!nopush) window.history.pushState({}, "", "list.html?" + xlist + ":" + year + '-' + xmo);
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&s=" + s + "&e=" + e, null, buildPage)
    document.getElementById('listtitle').innerHTML = xlist + " (" + months[mo - 1] + ", " + year + ")"
}



// search: run a search
function search(q, d, nopush, all) {
    keywords = q
    current_retention = d
    current_query = q
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var olist = listname
    var domain = arr[1]
    if (document.getElementById('checkall')) {
        all = document.getElementById('checkall').checked
    }
    global_deep = false
    if (all == true) {
        listname = "*"
        global_deep = true
    }
    
    clearCalendarHover()
    if (!nopush) window.history.pushState({}, "", "list.html?" + listname + "@" + domain + ":" + d + ":" + q);
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&q=" + q + "&d=" + d, null, buildPage)
    document.getElementById('listtitle').innerHTML = listname + "@" + domain + " (Quick Search, last " + d + " days)"
    xlist = olist + "@" + domain
    return false;
}

// searchAll: run a deep search of all lists
function searchAll(q, d) {
    keywords = q
    current_retention = d
    current_query = q
    global_deep = true
    //    if (!nopush) window.history.pushState({},"", "list.html?" + listname + "@" + domain + ":" + d + ":" + q);
    GetAsync("/api/stats.lua?list=*&domain=*&q=" + q + "&d=" + d, {
        deep: true
    }, buildPage)
    document.getElementById('listtitle').innerHTML = "Deep Search, last " + d + " days"
    clearCalendarHover()
    return false;
}

// do_search: run a search and update textboxes
function do_search(q, d, nopush, all) {
    document.getElementById('q').value = q
    document.getElementById('aq').value = q
    current_retention = d ? d : 30
    current_query = q
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var domain = arr[1]
    if (!nopush) window.history.pushState({}, "", "list.html?" + xlist + ":" + d + ":" + q);
    if (global_deep == true) {
        listname = "*"
        domain = "*"
    }
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&q=" + q + "&d=" + d, null, buildPage)
    document.getElementById('listtitle').innerHTML = listname + '@' + domain + " (Quick Search, last " + d + " days)"
    clearCalendarHover()
    return false;
}


function addSearchEngine() {
    window.external.AddSearchProvider("/api/websearch.lua?" + gxdomain)
}


function addSearchBar() {
    var h = document.getElementsByTagName('head')[0]
    var sl = document.createElement('link')
    sl.setAttribute("rel", "search")
    sl.setAttribute("type", "application/opensearchdescription+xml")
    sl.setAttribute("href", "/api/websearch.lua?" + gxdomain)
    sl.setAttribute("title", "PonyMail: " + gxdomain + " mailing lists")
    h.appendChild(sl)
}
// Fetched from ponymail_seeders.js

// seedGetListInfo: Callback that seeds the list index and sets up account stuff
function seedGetListInfo(json, state) {
    all_lists = json.lists
    if (typeof json.preferences != undefined && json.preferences) {
        prefs = json.preferences
    }
    if (typeof json.login != undefined && json.login) {
        login = json.login
        if (login.credentials) {
            setupUser(login)
        }
    }
    getListInfo(state.l, state.x, state.n)
}

// seedPrefs: get prefs/login and call something else
function seedPrefs(json, state) {
    if (typeof json.preferences != undefined && json.preferences) {
        prefs = json.preferences
    }
    if (typeof json.login != undefined && json.login) {
        login = json.login
        if (login.credentials) {
            setupUser(login)
        }
    }
    if (state && state.docall) {
        GetAsync(state.docall[0], null, state.docall[1])
    }
}
// preGetListInfo: Callback that fetches preferences and sets up list data
function preGetListInfo(list, xdomain, nopush) {
    GetAsync("/api/preferences.lua", {
        l: list,
        x: xdomain,
        n: nopush
    }, seedGetListInfo)
}

// Fetched from ponymail_stats.js


// showStats: Show the ML stats on the front page
function showStats(json) {
    var obj = document.getElementById('list_stats')
    
    obj.innerHTML = "<h3 style='margin-top: -10px;'>Overall 14 day activity:</h3>"
    obj.innerHTML += '<span class="glyphicon glyphicon-user"> </span> ' + json.participants.toLocaleString() + " People &nbsp; "
    obj.innerHTML += '<span class="glyphicon glyphicon-envelope"> </span> ' + json.hits.toLocaleString() + ' messages &nbsp';
    obj.innerHTML += '<span class="glyphicon glyphicon-list-alt"> </span> ' + json.no_threads.toLocaleString() + " topics &nbsp; "
    obj.innerHTML += '<span class="glyphicon glyphicon-inbox"> </span> ' + json.no_active_lists.toLocaleString() + " active lists."
    
    var ts = "<table border='0' style='float: right; margin-top: -30px;'><tr>"
    var max = 1
    for (var i in json.activity) {
        max = Math.max(max, json.activity[i][1])
    }
    
    for (var i in json.activity) {
        var day = new Date(json.activity[i][0]).toDateString()
        ts += "<td style='padding-left: 2px; vertical-align: bottom'><div title='" + day + ": " + json.activity[i][1] + " emails' style='background: #369; width: 6px; height: " + parseInt((json.activity[i][1] / max) * 48) + "px;'> </div></td>"
    }
    ts += "</tr></table>"
    obj.innerHTML += ts
}// Fetched from ponymail_timetravel.js


function timeTravelSingleThreadRedirect(json) {
    if (json && json.thread) {
        location.href = "/thread.html/" + json.thread.mid
    }
}

function timeTravelSingleThread() {
    var mid = current_thread_json[0].mid
    GetAsync("/api/thread.lua?timetravel=true&id=" + mid, null, timeTravelSingleThreadRedirect)
}



// time travel in list mode:
function timeTravelListRedirect(json, state) {
    if (json && json.emails) {
        for (var i in json.emails) {
            current_flat_json.push(json.emails[i])
        }
    }
    if (json && json.thread) {
        var osubs = countSubs(current_thread_json[state.id])
        var nsubs = countSubs(json.thread)
        var oid = current_thread_json[state.id].tid
        if (nsubs > osubs || nsubs >= osubs && !json.thread.irt) {
            toggleEmails_threaded(state.id)
            current_thread_json[state.id] = json.thread
            toggleEmails_threaded(state.id)
            var subs = countSubs(json.thread)
            var parts = countParts(json.thread)
            if (document.getElementById('subs_' + state.id) != null) {
                document.getElementById('subs_' + state.id).innerHTML = subs + " replies"
                document.getElementById('people_' + state.id).innerHTML = parts + " people"
                document.getElementById('people_' + state.id).style.visibility = parts > 1 ? "visible" : "hidden"
            }
            document.getElementById('magic_' + state.id).innerHTML = "<i>Voila! We've found the oldest email in this thread for you and worked our way forward. Enjoy!</i>"
        }
        else {
            document.getElementById('magic_' + state.id).innerHTML = "<i>Hm, we couldn't find any more messages in this thread. bummer!</i>"
        }
        if (state.jump) {
            var thread = findEpoch(state.jump)
            if (thread) {
                thread.setAttribute("meme", "true")
                thread.style.background = "rgba(200,200,255, 0.25)"
                xyz = thread.getAttribute("id")
                window.setTimeout(function() { document.getElementById(xyz).scrollIntoView() }, 1000)
                document.getElementById(xyz).scrollIntoView()
            } else {
                document.getElementById('magic_' + state.id).scrollIntoView();
            }
            document.getElementById('magic_' + state.id).innerHTML = "Showing the thread in its entirety"
        }
        current_thread_json[state.id].magic = true
    }
}

function timeTravelList(id, jump) {
    var mid = current_thread_json[id].tid
    GetAsync("/api/thread.lua?timetravel=true&id=" + mid, {id: id, jump: jump}, timeTravelListRedirect)
}// Fetched from ponymail_user_preferences.js


// logout: log out a user
function logout() {
    GetAsync("/api/preferences.lua?logout=true", null, function() { location.href = document.location; })
}


// savePreferences: save account prefs to ES
function savePreferences() {
    var prefarr = []
    for (var i in pref_keys) {
        var key = pref_keys[i]
        var o = document.getElementById(key)
        var val = o ? o.value : null
        if (o && o.selectedIndex) {
            val = o.options[o.selectedIndex].value
        }
        if (val) {
            prefarr.push(key + "=" + val)
            prefs[key] = val
        }
    }
    GetAsync("/api/preferences.lua?save=true&" + prefarr.join("&"), null, hideComposer)
}

// showPreferences: show the account prefs in the splash window
function showPreferences() {
    var obj = document.getElementById('splash')
    obj.style.display = "block"
    obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here<big> &#x2612;</big></a></p><h3>User preferences:</h3>"
    obj.innerHTML += "<p>You can change your preferences here. Some changes may not take place til you refresh your view.</p>"
    
    
    // set up view section
    var section = document.createElement('div')
    section.setAttribute("class", "bs-callout bs-callout-primary prefs")
    section.innerHTML = "<h4>Viewing preferences:</h4>"
    
    
    // Display mode
    section.appendChild(generateFormDivs('displayMode', 'Display mode, list view:', 'select', {
        threaded: "Threaded view",
        flat: "Flat view"
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
    
    // hideStats mode
    section.appendChild(generateFormDivs('hideStats', 'Hide statistics window:', 'select', {
        yes: "Yes",
        no: "No"
    }, prefs.hideStats))
    
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
function setupUser(login) {
    var uimg = document.getElementById('uimg')
    if (!uimg) {
        return
    }
    uimg.setAttribute("src", "/images/user.png")
    uimg.setAttribute("title", "Logged in as " + login.credentials.fullname)
    if (login.notifications && login.notifications > 0) {
        uimg.setAttribute("src", "/images/user_notif.png")
        uimg.setAttribute("title", "Logged in as " + login.credentials.fullname + " - You have " + login.notifications + " new notifications!")
    }
    
    var pd = document.getElementById('prefs_dropdown')
    pd.innerHTML = ""
    
    // Prefs item
    var li = document.createElement("li")
    var a = document.createElement("a")
    var t = document.createTextNode(login.credentials.fullname + "'s preferences")
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

// Fetched from ponymail_zzz.js


// dealWithKeyboard: Handles what happens when you hit the escape key
function dealWithKeyboard(e) {
    if (e.keyCode == 27) {
        if (document.getElementById('splash').style.display == 'block') {
            document.getElementById('splash').style.display = "none"
            saveDraft()
        } else if (location.href.search(/list\.html/) != -1) { // should only work for the list view
            
            
            var thread = document.getElementById('thread_' + current_thread.toString().replace(/@<.+>/, ""))
            if (thread) {
                    // Close one thread?
                if (thread.style.display != 'none') {
                    toggleEmails_threaded(current_thread, true)
                } else {
                    // Close all threads?
                    kiddos = []
                    traverseThread(document.body, 'thread_', 'DIV')
                    for (var i in kiddos) {
                        var id = kiddos[i].getAttribute('id').match(/thread_(.+)/)[1]
                        toggleEmails_threaded(id, true)
                    }
                }
            }
        }
    }
}

var footer = document.createElement('footer')
footer.setAttribute("class", 'footer')
footer.style.height = "32px"
footer.style.width = "90%"
var fd = document.createElement('div')
fd.setAttribute("class", "container")
fd.innerHTML = "<p class='muted' style='text-align: center;'>Powered by <a href='https://github.com/Humbedooh/ponymail'>Pony Mail v/0.1a</a>.</p>"
footer.appendChild(fd)
document.body.appendChild(footer)

window.addEventListener("keyup", dealWithKeyboard, false);
window.onpopstate = function(event) {
    getListInfo(null, document.location.search.substr(1), true)
}
