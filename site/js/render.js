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
var firstVisit = true
var global_deep = false
var old_state = {}
var nest = ""
var xlist = ""
var domlist = {}
var compose_headers = {}
var login = {}


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
    n = 0;
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
    n = eml.epoch;
    for (var i in eml.children) {
        n = Math.max(n, countNewest(eml.children[i]));
    }
    return n
}

// countParts: counts the number of unique participants in a thread
function countParts(eml, kv) {
    n = 0;
    email = findEml(eml.tid)
    kv = kv ? kv : {}
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
        var qdeep = document.getElementById('checkall') ? document.getElementById('checkall').checked : false
        if (qdeep || deep || global_deep && typeof eml.list != undefined && eml.list != null) {
            var elist = (eml.list ? eml.list : "").replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            var elist2 = eml.list_raw.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            if (pm_config.shortLists) {
                elist = elist.replace(/\.[^.]+\.[^.]+$/, "")
            }
            d = "<a href='list.html?" + elist2 + "'><label class='label label-warning'>" + elist + "</label></a> &nbsp;"
            if (eml.subject.length > 75) {
                eml.subject = eml.subject.substr(0, 75) + "..."
            }
        }
        mdate = new Date(eml.epoch * 1000)
        mdate = mdate.toLocaleFormat ? mdate.toLocaleFormat('%Y-%m-%d %T') : mdate.toLocaleString('en-GB', {
            hour12: false
        })
        var subject = eml.subject.replace(/</mg, "&lt;")
        nest += "<li class='list-group-item'> &nbsp; <a href='javascript:void(0);' onclick='loadEmails_flat(" + i + ");'>" + subject + "</a> <label style='float: left; width: 140px;' class='label label-info'>" + eml.from.replace(/<.*>/, "") + "</label><label style='float: right; width: 140px;' class='label label-" + ld + "' title='" + ti + "'>(" + mdate + ")</label><div id='thread_" + i + "' style='display:none';></div></li>"
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
        bulk.innerHTML += '<a href="javascript:void(0);" class="btn btn-success" onclick="loadList_flat(false, ' + 15 + ', ' + nstart + ');">Show previous 15</a> &nbsp '
    }

    if (json.length > (start + limit)) {
        remain = Math.min(15, json.length - (start + limit))
        bulk.innerHTML += '<a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_flat(false, ' + 15 + ', ' + (start + 15) + ');">Show next ' + remain + '</a>'
    }

}

// loadList_threaded: Same as above, but threaded display
function loadList_threaded(mjson, limit, start, deep) {
    open_emails = []
    limit = limit ? limit : d_ppp;
    var fjson = mjson ? ('emails' in mjson && mjson.emails.constructor == Array ? mjson.emails.sort(function(a, b) {
        return b.epoch - a.epoch
    }) : []) : current_flat_json
    current_flat_json = fjson
    
    json = mjson ? sortIt(mjson.thread_struct) : current_thread_json
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

        ls = 'default'
        if (subs > 0) {
            ls = 'primary'
        }
        lp = 'default'
        if (people > 1) {
            lp = 'success'
        }
        ld = 'default'
        var ti = ''
        if (latest > (now - 86400)) {
            ld = 'warning'
            ti = "Has activity in the past 24 hours"
        }
        var d = ''
        var qdeep = document.getElementById('checkall') ? document.getElementById('checkall').checked : false
        if (qdeep || deep || global_deep) {
            var elist = eml.list_raw.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            var elist2 = eml.list_raw.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            if (pm_config.shortLists) {
                elist = elist.replace(/\.[^.]+\.[^.]+$/, "")
            }
            d = "<a href='list.html?" + elist2 + "'><label class='label label-warning'>" + elist + "</label></a> &nbsp;"
            if (eml.subject.length > 75) {
                eml.subject = eml.subject.substr(0, 75) + "..."
            }
        }
        var subject = eml.subject.replace(/</mg, "&lt;")
        mdate = new Date(latest * 1000)
        mdate = mdate.toLocaleFormat ? mdate.toLocaleFormat('%Y-%m-%d %T') : mdate.toLocaleString('en-GB', {
            hour12: false
        })
        nest += "<li class='list-group-item'>" + d + "<a href='javascript:void(0);' onclick='toggleEmails_threaded(" + i + ");'>" + subject + "</a> <label style='float: right; width: 140px;' class='label label-" + ld + "' title='" + ti + "'>(" + mdate + ")</label><label class='label label-" + ls + "'>" + subs + " replies</label> &nbsp; " + (people > 1 ? "<label class='label label-" + lp + "'>" + people + " participants</label>" : "") + "<div id='thread_" + i + "' style='display:none';></div></li>"
    }
    nest += "</ul>"


    var bulk = document.getElementById('emails')
    bulk.innerHTML = nest
    if (prefs.hideStats == 'yes') {
        bulk.setAttribute("class", "well col-md-10 col-lg-10")
    } else {
        bulk.setAttribute("class", "well col-md-10 col-lg-7")
    }
    var dp = (deep || global_deep) ? 'true' : 'false'
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        bulk.innerHTML += '<a href="javascript:void(0);" class="btn btn-success" onclick="loadList_threaded(false, ' + 15 + ', ' + nstart + ', ' + dp + ');">Show previous 15</a> &nbsp '
    }

    if (json.length > (start + limit)) {
        remain = Math.min(15, json.length - (start + limit))
        bulk.innerHTML += '<a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_threaded(false, ' + 15 + ', ' + (start + 15) + ', ' + dp + ');">Show next ' + remain + '</a>'
    }

}

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

// permaLink: redirect to an email permalink
function permaLink(id) {
    location.href = "permalink.html/" + id
}


// displayEmail: Shows an email inside a thread
function displayEmail(json, id) {
    if (current_thread_mids[json.mid]) {
        return
    } else {
        current_thread_mids[json.mid] = true
        current_email_msgs.push(json)
    }
    saved_emails[json.mid] = json
    var cols = ['primary', 'success', 'info', 'default', 'warning', 'danger']
    var thread = document.getElementById('thread_' + id.toString().replace(/@<.+>/, ""))
    if (thread) {
        thread.setAttribute("class", "reply bs-callout bs-callout-" + cols[parseInt(Math.random() * cols.length - 0.01)])
        thread.innerHTML = ''
        thread.innerHTML += ' &nbsp; <label class="label label-success" onclick="compose(\'' + json.mid + '\');" style="cursor: pointer; float: right; margin-left: 10px;">Reply</label>'
        thread.innerHTML += ' &nbsp; <label class="label label-warning" onclick="permaLink(\'' + json.mid + '\');" style="cursor: pointer; float: right;">Permalink</label>'
        thread.innerHTML += "<br/>"
        //thread.style.border = "1px dotted #666"
        thread.style.padding = "5px"
        thread.style.fontFamily = "Hack"
        json.date = new Date(json.epoch*1000).toLocaleString();
        var fields = ['From', 'To', 'Subject', 'Date']
        for (var i in fields) {
            var key = fields[i]

            thread.innerHTML += "<b>" + key + ": </b>" + json[key.toLowerCase()].replace(/</g, "&lt;") + "<br/>"
        }
        var ebody = json.body
        ebody = ebody.replace(/</, "&lt;")
        ebody = "\n" + ebody
        if (prefs.compactQuotes == 'yes') {
            ebody = ebody.replace(/(?:\r?\n)((>+[ \t]*[^\r\n]*\r?\n+)+)/mg, function(inner) {
                var rnd = (Math.random() * 100).toString()
                var html = "<div class='bs-callout bs-callout-default' style='padding: 2px;' id='parent_" + rnd + "'>" +
                    "<img src='images/quote.png' title='show/hide original text' onclick='toggleView(\"quote_" + rnd + "\")'/><br/>" +
                    "<div style='display: none;' id='quote_" + rnd + "'>" + inner + "</div></div>"
                return html
            })
        }
        ebody = ebody.replace(re_weburl, "<a href='$1'>$1</a>")

        thread.innerHTML += "<br/><pre style='font-family: Hack;'>" + ebody + '</pre>'
    } else {
        alert("Error, " + id + " not found :(")
    }
}

// toggleView: show/hide a DOM object
function toggleView(el) {
    var obj = document.getElementById(el)
    if (obj) {
        obj.style.display = (obj.style.display == 'none') ? 'block' : 'none'
    }
}

// displaySingleEmail: shows a single email. Used for permalinks
function displaySingleEmail(json, id) {

    var thread = document.getElementById('email')
    if (thread) {
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
        for (var i in fields) {
            var key = fields[i]

            thread.innerHTML += "<b>" + key + ": </b>" + json[key.toLowerCase()].replace(/</g, "&lt;") + "<br/>"
        }
        if (json.private) {
            thread.innerHTML += "<font color='#C00'><b>Private list: </b> YES</font><br/>"
        }
        var lid = json.list_raw.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")

        var ebody = json.body
        ebody = ebody.replace(/</, "&lt;")
        ebody = "\n" + ebody
        if (true) {
            ebody = ebody.replace(/(?:\r?\n)((>+[ \t]*[^\r\n]*\r?\n+)+)/mg, function(inner) {
                var rnd = (Math.random() * 100).toString()
                var html = "<div class='bs-callout bs-callout-default' style='padding: 2px;' id='parent_" + rnd + "'>" +
                    "<img src='images/quote.png' title='show/hide original text' onclick='toggleView(\"quote_" + rnd + "\")'/><br/>" +
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

var kiddos = []

// traverseThread: finds all child divs inside an object
function traverseThread(child) {
    if (!child) {
        return
    }
    for (var i in child.childNodes) {
        if (child.childNodes[i].nodeType == 1 && child.childNodes[i].nodeName == 'DIV') {
            kiddos.push(child.childNodes[i])
            if (child.childNodes[i].hasChildNodes()) {
                traverseThread(child.childNodes[i])
            }
        }
    }

}

// sortByDate: reshuffle a threaded display into a flat display, sorted by date
function sortByDate(tid) {
    kiddos = []
    var t = document.getElementById("thread_" + tid)
    var h = document.getElementById("helper_" + tid)
    if (t) {
        traverseThread(t)
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
        h.innerHTML = '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'thread\'; toggleEmails_threaded(' + tid + ', true);toggleEmails_threaded(' + tid + ');" style="cursor: pointer; float: right;">Click to view as nested thread</label> &nbsp;'
    }
}

// displayEmailThreaded: Appends an email to a threaded display of a topic
function displayEmailThreaded(json, state) {
    if (state.main == json.mid || state.main == json.tid) {
        return
    }
    saved_emails[json.mid] = json
    var b = state.before
    var obj = document.getElementById("thread_" + b.toString().replace(/@<.+>/, "")) ? document.getElementById("thread_" + b.toString().replace(/@<.+>/, "")) : document.getElementById("thread_" + state.main)
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
    } else {
        alert("Could not find parent object, thread_" + state.main)
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

// getChildren: fetch all replies to a topic from ES
function getChildren(main, email) {
    var pchild = null
    if (email.children && email.children.sort) {
        email.children.sort(function(a, b) {
            return b.epoc - a.epoch
        })
        for (var i in email.children) {
            var child = email.children[i]
            if (child.tid != email.mid) {
                var eml = saved_emails[child.tid]
                if (!eml || !eml.from) {
                    GetAsync("email.lua?id=" + child.tid, {
                        main: main,
                        before: email.tid,
                        pchild: pchild
                    }, displayEmailThreaded)
                } else {
                    displayEmailThreaded(eml, {
                        main: main,
                        before: email.tid,
                        pchild: pchild
                    })
                }
                if (child.children && child.children.length > 0) {
                    getChildren(main, child)
                }
            }
            pchild = child.tid
        }
    }
}

// toggleEmails_threaded: Open up a threaded display of a topic
function toggleEmails_threaded(id, close) {
    current_thread_mids = {}
    current_email_msgs = []
    var thread = document.getElementById('thread_' + id.toString().replace(/@<.+>/, ""))
    if (thread) {
        current_thread = id
        thread.style.display = (thread.style.display == 'none') ? 'block' : 'none';
        var helper = document.getElementById('helper_' + id)
        if (!helper) {
            helper = document.createElement('div')
            helper.setAttribute("id", "helper_" + id)
            helper.style.padding = "10px"
            thread.parentNode.insertBefore(helper, thread)
        }
        
        if (prefs.groupBy == 'thread') {
            helper.innerHTML = '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'date\'; sortByDate(' + id + ');" style="cursor: pointer; float: right;">Click to view as flat thread, sort by date</label> &nbsp;'
        } else {
            helper.innerHTML = '<label style="padding: 4px; font-size: 10pt; cursor: pointer; float: right;" class="label label-info" onclick="prefs.groupBy=\'thread\'; toggleEmails_threaded(' + id + ', true);toggleEmails_threaded(' + id + ');" style="cursor: pointer; float: right;">Click to view as nested thread</label> &nbsp;'
        }
        if (keywords.length > 0) {
            helper.innerHTML += "<p><i><b>Note:</b> You are viewing a keyword search result in threaded mode. Only results matching your keywords are shown, which may distort the thread. For the best result, go to the specific list and view the full thread there, or view your search results in flat mode.</i></p>"
            var btn = document.createElement('a')
            btn.setAttribute("href", "javascript:void(0);")
            btn.setAttribute("class", "btn btn-success")
            btn.setAttribute("onclick", "prefs.displayMode='flat'; buildPage();")
            btn.style.marginRight = "10px"
            btn.innerHTML = "View results in flat mode instead"
            helper.appendChild(btn)
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
            GetAsync("email.lua?id=" + current_thread_json[id].tid, {
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
            GetAsync("email.lua?id=" + current_flat_json[id].id, id, displayEmail)
        } else {
            displayEmail(eml, id)
        }

    }
}

// toggleEmail: Fetch a list of emails from an ML in a specific year/month
function toggleEmail(year, mo, nopush) {
    global_deep = false
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var domain = arr[1]
    var s = year + "-" + mo
    var e = s
    var xmo = mo ? parseInt(mo).toString() : ""
    if (mo.length > 0 && mo <= 9) {
        xmo = '0' + xmo
    }
    if (!nopush) window.history.pushState({}, "", "list.html?" + xlist + ":" + year + '-' + xmo);
    GetAsync("stats.lua?list=" + listname + "&domain=" + domain + "&s=" + s + "&e=" + e, null, buildPage)
    document.getElementById('listtitle').innerHTML = xlist + " (" + months[mo - 1] + ", " + year + ")"
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
            cale += "<label style='width: 80px; float: left;cursor: pointer;' class='label label-default' onmouseout='this.setAttribute(\"class\", \"label label-default\");'  onmouseover='this.setAttribute(\"class\", \"label label-warning\");' onclick='toggleEmail(" + year + ", " + (y + 1) + ");' >" + months[y] + "</label><br/>"
        }
        cale += "</div>"
        dp.innerHTML += cale
    }
}

// dailyStats: compiles the day-by-day stats for a chunk of emails
function dailyStats(json) {
    days = {}
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
    if (all == true) {
        listname = "*"
    }
    global_deep = false
    if (!nopush) window.history.pushState({}, "", "list.html?" + listname + "@" + domain + ":" + d + ":" + q);
    GetAsync("stats.lua?list=" + listname + "&domain=" + domain + "&q=" + q + "&d=" + d, null, buildPage)
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
    GetAsync("stats.lua?list=*&domain=*&q=" + q + "&d=" + d, {
        deep: true
    }, buildPage)
    document.getElementById('listtitle').innerHTML = "Deep Search, last " + d + " days"
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
    GetAsync("stats.lua?list=" + listname + "&domain=" + domain + "&q=" + q + "&d=" + d, null, buildPage)
    document.getElementById('listtitle').innerHTML = listname + '@' + domain + " (Quick Search, last " + d + " days)"
    return false;
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
    json = json ? json : old_json
    old_json = json
    old_state = state
    d_at = 10
    checkCalendar(json)

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
        stats.innerHTML += "<img src='https://secure.gravatar.com/avatar/" + par.gravatar + ".jpg?s=32&r=g&d=mm' style='vertical-align:middle'/>&nbsp;<a href='javascript:void(0)' onclick='do_search(\"" + par.email + "\", " + current_retention + ")'><b>" + par.name + "</a>:</b> " + par.count + " email(s)<br/>";
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
        document.getElementById('emails').style.width = "calc(100% - 500px)"
        stats.setAttribute("class", "hidden-md col-lg-3")
        stats.removeAttribute("onclick")
        stats.style.display = "block"
        if (json.cloud) {
            stats.innerHTML += "<h4 style='text-align: center;'>Hot topics:</h4>"
            stats.appendChild(wordCloud(json.cloud, 250, 80))
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
        document.getElementById('emails').innerHTML += "<br/><br/><small><i>Rendered in " + parseInt(json.took / 1000) + "ms</i></small>"
    }
    if (json.debug && pm_config.debug) {
        document.getElementById('emails').innerHTML += "<br/><br/><small><i>Debug times: " + json.debug.join(" + ") + "</i></small>"
    }
}


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

// preGetListInfo: Callback that fetches preferences and sets up list data
function preGetListInfo(list, xdomain, nopush) {
    GetAsync("preferences.lua", {
        l: list,
        x: xdomain,
        n: nopush
    }, seedGetListInfo)
}

// getListInfo: Renders the top ML index
function getListInfo(list, xdomain, nopush) {
    current_query = ""
    var dealtwithit = false
    if (xdomain && xdomain != "") {
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
    document.getElementById('dp').selectedIndex = 0;
    document.getElementById('q').value = ""
    document.getElementById('aq').value = ""
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
        for (var i in listnames.sort(function(a, b) {
            return all_lists[xdomain][b] - all_lists[xdomain][a]
        })) {

            var key = listnames[i]
            if (xdomain == 'incubator.apache.org' && key != 'general') {
                continue
            }
            var collapse = ''
            if (all_lists[xdomain][key] < 100 || i >= 5) {
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

    if (!dealtwithit) {
        document.getElementById('listtitle').innerHTML = list + ", last 30 days"
        if (current_query == "") {
            GetAsync("stats.lua?list=" + listname + "&domain=" + domain, null, buildPage)
            if (!nopush) {
                window.history.pushState({}, "", "list.html?" + xlist);
            }
        } else {
            search(current_query, current_retention, nopush)
        }
    }
}



// dealWithKeyboard: Handles what happens when you hit the escape key
function dealWithKeyboard(e) {
    if (e.keyCode == 27) {
        if (document.getElementById('splash').style.display == 'block') {
            document.getElementById('splash').style.display = "none"
        } else {
            toggleEmails_threaded(current_thread, true)
        }
    }
}

// hideComposer: hide the composer (splash) window
function hideComposer(evt) {
    var es = evt ? (evt.target || evt.srcElement) : null;
    if (!es || !es.getAttribute || !es.getAttribute("class") || es.getAttribute("class").search(/label/) == -1) {
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
    request.open("POST", "compose.lua");
    request.send(f);
    
    var obj = document.getElementById('splash')
    obj.innerHTML = "<h3>Email dispatched!</h3><p>Provided it passes spam checks, your email should be on its way to the mailing list now.</p>"
    window.setTimeout(hideComposer, 2000)
}


// compose: render a compose dialog for a reply to an email
function compose(eid) {
    var email = saved_emails[eid]
    if (email) {
        if (login.credentials) {
            compose_headers = {
                'in-reply-to': email['message-id'],
                'references': email['message-id'] + " " + (email['references'] ? email['references'] : ""),
                'to': email['list_raw'].replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            }
            var obj = document.getElementById('splash')
            obj.style.display = "block"
            obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here</a></p><h3>Reply to email:</h3>"
            var area = document.createElement('textarea')
            area.style.width = "660px"
            area.style.height = "400px";
            area.setAttribute("id", "reply_body")
            var eml = "\n\nOn " + email.date + ", " + email.from.replace(/<.+>/, "") + " wrote: \n"
            eml += email.body.replace(/([^\r\n]*)/mg, "&gt; $1")

            var subject = "Re: " + email.subject.replace(/^Re:\s*/mg, "").replace(/</mg, "&lt;")

            var txt = document.createElement('input')
            txt.setAttribute("type", "text")
            txt.setAttribute("style", "width: 500px;")
            txt.value = subject
            txt.setAttribute("id", "reply_subject")
            

            obj.appendChild(txt)

            area.innerHTML = eml
            obj.appendChild(area)

            // submit button
            var btn = document.createElement('input')
            btn.setAttribute("type", "button")
            btn.setAttribute("class", "btn btn-success")
            btn.style.background = "#51A351 !important"
            btn.setAttribute("value", "Send reply")
            btn.setAttribute("onclick", "sendEmail(this.form)")
            obj.appendChild(btn)
            area.focus()
        } else {
            var subject = "Re: " + email.subject.replace(/^Re:\s*/mg, "").replace(/</mg, "&lt;")
            var link = 'mailto:' + email.list.replace(/([^.]+)\./, "$1@") + "?subject=" + subject + "&amp;In-Reply-To=" + email['message-id']
            var obj = document.getElementById('splash')
            obj.style.display = "block"
            obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here</a></p><h3>Reply to email:</h3>"
            obj.innerHTML += "<p>You need to be logged in to reply online.<br/>If you have a regular mail client, you can reply to this email by clicking below:<br/><h4><a style='color: #FFF;' class='btn btn-success' onclick='hideComposer(event);' href=\"" + link + "\">Reply via Mail Client</a></h4>"
        }
    }
}


// getSingleEmail: fetch an email from ES and go to callback
function getSingleEmail(id) {
    GetAsync("/email.lua?id=" + id, null, displaySingleEmail)
}


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

var fl = null

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
}

// listDomains: fetch prefs and ML stats
function listDomains() {
    GetAsync("preferences.lua", null, seedDomains)
    GetAsync("pminfo.lua", null, showStats)
}

// setupUser: Set up the user dropdown (top right)
function setupUser(login) {
    var uimg = document.getElementById('uimg')
    uimg.setAttribute("src", "images/user.png")
    uimg.setAttribute("title", "Logged in as " + login.credentials.fullname)
    if (login.notifications && login.notifications > 0) {
        uimg.setAttribute("src", "images/user_notif.png")
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


// logout: log out a user
function logout() {
    GetAsync("preferences.lua?logout=true", null, function() { location.href = document.location; })
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
    GetAsync("preferences.lua?save=true&" + prefarr.join("&"), null, hideComposer)
}

// showPreferences: show the account prefs in the splash window
function showPreferences() {
    var obj = document.getElementById('splash')
    obj.style.display = "block"
    obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here</a></p><h3>User preferences:</h3>"
    obj.innerHTML += "<p>You can change your preferences here. Some changes may not take place til you refresh your view.</p>"
    
    
    // set up view section
    var section = document.createElement('div')
    section.setAttribute("class", "bs-callout bs-callout-primary prefs")
    section.innerHTML = "<h3>Viewing preferences:</h3>"
    
    
    // Display mode
    section.appendChild(generateFormDivs('displayMode', 'Display mode, list view:', 'select', {
        threaded: "Threaded view",
        flat: "Flat view"
    }, prefs.displayMode))
    
    // groupBy mode
    section.appendChild(generateFormDivs('groupBy', 'Display mode, email view:', 'select', {
        threaded: "Threaded view, nest by reference",
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
    section.innerHTML = "<h3>Notification preferences:</h3>"
    
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

// hide composer on email click
if (document.getElementById('emails')) {
    document.getElementById('emails').setAttribute("onclick", "hideComposer(event)")
}