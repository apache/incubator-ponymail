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



/******************************************
 Fetched from dev/ponymail_assign_vars.js
******************************************/


// These are all variables needed at some point during our work.
// They keep track of the JSON we have received, storing it in the browser,
// Thus lightening the load on the backend (caching and such)

var _VERSION_ = "0.6a"
var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
var d_ppp = 15; // results per page
var open_emails = []
var list_year = {}
var current_retention = "lte=1M" // default timespan for list view
var current_cal_min = 1997 // don't go further back than 1997 in case everything blows up, date-wise
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
var pending_urls = {}
var pb_refresh = 0
var treeview_guard = {}

var viewModes = {
    threaded: {
        email: loadEmails_threaded,
        list: loadList_threaded
    },
    flat: {
        email: loadEmails_flat,
        list: loadList_flat
    },
    treeview: {
        email: loadEmails_flat,
        list: loadList_treeview
    },
}


/******************************************
 Fetched from dev/ponymail_composer.js
******************************************/



function saveDraft() {
    // If the user was composing a new thread, let's save the contents (if any)
    // for next time
    if (composeType == "new") {
        if (typeof(window.sessionStorage) !== "undefined") {
            window.sessionStorage.setItem("reply_body_" + xlist, document.getElementById('reply_body').value)
            window.sessionStorage.setItem("reply_subject_" + xlist, document.getElementById('reply_subject').value)
            window.sessionStorage.setItem("reply_list", xlist)
        }
        composeType = ""
    // Likewise, if composing a reply, save it in case the user wants to revisit
    // the draft
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
    
    
    // We have a bit of a mix here due to nginx not supporting multipart form data
    var of = []
    for (var k in compose_headers) {
        of.push(k + "=" + encodeURIComponent(compose_headers[k]))
    }
    
    of.push("subject=" + encodeURIComponent(document.getElementById('reply_subject').value))
    of.push("body=" + encodeURIComponent(document.getElementById('reply_body').value))
    
    var request = new XMLHttpRequest();
    request.open("POST", "/api/compose.lua");
    request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    request.send(of.join("&"))
    
    var obj = document.getElementById('splash')
    hideComposer()
    
    // Clear the draft stuff
    if (typeof(window.sessionStorage) !== "undefined" && compose_headers.eid && compose_headers.eid.length > 0) {
        window.sessionStorage.removeItem("reply_subject_eid_" + compose_headers.eid)
        window.sessionStorage.removeItem("reply_body_eid_" + compose_headers.eid)
        
        // If it's a new non-reply email, clear that box as well
        if (composeType == "new") {
            window.sessionStorage.removeItem("reply_subject__" + xlist)
            window.sessionStorage.removeItem("reply_body_" + xlist)
        }
    }
    
    // Open the annoying popup dialogue :)
    popup("Email dispatched!", "Provided it passes spam checks, your email should be on its way to the mailing list now. <br/><b>Do note:</b> Some lists are always moderated, so your reply may be held for moderation for a while.")
}


// compose: render a compose dialog for a reply to an email
function compose(eid, lid, type) {
    var email = null
    
    // If a list ID is supplied, try to work out which list,
    // and create a dummy email object, as we're not
    // replying to an email here.
    if (lid) {
        if (lid == "xlist") {
            if (xlist != null && xlist.length > 4) {
                lid = xlist;
            } else {
                lid = null
            }
        }
        if (lid != null) {
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
    }
    else {
        composeType = "reply"
        email = saved_emails[eid]
    }
    
    // If we have a valid dummy email or are replying to an email, then...
    if (email != null) {
        if (login.credentials) {
            current_reply_eid = eid
            // Turn list-id into an actual email address to send to
            var listname = email['list'].replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            
            // Save some smtp headers for later
            compose_headers = {
                'eid': eid,
                'in-reply-to': email['message-id'],
                'references': email['message-id'] + " " + (email['references'] ? email['references'] : ""),
                'to': listname
            }
            
            // find the composer pane and show it
            var obj = document.getElementById('splash')
            obj.style.display = "block"
            
            // Set the right title of the pane
            what = "Reply to email"
            if (lid) {
                what = "Start a new thread"
            }
            obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here<big> &#x2612;</big></a></p><h3>" + what + " on " + listname + ":</h3>"
            
            // Append the previous email body, if such exists
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
            
            // If it's a new email, scrap what we just did...gee, swell!
            if (lid) {
                eml = ""
                eml_raw = ""
                subject = ""
            }
            
            // Set up a subject text field, populate it
            obj.appendChild(document.createTextNode('Subject: '))
            var txt = document.createElement('input')
            txt.setAttribute("type", "text")
            txt.setAttribute("style", "width: 500px;")
            txt.value = subject
            txt.setAttribute("id", "reply_subject")
            obj.appendChild(txt)

            // Set email body in HTML
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
                // construct long and winding mailto: link
                var xlink = 'mailto:' + listname + "?subject=" + escape(subject) + "&amp;In-Reply-To=" + escape(email['message-id']) + "&body=" + escape(eml_raw)
                
                // Make a button object
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
        // If not logged in, we don't show the UI, but we do show a "reply-via-MUA" button
        } else {
            // Same as above, construct mailto: link
            var eml_raw = "\n\nOn " + email.date + ", " + email.from + " wrote: \n"
            eml_raw += email.body.replace(/([^\r\n]*)/mg, "> $1")
            var subject = "Re: " + email.subject.replace(/^Re:\s*/mg, "").replace(/</mg, "&lt;")
            var link = 'mailto:' + email.list.replace(/[<>]/g, "").replace(/([^.]+)\./, "$1@") + "?subject=" + escape(subject) + "&In-Reply-To=" + escape(email['message-id']) + "&body=" + escape(eml_raw)
            
            // Get compose pane, show it
            var obj = document.getElementById('splash')
            obj.style.display = "block"
            obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here<big> &#x2612;</big></a></p><h3>Reply to email:</h3>"
            
            // "sorry, but..." text + mua link
            obj.innerHTML += "<p>You need to be logged in to reply online.<br/>If you have a regular mail client, you can reply to this email by clicking below:<br/><h4><a style='color: #FFF;' class='btn btn-success' onclick='hideComposer(event);' href=\"" + link + "\">Reply via Mail Client</a></h4>"
        }
    } else {
        alert("I don't know which list to send an email to, sorry :(")
    }
}


/******************************************
 Fetched from dev/ponymail_datepicker.js
******************************************/



var datepicker_spawner = null
var calendarpicker_spawner = null
var units = {
    w: 'week',
    d: 'day',
    M: 'month',
    y: 'year'
}

// makeSelect: Creates a <select> object with options
function makeSelect(options, id, selval) {
    var sel = document.createElement('select')
    sel.setAttribute("name", id)
    sel.setAttribute("id", id)
    // For each options element, create it in the DOM
    for (var key in options) {
        var opt = document.createElement('option')
        // Hash or array?
        if (typeof key == "string") {
            opt.setAttribute("value", key)
            // Option is selected by default?
            if (key == selval) {
                opt.setAttribute("selected", "selected")
            }
        } else {
            // Option is selected by default?
            if (options[key] == selval) {
                opt.setAttribute("selected", "selected")
            }
        }
        opt.text = options[key]
        sel.appendChild(opt)
    }
    return sel
}

// splitDiv: Makes a split div with 2 elements,
// and puts div2 into the right column,
// and 'name' as text in the left one.
function splitDiv(id, name, div2) {
    var div = document.createElement('div')
    var subdiv = document.createElement('div')
    var radio = document.createElement('input')
    radio.setAttribute("type", "radio")
    radio.setAttribute("name", "datepicker_radio")
    radio.setAttribute("value", name)
    radio.setAttribute("id", "datepicker_radio_" + id)
    radio.setAttribute("onclick", "calcTimespan('"+ id + "')")
    var label = document.createElement('label')
    label.innerHTML = "&nbsp; " + name + ": "
    label.setAttribute("for", "datepicker_radio_" + id)
    
    
    subdiv.appendChild(radio)
    subdiv.appendChild(label)
    
    
    subdiv.style.float = "left"
    div2.style.float = "left"
    
    subdiv.style.width = "120px"
    subdiv.style.height = "48px"
    div2.style.height = "48px"
    div2.style.width = "250px"
    
    div.appendChild(subdiv)
    div.appendChild(div2)
    return div
}

// calcTimespan: Calculates the value and representational text
// for the datepicker choice and puts it in the datepicker's
// spawning input/select element.
function calcTimespan(what) {
    var wat = ""
    var tval = ""
    
    // Less than N units ago?
    if (what == 'lt') {
        // Get unit and how many units
        var N = document.getElementById('datepicker_lti').value
        var unit = document.getElementById('datepicker_lts').value
        var unitt = units[unit]
        if (parseInt(N) != 1) {
            unitt += "s"
        }
        
        // If this makes sense, construct a humanly readable and a computer version
        // of the timespan
        if (N.length > 0) {
            wat = "Less than " + N + " " + unitt + " ago"
            tval = "lte=" + N + unit
        }
    }
    
    // More than N units ago?
    if (what == 'mt') {
        // As above, get unit and no of units.
        var N = document.getElementById('datepicker_mti').value
        var unit = document.getElementById('datepicker_mts').value
        var unitt = units[unit]
        if (parseInt(N) != 1) {
            unitt += "s"
        }
        
        // construct timespan val + description
        if (N.length > 0) {
            wat = "More than " + N + " " + unitt + " ago"
            tval = "gte=" + N + unit
        }
    }
    
    // Date range?
    if (what == 'cd') {
        // Get From and To values
        var f = document.getElementById('datepicker_cfrom').value
        var t = document.getElementById('datepicker_cto').value
        // construct timespan val + description if both from and to are valid
        if (f.length > 0 && t.length > 0) {
            wat = "From " + f + " to " + t
            tval = "dfr=" + f + "|dto=" + t
        }
    }
    
    // If we calc'ed a value and spawner exists, update its key/val
    if (datepicker_spawner && what && wat.length > 0) {
        document.getElementById('datepicker_radio_' + what).checked = true
        if (datepicker_spawner.options) {
            datepicker_spawner.options[0].value = tval
            datepicker_spawner.options[0].text = wat
        } else if (datepicker_spawner.value) {
            datepicker_spawner.value = wat
            datepicker_spawner.setAttribute("data", tval)
        }
        
    }
}

// datePicker: spawns a date picker with various
// timespan options right next to the parent caller.
function datePicker(parent, seedPeriod) {
    datepicker_spawner = parent
    var div = document.getElementById('datepicker_popup')
    
    // If the datepicker object doesn't exist, spawn it
    if (!div) {
        div = document.createElement('div')
        var id = parseInt(Math.random() * 10000).toString(16)
        div.setAttribute("id", "datepicker_popup")
        div.setAttribute("class", "datepicker")
    }
    
    // Reset the contents of the datepicker object
    div.innerHTML = ""
    div.style.display = "block"
    
    // Position the datepicker next to whatever called it
    var bb = parent.getBoundingClientRect()
    div.style.top = (bb.bottom + 8) + "px"
    div.style.left = (bb.left + 32) + "px"
    
    
    // -- Less than N $units ago
    var ltdiv = document.createElement('div')
    var lti = document.createElement('input')
    lti.setAttribute("id", "datepicker_lti")
    lti.style.width = "48px"
    lti.setAttribute("onkeyup", "calcTimespan('lt')")
    lti.setAttribute("onblur", "calcTimespan('lt')")
    ltdiv.appendChild(lti)
    
    var lts = makeSelect({
        'd': "Day(s)",
        'w': 'Week(s)',
        'M': "Month(s)",
        'y': "Year(s)"
    }, 'datepicker_lts', 'm')
    lts.setAttribute("onchange", "calcTimespan('lt')")
    ltdiv.appendChild(lts)
    ltdiv.appendChild(document.createTextNode(' ago'))
    
    div.appendChild(splitDiv('lt', 'Less than', ltdiv))
    
    
    // -- More than N $units ago
    var mtdiv = document.createElement('div')
    
    var mti = document.createElement('input')
    mti.style.width = "48px"
    mti.setAttribute("id", "datepicker_mti")
    mti.setAttribute("onkeyup", "calcTimespan('mt')")
    mti.setAttribute("onblur", "calcTimespan('mt')")
    mtdiv.appendChild(mti)
    
    
    var mts = makeSelect({
        'd': "Day(s)",
        'w': 'Week(s)',
        'M': "Month(s)",
        'y': "Year(s)"
    }, 'datepicker_mts', 'm')
    mtdiv.appendChild(mts)
    mts.setAttribute("onchange", "calcTimespan('mt')")
    mtdiv.appendChild(document.createTextNode(' ago'))
    div.appendChild(splitDiv('mt', 'More than', mtdiv))
    
    
    
    // -- Calendar timespan
    // This is just two text fields, the calendarPicker sub-plugin populates them
    var cdiv = document.createElement('div')
    
    var cfrom = document.createElement('input')
    cfrom.style.width = "90px"
    cfrom.setAttribute("id", "datepicker_cfrom")
    cfrom.setAttribute("onfocus", "showCalendarPicker(this)")
    cfrom.setAttribute("onchange", "calcTimespan('cd')")
    cdiv.appendChild(document.createTextNode('From: '))
    cdiv.appendChild(cfrom)
    
    var cto = document.createElement('input')
    cto.style.width = "90px"
    cto.setAttribute("id", "datepicker_cto")
    cto.setAttribute("onfocus", "showCalendarPicker(this)")
    cto.setAttribute("onchange", "calcTimespan('cd')")
    cdiv.appendChild(document.createTextNode('To: '))
    cdiv.appendChild(cto)
    
    div.appendChild(splitDiv('cd', 'Date range', cdiv))
    
    
    
    // -- Magic button that sends the timespan back to the caller
    var okay = document.createElement('input')
    okay.setAttribute("type", "button")
    okay.setAttribute("value", "Okay")
    okay.setAttribute("onclick", "setDatepickerDate()")
    div.appendChild(okay)
    parent.parentNode.appendChild(div)
    document.body.setAttribute("onclick", "")
    window.setTimeout(function() { document.body.setAttribute("onclick", "blurDatePicker(event)") }, 200)
    lti.focus()
    
    // This is for recalcing the set options if spawned from a
    // select/input box with an existing value derived from an
    // earlier call to datePicker
    var ptype = ""
    var pvalue = parent.hasAttribute("data") ? parent.getAttribute("data") : parent.value
    if (pvalue.search(/=|-/) != -1) {
        
        // Less than N units ago?
        if (pvalue.match(/lte/)) {
            var m = pvalue.match(/lte=(\d+)([dMyw])/)
            ptype = 'lt'
            if (m) {
                document.getElementById('datepicker_lti').value = m[1]
                var sel = document.getElementById('datepicker_lts')
                for (var i in sel.options) {
                    if (sel.options[i].value == m[2]) {
                        sel.options[i].selected = "selected"
                    } else {
                        sel.options[i].selected = null
                    }
                }
            }
            
        }
        
        // More than N units ago?
        if (pvalue.match(/gte/)) {
            ptype = 'mt'
            var m = pvalue.match(/gte=(\d+)([dMyw])/)
            if (m) {
                document.getElementById('datepicker_mti').value = m[1]
                var sel = document.getElementById('datepicker_mts')
                // Go through the unit values, select the one we use
                for (var i in sel.options) {
                    if (sel.options[i].value == m[2]) {
                        sel.options[i].selected = "selected"
                    } else {
                        sel.options[i].selected = null
                    }
                }
            }
        }
        
        // Date range?
        if (pvalue.match(/dfr/)) {
            ptype = 'cd'
            // Make sure we have both a dfr and a dto here, catch them
            var mf = pvalue.match(/dfr=(\d+-\d+-\d+)/)
            var mt = pvalue.match(/dto=(\d+-\d+-\d+)/)
            if (mf && mt) {
                // easy peasy, just set two text fields!
                document.getElementById('datepicker_cfrom').value = mf[1]
                document.getElementById('datepicker_cto').value = mt[1]
            }
        }
        // Month??
        if (pvalue.match(/(\d{4})-(\d+)/)) {
            ptype = 'cd'
            // Make sure we have both a dfr and a dto here, catch them
            var m = pvalue.match(/(\d{4})-(\d+)/)
            if (m.length == 3) {
                // easy peasy, just set two text fields!
                var dfrom = new Date(parseInt(m[1]),parseInt(m[2])-1,1, 0, 0, 0)
                var dto = new Date(parseInt(m[1]),parseInt(m[2]),0, 23, 59, 59)
                document.getElementById('datepicker_cfrom').value = m[0] + "-" + dfrom.getDate()
                document.getElementById('datepicker_cto').value = m[0] + "-" + dto.getDate()
            }
        }
        calcTimespan(ptype)
    }
}


function datePickerValue(seedPeriod) {
    // This is for recalcing the set options if spawned from a
    // select/input box with an existing value derived from an
    // earlier call to datePicker
    var ptype = ""
    var rv = seedPeriod
    if (seedPeriod && seedPeriod.search && seedPeriod.search(/=|-/) != -1) {
        
        // Less than N units ago?
        if (seedPeriod.match(/lte/)) {
            var m = seedPeriod.match(/lte=(\d+)([dMyw])/)
            ptype = 'lt'
            var unitt = units[m[2]]
            if (parseInt(m[1]) != 1) {
                unitt += "s"
            }
            rv = "Less than " + m[1] + " " + unitt + " ago"
        }
        
        // More than N units ago?
        if (seedPeriod.match(/gte/)) {
            ptype = 'mt'
            var m = seedPeriod.match(/gte=(\d+)([dMyw])/)
            var unitt = units[m[2]]
            if (parseInt(m[1]) != 1) {
                unitt += "s"
            }
            rv = "More than " + m[1] + " " + unitt + " ago"
        }
        
        // Date range?
        if (seedPeriod.match(/dfr/)) {
            ptype = 'cd'
            var mf = seedPeriod.match(/dfr=(\d+-\d+-\d+)/)
            var mt = seedPeriod.match(/dto=(\d+-\d+-\d+)/)
            if (mf && mt) {
                rv = "From " + mf[1] + " to " + mt[1]
            }
        }
        
        // Month??
        if (seedPeriod.match(/^(\d+)-(\d+)$/)) {
            ptype = 'mr' // just a made up thing...(month range)
            var mr = seedPeriod.match(/(\d+)-(\d+)/)
            if (mr) {
                dfrom = new Date(parseInt(mr[1]),parseInt(mr[2])-1,1, 0, 0, 0)
                rv = months[dfrom.getMonth()] + ', ' + mr[1]
            }
        }
        
    }
    return rv
}

function datePickerDouble(seedPeriod) {
    // This basically takes a date-arg and doubles it backwards
    // so >=3M becomes =>6M etc. Also returns the cutoff for
    // the original date and the span in days of the original
    var ptype = ""
    var rv = seedPeriod
    var dbl = seedPeriod
    var tspan = 1
    var dfrom = new Date()
    var dto = new Date()
    
    // datepicker range?
    if (seedPeriod && seedPeriod.search && seedPeriod.search(/=/) != -1) {
        
        // Less than N units ago?
        if (seedPeriod.match(/lte/)) {
            var m = seedPeriod.match(/lte=(\d+)([dMyw])/)
            ptype = 'lt'
            rv = "<" + m[1] + m[2] + " ago"
            dbl = "lte=" + (parseInt(m[1])*2) + m[2]
            
            // N months ago
            if (m[2] == "M") {
                dfrom.setMonth(dfrom.getMonth()-parseInt(m[1]), dfrom.getDate())
            }
            
            // N days ago
            if (m[2] == "d") {
                dfrom.setDate(dfrom.getDate()-parseInt(m[1]))
            }
            
            // N years ago
            if (m[2] == "y") {
                dfrom.setYear(dfrom.getFullYear()-parseInt(m[1]))
            }
            
            // N weeks ago
            if (m[2] == "w") {
                dfrom.setDate(dfrom.getDate()-(parseInt(m[1])*7))
            }
            
            // Calc total duration in days for this time span
            tspan = parseInt((dto.getTime() - dfrom.getTime() + 5000) / (1000*86400))
        }
        
        // More than N units ago?
        if (seedPeriod.match(/gte/)) {
            ptype = 'mt'
            var m = seedPeriod.match(/gte=(\d+)([dMyw])/)
            rv = ">" + m[1] + m[2] + " ago"
            dbl = "gte=" + (parseInt(m[1])*2) + m[2]
            tspan = parseInt(parseInt(m[1]) * 30.4)
            dfrom = null
            
            // Months
            if (m[2] == "M") {
                dto.setMonth(dto.getMonth()-parseInt(m[1]), dto.getDate())
            }
            
            // Days
            if (m[2] == "d") {
                dto.setDate(dto.getDate()-parseInt(m[1]))
            }
            
            // Years
            if (m[2] == "y") {
                dto.setYear(dto.getFullYear()-parseInt(m[1]))
            }
            
            // Weeks
            if (m[2] == "w") {
                dto.setDate(dto.getDate()-(parseInt(m[1])*7))
            }
            
            // Can't really figure out a timespan for this, so...null!
            // This also sort of invalidates use on the trend page, but meh..
            tspan = null
        }
        
        // Date range?
        if (seedPeriod.match(/dfr/)) {
            ptype = 'cd'
            // Find from and to
            var mf = seedPeriod.match(/dfr=(\d+)-(\d+)-(\d+)/)
            var mt = seedPeriod.match(/dto=(\d+)-(\d+)-(\d+)/)
            if (mf && mt) {
                rv = "from " + mf[1] + " to " + mt[1]
                // Starts at 00:00:00 on from date
                dfrom = new Date(parseInt(mf[1]),parseInt(mf[2])-1,parseInt(mf[3]), 0, 0, 0)
                
                // Ends at 23:59:59 on to date
                dto = new Date(parseInt(mt[1]),parseInt(mt[2])-1,parseInt(mt[3]), 23, 59, 59)
                
                // Get duration in days, add 5 seconds to we can floor the value and get an integer
                tspan = parseInt((dto.getTime() - dfrom.getTime() + 5000) / (1000*86400))
                
                // double the distance
                var dpast = new Date(dfrom)
                dpast.setDate(dpast.getDate() - tspan)
                dbl = seedPeriod.replace(/dfr=[^|]+/, "dfr=" + (dpast.getFullYear()) + '-' + (dpast.getMonth()+1) + '-' + dpast.getDate())
            } else {
                tspan = 0
            }
        }
    }
    
    // just N days?
    else if (parseInt(seedPeriod).toString() == seedPeriod.toString()) {
        tspan = parseInt(seedPeriod)
        dfrom.setDate(dfrom.getDate() - tspan)
        dbl = "lte=" + (tspan*2) + "d"
    }
    
    // Specific month?
    else if (seedPeriod.match(/^(\d+)-(\d+)$/)) {
        ptype = 'mr' // just a made up thing...(month range)
        var mr = seedPeriod.match(/(\d+)-(\d+)/)
        if (mr) {
            rv = seedPeriod
            // Same as before, start at 00:00:00
            dfrom = new Date(parseInt(mr[1]),parseInt(mr[2])-1,1, 0, 0, 0)
            // end at 23:59:59
            dto = new Date(parseInt(mr[1]),parseInt(mr[2]),0, 23, 59, 59)
            
            // B-A, add 5 seconds so we can floor the no. of days into an integer neatly
            tspan = parseInt((dto.getTime() - dfrom.getTime() + 5000) / (1000*86400))
            
            // Double timespan
            var dpast = new Date(dfrom)
            dpast.setDate(dpast.getDate() - tspan)
            dbl = "dfr=" + (dpast.getFullYear()) + '-' + (dpast.getMonth()+1) + '-' + dpast.getDate() + "|dto=" + (dto.getFullYear()) + '-' + (dto.getMonth()+1) + '-' + dto.getDate()
        } else {
            tspan = 0
        }
    }
    
    return [dbl, dfrom, dto, tspan]
}

// set date in caller and hide datepicker again.
function setDatepickerDate() {
    calcTimespan()
    blurDatePicker()
}

// findParent: traverse DOM and see if we can find a parent to 'el'
// called 'name'. This is used for figuring out whether 'el' has
// lost focus or not.
function findParent(el, name) {
    if (el.getAttribute && el.getAttribute("id") == name) {
        return true
    }
    if (el.parentNode && el.parentNode.getAttribute) {
        if (el.parentNode.getAttribute("id") != name) {
            return findParent(el.parentNode, name)
        } else {
            return true
        }
    } else {
        return false;
    }
}

// function for hiding the date picker
function blurDatePicker(evt) {
    var es = evt ? (evt.target || evt.srcElement) : null;
    if ((!es || !es.parentNode || (!findParent(es, "datepicker_popup") && !findParent(es, "calendarpicker_popup"))) && !(es ? es : "null").toString().match(/javascript:void/)) {
        document.getElementById('datepicker_popup').style.display = "none"
    }
}

// draws the actual calendar inside a calendarPicker object
function drawCalendarPicker(obj, date) {
    obj.focus()
    
    // Default to NOW for calendar.
    var now = new Date()
    
    // if called with an existing date (YYYY-MM-DD),
    // convert it to a JS date object and use that for
    // rendering the calendar
    if (date) {
        var ar = date.split(/-/)
        now = new Date(ar[0],parseInt(ar[1])-1,ar[2])
    }
    var days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    var mat = now
    
    // Go to first day of the month
    mat.setDate(1)
    
    obj.innerHTML = "<h3>" + months[mat.getMonth()] + ", " + mat.getFullYear() + ":</h3>"
    var tm = mat.getMonth()
    
    // -- Nav buttons --
    
    // back-a-year button
    var a = document.createElement('a')
    a.setAttribute("onclick", "drawCalendarPicker(this.parentNode, '" + (mat.getFullYear()-1) + '-' + (mat.getMonth()+1) + '-' + mat.getDate() + "');")
    a.setAttribute("href", "javascript:void(0);")
    a.innerHTML = "≪"
    obj.appendChild(a)
    
    // back-a-month button
    a = document.createElement('a')
    a.setAttribute("onclick", "drawCalendarPicker(this.parentNode, '" + mat.getFullYear() + '-' + (mat.getMonth()) + '-' + mat.getDate() + "');")
    a.setAttribute("href", "javascript:void(0);")
    a.innerHTML = "&lt;"
    obj.appendChild(a)
    
    // forward-a-month button
    a = document.createElement('a')
    a.setAttribute("onclick", "drawCalendarPicker(this.parentNode, '" + mat.getFullYear() + '-' + (mat.getMonth()+2) + '-' + mat.getDate() + "');")
    a.setAttribute("href", "javascript:void(0);")
    a.innerHTML = "&gt;"
    obj.appendChild(a)
    
    // forward-a-year button
    a = document.createElement('a')
    a.setAttribute("onclick", "drawCalendarPicker(this.parentNode, '" + (mat.getFullYear()+1) + '-' + (mat.getMonth()+1) + '-' + mat.getDate() + "');")
    a.setAttribute("href", "javascript:void(0);")
    a.innerHTML = "≫"
    obj.appendChild(a)
    obj.appendChild(document.createElement('br'))
    
    
    // Table containing the dates of the selected month
    var table = document.createElement('table')
    
    table.setAttribute("border", "1")
    table.style.margin = "0 auto"
    
    // Add header day names
    var tr = document.createElement('tr');
    for (var m in days) {
        var td = document.createElement('th')
        td.innerHTML = days[m]
        tr.appendChild(td)
    }
    table.appendChild(tr)
    
    // Until we hit the first day in a month, add blank days
    tr = document.createElement('tr');
    var weekday = mat.getDay()
    if (weekday == 0) {
        weekday = 7
    }
    weekday--;
    for (var i = 0; i < weekday; i++) {
        var td = document.createElement('td')
        tr.appendChild(td)
    }
    
    // While still in this month, add day then increment date by 1 day.
    while (mat.getMonth() == tm) {
        weekday = mat.getDay()
        if (weekday == 0) {
            weekday = 7
        }
        weekday--;
        if (weekday == 0) {
            table.appendChild(tr)
            tr = document.createElement('tr');
        }
        td = document.createElement('td')
        // onclick for setting the calendarPicker's parent to this val.
        td.setAttribute("onclick", "setCalendarDate('" + mat.getFullYear() + '-' + (mat.getMonth()+1) + '-' + mat.getDate() + "');")
        td.innerHTML = mat.getDate()
        mat.setDate(mat.getDate()+1)
        tr.appendChild(td)
    }
    
    table.appendChild(tr)
    obj.appendChild(table)
}

// callback for datePicker; sets the cd value to what date was picked
function setCalendarDate(what) {
    calendarpicker_spawner.value = what
    var div = document.getElementById('calendarpicker_popup')
    div.parentNode.focus()
    div.style.display = "none"
    calcTimespan('cd')
}

// caller for when someone clicks on a calendarPicker enabled field
function showCalendarPicker(parent, seedDate) {
    calendarpicker_spawner = parent
    
    // If supplied with a YYYY-MM-DD date, use this to seed the calendar
    if (!seedDate) {
        var m = parent.value.match(/(\d+-\d+(-\d+)?)/)
        if (m) {
            seedDate = m[1]
        }
    }
    
    // Show or create the calendar object
    var div = document.getElementById('calendarpicker_popup')
    if (!div) {
        div = document.createElement('div')
        div.setAttribute("id", "calendarpicker_popup")
        div.setAttribute("class", "calendarpicker")
        document.getElementById('datepicker_popup').appendChild(div)
        div.innerHTML = "Calendar goes here..."
    }
    div.style.display = "block"
    var bb = parent.getBoundingClientRect()
    
    // Align with the calling object, slightly below
    div.style.top = (bb.bottom + 8) + "px"
    div.style.left = (bb.right - 32) + "px"
    
    drawCalendarPicker(div, seedDate)    
}

/******************************************
 Fetched from dev/ponymail_dom_helpers.js
******************************************/




// traverseThread: finds all child divs inside an object
function traverseThread(child, name, type) {
    if (!child) {
        return
    }
    // Default to looking for DIV types if nothing else is specified
    // but we'll happily look for any type...really!
    type = type ? type : 'DIV'
    
    // for each child in this object...
    for (var i in child.childNodes) {
        // Matching type?
        if (child.childNodes[i].nodeType && child.childNodes[i].nodeType == 1 && child.childNodes[i].nodeName == type) {
            // Right ID? Or are we maybe just looking for ANY object of this type?
            if (!name || (child.childNodes[i].getAttribute("id") && child.childNodes[i].getAttribute("id").search(name) != -1)) {
                // Found one! append to the big result list in the sky
                kiddos.push(child.childNodes[i])
            }
        }
        // Does this object have children? If so, let's traverse those as well
        if (child.childNodes[i].nodeType && child.childNodes[i].hasChildNodes()) {
            traverseThread(child.childNodes[i], name, type)
        }
    }

}


// toggleView: show/hide a DOM object
function toggleView(el) {
    var obj = document.getElementById(el)
    if (obj) {
        // assuming display is either 'none' or 'block', we simply reverse it.
        obj.style.display = (obj.style.display == 'none') ? 'block' : 'none'
    }
}



// sortByDate: reshuffle a threaded display into a flat display, sorted by date
function sortByDate(tid) {
    kiddos = []
    var t = document.getElementById("thread_" + tid)
    var h = document.getElementById("helper_" + tid)
    if (t) {
        // fetch all elements called 'thread*' inside t
        traverseThread(t, 'thread')
        
        // sort the node array:
        // forward
        if (prefs.sortOrder == 'forward') {
            kiddos.sort(function(a, b) {
                return parseInt(b.getAttribute('epoch') - a.getAttribute('epoch'));
            })
        // backward
        } else {
            kiddos.sort(function(a, b) {
                return parseInt(a.getAttribute('epoch') - b.getAttribute('epoch'));
            })
        }
        
        // do some DOM magic, repositioning according to sort order
        for (var i in kiddos) {
            t.insertBefore(kiddos[i], t.firstChild)
        }
    }
}


// generateFormDivs: helper func for making form elements
function generateFormDivs(id, title, type, options, selval) {
    
    // Make a parent div that holds the title and input field
    var mf = document.createElement('div')
    mf.setAttribute('id', "main_form_" + id)
    mf.style.margin = "10px"
    mf.style.padding = "10px"
    
    // title div to the left
    var td = document.createElement('div')
    td.style.width = "300px"
    td.style.float = "left"
    td.style.fontWeight = "bold"
    td.appendChild(document.createTextNode(title))
    mf.appendChild(td)
    
    // input field to the right
    var td2 = document.createElement('div')
    td2.style.width = "200px"
    td2.style.float = "left"
    
    // <select> object?
    if (type == 'select') {
        var sel = document.createElement('select')
        sel.setAttribute("name", id)
        sel.setAttribute("id", id)
        // add all options as <option> elements
        for (var key in options) {
            var opt = document.createElement('option')
            // array?
            if (typeof key == "string") {
                opt.setAttribute("value", key)
                if (key == selval) {
                    opt.setAttribute("selected", "selected")
                }
            // hash?
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
    // (unknown?) <input> element
    if (type == 'input') {
        var inp = document.createElement('input')
        inp.setAttribute("name", id)
        inp.setAttribute("id", id)
        inp.setAttribute("value", options)
        td2.appendChild(inp)
    }
    // <input type='text'> element
    if (type == 'text') {
        var inp = document.createElement('input')
        inp.setAttribute("type", "text")
        inp.setAttribute("name", id)
        inp.setAttribute("id", id)
        inp.setAttribute("value", options)
        td2.appendChild(inp)
    }
    
    // check box
    if (type == 'checkbox') {
        var inp = document.createElement('input')
        inp.setAttribute("type", "checkbox")
        inp.setAttribute("name", id)
        inp.setAttribute("id", id)
        inp.checked = options
        td2.appendChild(inp)
    }
    
    // add to parent, return parent div
    mf.appendChild(td2)
    return mf
}


// func for rolling up an email to its immediate parent, hiding emails between that
function rollup(mid) {
    var obj = document.getElementById('thread_' + mid)
    if (obj) {
        // changes var makes sure we only change the rollup icon if changes occured,
        // that is to say, if the page actually changed its looks (hid/showed emails).
        var changes = 0
        
        // default to the downwards facing icon, that's the target icon mostly
        var glyph = "down"
        var parent = obj.parentNode
        // for each email in this specific sub-thread...
        for (var i in parent.childNodes) {
            var node = parent.childNodes[i]
            if (node.nodeType && node.nodeType == 1 && node.nodeName == 'DIV') {
                // if we've reached the current email, we'll stop.
                // we only want to hide emails _before_ that.
                if (node.getAttribute && node.getAttribute("id") && node.getAttribute("id").search(mid) != -1) {
                    break
                // otherwise, if valid email or div or whatever, HIDE IT!..or show it, depending.
                } else if (node.getAttribute("id")) {
                    // reverse opacity
                    node.style.display = (node.style.display == "none") ? "block" : "none"
                    glyph = (node.style.display == "none") ? "down" : "up"
                    changes++ // mark that we've made a visible change here
                }
            }
        }
        // Did we process changes to the DOM? If so, change the glyph
        if (changes > 0) {
            var robj = document.getElementById('rollup_' + mid)
            robj.setAttribute("class", "glyphicon glyphicon-chevron-" + glyph)
        }
        
    }
}

// Check the entire DOM tree for elements with 'epoch' key set to this epoch.
function findEpoch(epoch) {
    kiddos = []
    traverseThread(document.body)
    for (var i in kiddos) {
        if (kiddos[i].hasAttribute('epoch') && parseInt(kiddos[i].getAttribute('epoch')) == epoch) {
            return kiddos[i]
        }
    }
    return null
}

// Pop-up message display thingy. Used for saying "email sent...I think!"
function popup(title, body, timeout) {
    var obj = document.getElementById('popupper')
    if (obj) {
        obj.innerHTML = ""
        obj.style.display = 'block'
        obj.innerHTML = "<h3>" + title + "</h3><p>" + body + "</p><p><a class='btn btn-success' href='javascript:void(0);' onclick='toggleView(\"popupper\")'>Got it!</a></p>"
        // hide popupper after N seconds, giving people enough time to read it.
        window.setTimeout(function() {
            document.getElementById('popupper').style.display = 'none'
            }, (timeout ? timeout : 5) * 1000)
    }
}

/******************************************
 Fetched from dev/ponymail_email_displays.js
******************************************/


// displayEmail: Shows an email inside a thread
function displayEmail(json, id, level) {
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
    saved_emails[json.mid] = json
    var estyle = ""
    
    // color based on view before or not??
    if (typeof(window.localStorage) !== "undefined") {
        if (! window.localStorage.getItem("viewed_" + json.mid) ){
            //estyle = "linear-gradient(to bottom, rgba(252,255,244,1) 0%,rgba(233,233,206,1) 100%)"
            window.localStorage.setItem("viewed_" + json.mid, json.epoch)
        }
        if (window.localStorage.getItem("viewed_" + json.mid).search("!") == 10){
            //estyle = "linear-gradient(to bottom, rgba(252,255,244,1) 0%,rgba(233,233,206,1) 100%)"
            var epoch = parseInt(window.localStorage.getItem("viewed_" + json.mid))
            window.localStorage.setItem("viewed_" + json.mid, epoch + ":")
        }
    }
    var cols = ['primary', 'success', 'info', 'warning', 'danger']
    var id_sanitised = id.toString().replace(/@<.+>/, "")
    var thread = document.getElementById('thread_' + id_sanitised)
    if (thread) {
        json.date = formatDate(new Date(json.epoch*1000))
        var lid = json.list.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
        var ebody = json.body
        ebody = ebody.replace(/</mg, "&lt;")
        ebody = "\n" + ebody
        if (prefs.compactQuotes == 'yes') {
            ebody = ebody.replace(/((?:\r?\n)((on .+ wrote:[\r\n]+)|(sent from my .+)|(>+[ \t]*[^\r\n]*\r?\n[^\n]*\n*)+)+)+/mgi, function(inner) {
                var rnd = (Math.random() * 100).toString()
                inner = inner.replace(/>/g, "&gt;")
                var html = "<div class='bs-callout bs-callout-default' style='margin: 3px; padding: 2px;' id='parent_" + rnd + "'>" +
                    "<img src='/images/quote.png' title='show/hide original text' onclick='toggleView(\"quote_" + rnd + "\")'/><br/>" +
                    "<div style='display: none;' id='quote_" + rnd + "'>" + inner + "</div></div>"
                return html
            })
        }
        ebody = ebody.replace(re_weburl, "<a href='$1'>$1</a>")
        
        if (typeof(window.localStorage) !== "undefined") {
            var th = window.localStorage.getItem("pm_theme")
            if (th) {
                prefs.theme = th
            }
        }
        if (prefs.theme && prefs.theme == "social") {
            var sdate = new Date(json.epoch*1000).toLocaleString('en-US',  { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' })
            var fr = json['from'].replace(/"/g, "").replace(/<.+>/, "").replace(/</g, "&lt;")
            thread.style.background = estyle
            
            // Don't indent if we're too deeply nested, it gets weird
            if (level <= 6) {
                thread.style.marginLeft = "40px"
            }
            
            thread.style.marginTop = "20px"
            thread.innerHTML = "<img src='https://secure.gravatar.com/avatar/" + json['gravatar'] + ".jpg?s=48&r=g&d=mm' style='vertical-align:middle'/> &nbsp; <b>" + fr + "</b> - " + sdate
            thread.innerHTML += ' &nbsp; <label class="label label-success" onclick="compose(\'' + json.mid + '\');" style="cursor: pointer; float: right; margin-left: 10px;">Reply</label>'
            if (level > 1) {
                thread.innerHTML += ' &nbsp; <a href="javascript:void(0);" onclick="rollup(\'' + id_sanitised + '\');"><label class="label label-primary" title="roll up" style="cursor: pointer; float: right; margin-right: 10px;"><span id="rollup_' + id_sanitised + '" class="glyphicon glyphicon-chevron-up"> </span></label></a> &nbsp; '
            }
            thread.innerHTML += "<br/><br/>"
            var bclass = "bubble-" + cols[parseInt(Math.random() * cols.length - 0.01)]
            thread.innerHTML += "<div class='" + bclass + "' style='padding: 8px; font-family: Hack; word-wrap: normal; white-space: pre-line; word-break: normal;'>" + ebody + '</div>'
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
            if (thread.hasAttribute("meme")) {
                thread.scrollIntoView()
                thread.style.background = "rgba(200,200,255, 0.25)"
            }
        }
        else {
            thread.setAttribute("class", "reply bs-callout bs-callout-" + cols[parseInt(Math.random() * cols.length - 0.01)])
            thread.style.background = estyle
            thread.innerHTML = ''
            thread.innerHTML += ' &nbsp; <label class="label label-success" onclick="compose(\'' + json.mid + '\');" style="cursor: pointer; float: right; margin-left: 10px;">Reply</label>'
            thread.innerHTML += ' &nbsp; <a href="/thread.html/'+(pm_config.shortLinks ? shortenID(json.mid) : json.mid)+'"><label class="label label-warning" style="cursor: pointer; float: right;">Permalink</label></a>'
            thread.innerHTML += ' &nbsp; <a href="/api/source.lua/'+json.mid+'"><label class="label label-danger" style="cursor: pointer; float: right; margin-right: 10px;">View Source</label></a> &nbsp; '
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
            }
            
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
            
               
            thread.innerHTML += "<pre style='color: inherit; padding: 8px; font-family: Hack; word-wrap: normal; white-space: pre-line; word-break: normal;'>" + ebody + '</pre>'
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
    var level = state.level ? state.level : 1
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
        displayEmail(json, (json.tid ? json.tid : json.mid), level)
        if (state.child && state.child.children && state.child.children.length > 0) {
            getChildren(state.main, state.child, level)
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
            if (current_thread_json[id]) {
                var xx = window.localStorage.getItem("viewed_" + current_thread_json[id].tid)
                if (xx) {
                    var yy = parseInt(xx)
                    if (yy >= parseInt(latestEmailInThread)) {
                        epoch = yy
                    }
                }
                window.localStorage.setItem("viewed_" + current_thread_json[id].tid, epoch)
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

// func for highlighting emails that have shown up during a recent page build, that we haven't
// actually viewed before.
function highlightNewEmails(id) {
    // This currently requires localStorage to store the view data
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
                    window.localStorage.setItem("first_view_" + mid, pb_refresh)
                    kiddos[i].style.color = "#000"
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
    var mid = current_thread_json[0].mid.replace(/[<>]/g, "")
    if (mid.length > 40) {
        mid = mid.substring(0,40) + "..."
    }
    // set tab title
    document.title = current_thread_json[0].subject + " - Pony Mail"
    
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


/******************************************
 Fetched from dev/ponymail_email_tools.js
******************************************/



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
function getChildren(main, email, level) {
    level = level ? level : 1
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
                    GetAsync("/api/email.lua?id=" + child.tid, {
                        main: main,
                        before: email.tid,
                        pchild: pchild,
                        child: child,
                        level: level+1
                    }, displayEmailThreaded)
                } else {
                    displayEmailThreaded(eml, {
                        main: main,
                        before: email.tid,
                        pchild: pchild,
                        child: child,
                        level: level+1
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
    GetAsync("/api/preferences.lua", {docall:["/api/thread.lua?id=" + id, displaySingleThread]}, seedPrefs)
}

Number.prototype.pad = function(size) {
    var str = String(this);
    while (str.length < size) {
        str = "0" + str;
    }
    return str;
}


function formatDate(date){
    return (date.getFullYear() + "-" +
        (date.getMonth()+1).pad(2) + "-" +
        date.getDate().pad(2) + " " +
        date.getHours().pad(2) + ":" +
        date.getMinutes().pad(2))        
}


// hex -> base 36 conversion for creating shorter permalinks
function shortenID(mid) {
    var id1 = parseInt(mid.substr(0,9), 16).toString(36)
    
    // add padding if < 7 chars long
    while (id1.length < 7) id1 = '-' + id1
    var id2 = parseInt(mid.substr(9,9), 16).toString(36)
    while (id2.length < 7) id2 = '-' + id2
    
    // add 'Z' which is the short link denoter
    return 'Z' + id1 + id2
}

// hex <- base 36 conversion, reverses short links
function unshortenID(mid) {
    // all short links begin with 'Z'. If not, it's not a short link
    // so let's just pass it through unaltered if so.
    // Some old shortlinks begin with 'B', so let's be backwards compatible for now.
    if (mid[0] == 'Z' || mid[0] == 'B') {
        // remove padding
        var id1 = parseInt(mid.substr(1, 7).replace(/-/g, ""), 36)
        var id2 = parseInt(mid.substr(8, 7).replace(/-/g, ""), 36)
        id1 = id1.toString(16)
        id2 = id2.toString(16)
        
        // add 0-padding
        while (id1.length < 9) id1 = '0' + id1
        while (id2.length < 9) id2 = '0' + id2
        return id1+id2
    }
    return mid
}



/******************************************
 Fetched from dev/ponymail_helperfuncs.js
******************************************/



// checkForSlows: Checks if there is a pending async URL fetching
// that is delayed for more than 2.5 seconds. If found, display the
// spinner, thus letting the user know that the resource is pending.
function checkForSlows() {
    var slows = 0
    var now = new Date().getTime() / 1000;
    for (var x in pending_urls) {
        if ((now - pending_urls[x]) > 2.5) {
            slows++;
            break
        }
    }
    if (slows == 0) {
        showSpinner(false)
    } else {
        showSpinner(true);
    }
}

// GetAsync: func for getting a doc async with a callback
var visited_urls = {}
var cached_urls = {}

function GetAsync(theUrl, xstate, callback) {
    var xmlHttp = null;
    if (window.XMLHttpRequest) {
        xmlHttp = new XMLHttpRequest();
    } else {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    if (pending_urls) {
        pending_urls[theUrl] = new Date().getTime() / 1000;
    }
    var finalURL = theUrl
    if (visited_urls[theUrl]) {
        finalURL += ((finalURL.search(/\?/) == -1) ? '?' : '&') + 'since=' + visited_urls[theUrl]
    }
    visited_urls[theUrl] = new Date().getTime()/1000
    xmlHttp.open("GET", finalURL, true);
    xmlHttp.send(null);
    xmlHttp.onprogress = function() {
        checkForSlows()
    }
    xmlHttp.onerror = function() {
        delete pending_urls[theUrl]
        checkForSlows()
    }
    xmlHttp.onreadystatechange = function(state) {
        if (xmlHttp.readyState == 4) {
            delete pending_urls[theUrl]
        }
        checkForSlows()
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            if (callback) {
                try {
                    var response = JSON.parse(xmlHttp.responseText)
                    if (response && typeof response.changed !== 'undefined' && response.changed == false) {
                        var t = response.took
                        response = cached_urls[theUrl]
                        response.took = t
                    }
                    if (response.unixtime) {
                        visited_urls[theUrl] = response.unixtime // use server's unix time if given
                    }
                    cached_urls[theUrl] = response
                    callback(response, xstate);
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

// spinner for checkForSlows
function showSpinner(show) {
    var obj = document.getElementById('spinner')
    if (!obj) {
        obj = document.createElement('div')
        obj.setAttribute("id", "spinner")
        obj.innerHTML = "<img src='/images/spinner.gif'><br/>Loading data, please wait..."
        document.body.appendChild(obj)
    }
    if (show) {
        obj.style.display = "block"
    } else {
        obj.style.display = "none"
    }
}


// Ephemeral configuration - non-account but still saved through reloads

// Saving prefs as a json string
function saveEphemeral() {
    // This only works if the browser supports localStorage
    if (typeof(window.localStorage) !== "undefined") {
        window.localStorage.setItem("ponymail_config_ephemeral", JSON.stringify(prefs))
    }
}

// load ephemeral prefs, replace what we have
function loadEphemeral() {
    // This only works if the browser supports localStorage
    if (typeof(window.localStorage) !== "undefined") {
        var str = window.localStorage.getItem("ponymail_config_ephemeral")
        if (str) {
            var eprefs = JSON.parse(str)
            // for each original setting in config.js,
            // check if we have a different one stored
            for (i in prefs) {
                if (eprefs[i]) {
                    prefs[i] = eprefs[i] // override
                }
            }
        }
        
    }
}

function isArray(obj) {
    return (obj && obj.constructor && obj.constructor == Array)
}

// Check for slow URLs every 0.5 seconds
window.setInterval(checkForSlows, 500)

/******************************************
 Fetched from dev/ponymail_listview_flat.js
******************************************/



// loadList_flat: Load a chunk of emails as a flat (non-threaded) list
function loadList_flat(mjson, limit, start, deep) {
    if (prefs.theme && prefs.theme == "social") {
        d_ppp = 10
    } else {
        d_ppp = 15
    }
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
        mdate = formatDate(mdate)
            
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
        nest += "<li class='list-group-item'> " + at + " &nbsp; <a style='" + estyle + "' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' onclick='this.style=\"\"; loadEmails_flat(" + i + "); return false;'>" + subject + "</a> <label style='float: left; width: 140px;' class='label label-info'>" + from + "</label><label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label><div id='thread_" + i + "' style='display:none';></div></li>"
    }
    nest += "</ul>"


    var bulk = document.getElementById('emails')
    bulk.innerHTML = ""
    
    // Top nav buttons
    var tnav = "<div style='float: left; width: 100%'>"
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        tnav += '<div style="width: 50%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_flat(false, ' + 15 + ', ' + nstart + ');">Show previous 15</a> &nbsp </div>'
    } else {
        tnav += '<div style="width: 50%; float: left;">&nbsp;</div>'
    }
    
    if (json.length > (start + limit)) {
        remain = Math.min(15, json.length - (start + limit))
        tnav += '<div style="width: 50%; float: left;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_flat(false, ' + 15 + ', ' + (start + 15) + ');">Show next ' + remain + '</a></div>'
    }
    tnav += "</div><br/><br/>"
    
    
    bulk.innerHTML += tnav + nest
    if (prefs.hideStats == 'yes') {
        bulk.parentNode.setAttribute("class", "well col-md-10 col-lg-10")
    } else {
        bulk.parentNode.setAttribute("class", "well col-md-10 col-lg-7")
    }
    

    // Bottom nav buttons
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_flat(false, ' + 15 + ', ' + nstart + ');">Show previous 15</a> &nbsp </div>'
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
function loadEmails_flat(id, close, treeview) {
    var lvid = id
    if (treeview) {
        lvid = treeview
    }
    var thread = document.getElementById('thread_' + lvid)
    if (thread) {
        current_thread = lvid
        thread.style.display = (thread.style.display != 'block') ? 'block' : 'none';
        if (close == true) {
            thread.style.display = 'none'
        }
        if (thread.style.display == 'none') {
            return
        }
        if (!open_emails[lvid]) {
            open_emails[lvid] = true

        }
        var cfid
        if (treeview) {
            cfid = id
        } else {
            cfid = current_flat_json[id].id
        }
        var eml = saved_emails[cfid]
        
        if (!eml || !eml.from) {
            GetAsync("/api/email.lua?id=" + cfid, lvid, displayEmail)
        } else {
            displayEmail(eml, lvid)
        }
    } else {
        alert("no such thread ID: " + lvid)
    }
}


/******************************************
 Fetched from dev/ponymail_listview_threaded.js
******************************************/



// loadList_threaded: Same as above, but threaded display
function loadList_threaded(mjson, limit, start, deep) {
    if (typeof(window.localStorage) !== "undefined") {
        var th = window.localStorage.getItem("pm_theme")
        if (th) {
            prefs.theme = th
        }
    }
    if (prefs.theme && prefs.theme == "social") {
        d_ppp = 10
    } else {
        d_ppp = 15
    }
    open_emails = []
    limit = limit ? limit : d_ppp;
    var fjson = mjson ? ('emails' in mjson && isArray(mjson.emails) ? mjson.emails.sort(function(a, b) {
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
        
        mdate = formatDate(mdate)
        var pds = people > 1 ? "visible" : "hidden"
        
        // style based on view before or not??
        if (typeof(window.localStorage) !== "undefined") {
            if (! window.localStorage.getItem("viewed_" + eml.id) || (subs > 0 && parseInt(window.localStorage.getItem("viewed_" + eml.id)) < latest )){
                estyle = "font-weight: bold;"
            }
        }
        
        
        var people_label = "<label style='visibility:" + pds + "; float: right; margin-right: 8px; ' id='people_"+i+"' class='listview_label label label-" + lp + "'> <span class='glyphicon glyphicon-user'> </span> " + people + " <span class='hidden-xs hidden-sm'>people</span></label>"
        var subs_label = "<label id='subs_" + i + "' style='float: right; margin-right: 8px;' class='label label-" + ls + "'> <span class='glyphicon glyphicon-envelope'> </span>&nbsp;<span style='display: inline-block; width: 16px; text-align: right;'>" + subs + "</span>&nbsp;<span style='display: inline-block; width: 40px; text-align: left;' class='hidden-xs hidden-sm'>" +  (subs != 1 ? "replies" : "reply") + "</span></label>"
        
        if (prefs.theme && prefs.theme == "social") {
            var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
            from = from.replace(/\"/g, "")
            nest += "<li class='list-group-item' style='min-height: 64px; float: left; width:100%;'><div style='min-height: 64px;'><div style='width:100%; float: left; padding-left: 70px;'>" +
                    d +
                    "<a style='" + estyle + "' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' onclick='this.style=\"\"; latestEmailInThread = " +
                    latest +
                    "; toggleEmails_threaded(" + i + "); latestEmailInThread = 0; return false;'>" +
                    subject +
                    "</a> <label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" +
                    mdate +
                    "</label> &nbsp; " + subs_label + people_label +
                    "<br/>By " + from + "</div>" 
                    
                    
            nest += "<div style='width: 100%; float: left; min-height: 64px;' id='bubble_"+i+"'>" +
                    "<div style='width: 64px; float: left;'>" +
                    "<img src='https://secure.gravatar.com/avatar/" + eml.gravatar + ".jpg?s=48&r=g&d=mm'/>" +
                    "</div>" +
                    "<div class='bubble-topic' style='float: left; width:calc(100% - 70px);'>"+ json[i].body.replace(/</g, "&lt;") + "<br/>" +
                    "<a class='label label-info' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' style='font-size: 85%; padding: 2px;' onclick='latestEmailInThread = " +
                    latest +
                    "; toggleEmails_threaded(" + i + "); latestEmailInThread = 0; return false;'>Read more..</a>" +
                    "</div>" +
                    "</div>" +
                    "<div id='thread_" + i + "' style='display:none';></div></div></li>"
        } else {
            nest += "<li class='list-group-item'>" +
                    "<div style='width: calc(100% - 200px); white-space:nowrap; overflow: hidden;'>" +
                    d + "<a style='overflow:hidden;" + estyle + "' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id)  + "' onclick='this.style=\"\"; latestEmailInThread = " + latest+ "; toggleEmails_threaded(" + i + "); latestEmailInThread = 0; return false;'>" + subject +
                    "</div></a> <div style='float: right;position:absolute;right:4px;top:12px;';><a style='float: right; opacity: 0.75; margin-left: 2px; margin-top: -3px;' href='/api/atom.lua?mid=" + eml.id + "'><img src='/images/atom.png' title='Subscribe to this thread as an atom feed'/></a><label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label>" +
                    subs_label + people_label + "&nbsp; " + "</div>" + "<div id='thread_" + i + "' style='display:none';></div></li>"
        }
    }
    nest += "</ul>"


    var bulk = document.getElementById('emails')
    bulk.innerHTML = ""
    
    // Top nav buttons
    var tnav = "<div style='float: left; width: 100%; height: 50px;'>"
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        tnav += '<div style="width: 40%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_threaded(false, ' + d_ppp + ', ' + nstart + ');">Show previous '+d_ppp+'</a> &nbsp </div>'
    } else {
        tnav += '<div style="width: 40%; float: left;">&nbsp;</div>'
    }
    
    if (json.length > (start + limit)) {
        remain = Math.min(d_ppp, json.length - (start + limit))
        tnav += '<div style="width: 40%; float: right;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_threaded(false, ' + d_ppp + ', ' + (start + d_ppp) + ');">Show next ' + remain + '</a></div>'
    }
    tnav += "</div><br/><br>"
    
    // Emails
    bulk.innerHTML += tnav + nest
    if (prefs.hideStats == 'yes') {
        bulk.parentNode.setAttribute("class", "well col-md-10 col-lg-10")
    } else {
        bulk.parentNode.setAttribute("class", "well col-md-10 col-lg-7")
    }
    var dp = (deep || (global_deep && current_query.length > 0)) ? 'true' : 'false'
    
    
    // Bottom nav buttons
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_threaded(false, ' + d_ppp + ', ' + nstart + ');">Show previous '+d_ppp+'</a> &nbsp </div>'
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    
    if (login && login.credentials) {
        bulk.innerHTML += '<div style="width: 33%; float: left; text-align: center;"><a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-danger" onclick="compose(null, \'' + xlist + '\');">Start a new thread</a></div>'
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    if (json.length > (start + limit)) {
        remain = Math.min(d_ppp, json.length - (start + limit))
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


/******************************************
 Fetched from dev/ponymail_listview_tree.js
******************************************/



// loadList_treeview: Load a list as a treeview object, grouped by threads
function loadList_treeview(mjson, limit, start, deep) {
    if (typeof(window.localStorage) !== "undefined") {
        var th = window.localStorage.getItem("pm_theme")
        if (th) {
            prefs.theme = th
        }
    }
    if (prefs.theme && prefs.theme == "social") {
        d_ppp = 10
    } else {
        d_ppp = 15
    }
    open_emails = []
    limit = limit ? limit : d_ppp;
    var fjson = mjson ? ('emails' in mjson && isArray(mjson.emails) ? mjson.emails.sort(function(a, b) {
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
        
        mdate = formatDate(mdate)
        var pds = people > 1 ? "visible" : "hidden"
        
        // style based on view before or not??
        if (typeof(window.localStorage) !== "undefined") {
            if (! window.localStorage.getItem("viewed_" + eml.id) || (subs > 0 && parseInt(window.localStorage.getItem("viewed_" + eml.id)) < latest )){
                estyle = "font-weight: bold;"
            }
        }
        var people_label = "<label style='visibility:" + pds + "; float: right; margin-right: 8px; ' id='people_"+i+"' class='listview_label label label-" + lp + "'> <span class='glyphicon glyphicon-user'> </span> " + people + " <span class='hidden-xs hidden-sm'>people</span></label>"
        var subs_label = "<label id='subs_" + i + "' style='float: right; margin-right: 8px;' class='label label-" + ls + "'> <span class='glyphicon glyphicon-envelope'> </span>&nbsp;<span style='display: inline-block; width: 16px; text-align: right;'>" + subs + "</span>&nbsp;<span style='display: inline-block; width: 40px; text-align: left;' class='hidden-xs hidden-sm'>" +  (subs != 1 ? "replies" : "reply") + "</span></label>"
        
        if (prefs.theme && prefs.theme == "social") {
            var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
            from = from.replace(/\"/g, "")
            nest += "<li class='list-group-item' style='min-height: 64px; float: left; width:100%;'><div style='min-height: 64px;'><div style='width:100%; float: left; padding-left: 70px;'>" +
                    d +
                    "<a style='" + estyle + "' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' onclick='this.style=\"\"; latestEmailInThread = " +
                    latest +
                    "; toggleEmails_treeview(" + i + "); latestEmailInThread = 0; return false;'>" +
                    subject +
                    "</a> <label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" +
                    mdate +
                    "</label>" + subs_label + people_label +
                    "<br/>By " + from + "</div>" 
                    
                    
            nest += "<div style='width: 100%; float: left; min-height: 64px;' id='bubble_"+i+"'>" +
                    "<div style='width: 64px; float: left;'>" +
                    "<img src='https://secure.gravatar.com/avatar/" + eml.gravatar + ".jpg?s=48&r=g&d=mm'/>" +
                    "</div>" +
                    "<div class='bubble-topic' style='float: left; width:calc(100% - 70px);'>"+ json[i].body.replace(/</g, "&lt;") + "<br/>" +
                    "<a class='label label-info' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' style='font-size: 85%; padding: 2px;' onclick='latestEmailInThread = " +
                    latest +
                    "; toggleEmails_treeview(" + i + "); latestEmailInThread = 0; return false;'>Read more..</a>" +
                    "</div>" +
                    "</div>" +
                    "</div><div id='thread_treeview_" + i + "' style='display:none';></div></li>"
        } else {
            nest += "<li class='list-group-item'>" +
                    "<div style='width: calc(100% - 220px); white-space:nowrap; overflow: hidden;'>" +
                    d + "<a style='overflow:hide;" + estyle + "' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id)  + "' onclick='this.style=\"\"; latestEmailInThread = " + latest+ "; toggleEmails_treeview(" + i + "); latestEmailInThread = 0; return false;'>" + subject +
                    "</div></a> <div style='float: right;position:absolute;right:4px;top:12px;';><a style='float: right; opacity: 0.75; margin-left: 2px; margin-top: -3px;' href='/api/atom.lua?mid=" + eml.id + "'><img src='/images/atom.png' title='Subscribe to this thread as an atom feed'/></a><label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label>" +
                    subs_label + people_label + "</div>" + "<div id='thread_treeview_" + i + "' style='display:none';></div></li>"
        }
    }
    nest += "</ul>"


    var bulk = document.getElementById('emails')
    bulk.innerHTML = ""
    
    // Top nav buttons
    var tnav = "<div style='float: left; width: 100%; height: 50px;'>"
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        tnav += '<div style="width: 40%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_treeview(false, ' + d_ppp + ', ' + nstart + ');">Show previous '+d_ppp+'</a> &nbsp </div>'
    } else {
        tnav += '<div style="width: 40%; float: left;">&nbsp;</div>'
    }
    
    if (json.length > (start + limit)) {
        remain = Math.min(d_ppp, json.length - (start + limit))
        tnav += '<div style="width: 40%; float: right;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_treeview(false, ' + d_ppp + ', ' + (start + d_ppp) + ');">Show next ' + remain + '</a></div>'
    }
    tnav += "</div><br/><br>"
    
    // Emails
    bulk.innerHTML += tnav + nest
    if (prefs.hideStats == 'yes') {
        bulk.parentNode.setAttribute("class", "well col-md-10 col-lg-10")
    } else {
        bulk.parentNode.setAttribute("class", "well col-md-10 col-lg-7")
    }
    var dp = (deep || (global_deep && current_query.length > 0)) ? 'true' : 'false'
    
    
    // Bottom nav buttons
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_treeview(false, ' + d_ppp + ', ' + nstart + ');">Show previous '+d_ppp+'</a> &nbsp </div>'
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    
    if (login && login.credentials) {
        bulk.innerHTML += '<div style="width: 33%; float: left; text-align: center;"><a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-danger" onclick="compose(null, \'' + xlist + '\');">Start a new thread</a></div>'
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    if (json.length > (start + limit)) {
        remain = Math.min(d_ppp, json.length - (start + limit))
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_treeview(false, ' + 15 + ', ' + (start + 15) + ');">Show next ' + remain + '</a></div>'
    }

}



function buildTreeview(nesting, list, obj, pbigger) {
    var now = new Date().getTime() / 1000
    for (var i in list) {
        var nvi = ""
        for (var z = 1; z <= nesting; z++) {
            if (z == nesting) {
                if (i == (list.length -1)) {
                    nvi += "<img src='/images/treeview_lastchild.png' style='height: 40px; width: 16px; overflow: hidden; margin-top: -5px;'/>"
                } else {
                    nvi += "<img src='/images/treeview_child.png' style='height: 40px; width: 16px; overflow: hidden; margin-top: -5px;'/>"
                }
            } else if (pbigger[z+1]) {
                nvi += "<img src='/images/treeview_parent.png' style='height: 40px; width: 16px; overflow: hidden;margin-top: -5px;'/>"
            } else {
                nvi += "<img src='/images/treeview_none.png' style='height: 40px; width: 16px; overflow: hidden;margin-top: -5px;'/>"
            }
        }
        
        
        var el = list[i]
        var friendly_id = (el.mid ? el.mid : el.tid).toString().replace(/@<.+>/, "")
        
        var node = document.createElement('div')
        node.setAttribute("id", "thread_parent_" + friendly_id)
        var nest = ""
        var eml = findEml(el.tid)
        if (eml && eml.subject.length > 90) {
            eml.subject = eml.subject.substr(0, 90) + "..."
        }
        var subs = countSubs(el)
        var people = countParts(el)
        var latest = countNewest(el)

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
        if ((qdeep || global_deep) && current_query.length > 0) {
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
        
        mdate = formatDate(mdate)
        var pds = people > 1 ? "visible" : "hidden"
        
        ld = 'default'
        var ti = ''
        if (eml.epoch > (now - 86400)) {
            ld = 'warning'
            ti = "Has activity in the past 24 hours"
        }
        var d = ""
        var qdeep = document.getElementById('checkall') ? document.getElementById('checkall').checked : false
        if (qdeep || global_deep && typeof eml.list != undefined && eml.list != null) {
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
        mdate = formatDate(mdate)
            
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
            at = "<img src='/images/attachment.png' title='" + eml.attachments + " file(s) attached' style='title='This email has attachments'/> "
        }
        var nw = (16*nesting) + 130
        
        nest += "<li class='list-group-item' style='min-height: 38px !important; border: none; padding: 0px; margin: 0px; padding-top: 5px; padding-bottom: -5px;'><div style='float: left; margin-top: -8px;'>" +
                nvi + "</div>" + "<div style='width: calc(99% - "+nw+"px); page-break: avoid; white-space: nowrap; overflow: hidden; float:left;'>" + at + "<span style='padding-top: 4px;'><a style='" + estyle + "' href='/thread.html/" +
                (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' onclick='this.style=\"padding-top: 4px; padding-bottom: -4px;\"; loadEmails_flat(\"" +
                el.tid + "\", false, \""+friendly_id+"\"); return false;'>" + subject + "</a></span> "+
                "<label style='width: 140px;' class='label label-info'>" + from + "</label></div>" +
                "<label style='float: right; position:absolute;right:4px;top:10px;width: 110px; margin-top: 6px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate +
                "</label><div id='thread_" + friendly_id + "' style='display: none;'></div></li>"
        node.innerHTML = nest
        // Guard against double post errors from time travel
        if (!treeview_guard[friendly_id]) {
            obj.appendChild(node)
        }
        treeview_guard[friendly_id] = true
        
        if (el.children && el.children.length > 0) {
            var npbigger = pbigger.slice()
            npbigger.push(i < (list.length-1))
            buildTreeview(nesting+1, el.children, obj, npbigger)
        }
    }
}




// toggleEmails_treeview: Open up a treeview display of a topic
function toggleEmails_treeview(id, close, toverride) {
    current_thread_mids = {}
    current_email_msgs = []
    var thread = document.getElementById('thread_treeview_' + id.toString().replace(/@<.+>/, ""))
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
        }
        
        thread.style.display = (thread.style.display == 'none') ? 'block' : 'none';
        var helper = document.getElementById('helper_' + id)
        if (!helper) {
            helper = document.createElement('div')
            helper.setAttribute("id", "helper_" + id)
            helper.style.padding = "10px"
            thread.parentNode.insertBefore(helper, thread)
        }

        // time travel magic!
        helper.innerHTML = ""
        thread.innerHTML = ""
        var ml = findEml(current_thread_json[id].tid)
        if (!current_thread_json[id].magic && ml.irt && ml.irt.length > 0) {
            helper.innerHTML += "<p id='magic_"+id+"'><i><b>Note:</b> You are viewing a search result/aggregation in threaded mode. Only results matching your keywords or dates are shown, which may distort the thread. For the best result, go to the specific list and view the full thread there, or view your search results in flat mode. Or we can <a href='javascript:void(0);' onclick='timeTravelList("+id+")'>do some magic for you</a>.</i></p>"
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
            prefs.groupBy = 'treeview' // hack for now
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
        
        // build treeview, set guard
        var nesting = 0
        treeview_guard = {}
        var html = buildTreeview(nesting, [current_thread_json[id]], thread, [true])
        current_thread = current_thread_json[id].tid
        
        
    }
}


/******************************************
 Fetched from dev/ponymail_ngrams.js
******************************************/


// Side-by-side comparison functions

var ngram_data = {}
var tsum = []
var nsum = {}
var ngramboxes = 0

function addNgram(json, state) {
    
    // Start from the beginning
    var D = new Date(state.dfrom)
    
    // Are we measuring emails or topics?
    if (state.topics) {
        json.emails = json.thread_struct
    }
    
    // For each day from $beginning to $now, push the no. of emails sent that day into an array
    var daily = []
    var zz = 0
    if (json.emails.length >= json.max) {
        document.getElementById('trends').innerHTML = "NOTE: Too many results found (&ge;" + json.max + ") , n-grams may be distorted"
        state.broken = true
    }
    for (var i in json.emails) {
        var f = parseInt(json.emails[i].epoch/86400)
        daily[f] = daily[f] ? daily[f]+1 : 1
        zz++;
    }
    tsum.push(zz)
    nsum[state.ngram] = zz
    var arr = []
    while (D <= state.dto) {
        var day = new Date(D)
        D.setDate(D.getDate()+1)
        var d = parseInt(D.getTime()/86400/1000) // make correct pointer to daily[] array
        
        arr.push([day, daily[d] ? daily[d] : 0])
    }
    ngram_data[state.ngram] = arr
    
    var ngram_names = []
    for (var n in ngram_data) ngram_names.push(n)
    
    // Sort so that the largest areas will be at the bottom in case of stacking
    ngram_names.sort(function(a,b) { return nsum[b] - nsum[a] })
    tsum = []
    for (var nn in ngram_names) {
        tsum.push(nsum[ngram_names[nn]])
    }

    var ngram_arr = []
    var avg = {}
    
    // find a suitable rolling-average timespan
    // set it to 1/15th of the timespan, or at least 3 days
    var ndays = parseInt(ngram_data[ngram_names[0]].length/15)
    if (ndays < 3) {
        ndays = 3
    }
    // For each ngram array we have, compile it into the quokka array
    for (var d in ngram_data[ngram_names[0]]) {
        var x = []
        var z = 0;
        for (var ni in ngram_names) {
            var n = ngram_names[ni]
            // Are we doing a rolling average ? let's calc it regardless, because ponies..
            avg[n] = avg[n] ? avg[n] : []
            avg[n].push(ngram_data[n][d][1])
            if (avg[n].length > ndays) {
                avg[n].shift();
            }
            var sum = 0;
            for (var a in avg[n]) {
                sum += avg[n][a]
            }
            sum = sum/avg[n].length;
            
            // Set the date for the array element
            x[0] = ngram_data[n][d][0];
            
            // push value (or rolling avg) into the quokka array
            x.push(state.avg ? sum*parseInt(ndays/3) : ngram_data[n][d][1])
        }
        if (!state.avg || d%parseInt(ndays/3) == 0) {
                ngram_arr.push(x)
            }
        
    }
    // Draw the current timeline
    var names_neat = []
    for (var i in ngram_names) {
        var nn = []
        var name = unescape(ngram_names[i])
        while (name.match(/(.*)&?header_([^=]+)=([^=&]+)&?/)) {
            var m = name.match(/(.*)&?header_([^=]+)=([^&=]+)&?(.*)/)
            name = m[1] + m[4]
            nn.push(m[2] + ": " + m[3])
        }
        if (name.match(/&?q=(.[^&=]+)/)) {
            nn.push("query: " + name.match(/&?q=(.[^&=]+)/)[1])
        }
        names_neat.push(nn.join(", "))
    }
    //quokkaLines("ngramCanvas", names_neat, ngram_arr, {stack: state.stack, curve: true, verts: false, title: "n-gram stats for " + state.listname + "@" + state.domain })
    
    // Fetch next ngram analysis if any are waiting
    if (state.ngrams.length > 0) {
        document.getElementById('trends').innerHTML = state.ngrams.length + " n-grams left to analyze..."
        var nngram = state.ngrams.pop()
        GetAsync('/api/stats.lua?' + (state.topics ? "" : 'quick=true&') + 'list='+state.listname+'&domain='+state.domain+'&d=' + state.dbl + "&" + nngram, { plaw:state.plaw, topics: state.topics, stack: state.stack, ngram: nngram, ngrams: state.ngrams, listname: state.listname, domain: state.domain, dbl: state.dbl, dfrom: state.dfrom, dto: state.dto, tspan: state.tspan, dspan: state.dspan, query: state.query, avg: state.avg }, addNgram)
    } else {
        document.getElementById('trends').innerHTML = "Rendering chart, hold on..!"
        window.setTimeout(function() {
            document.getElementById('trends').innerHTML = "n-gram analysis completed!"
            if (state.broken) {
                document.getElementById('trends').innerHTML += "<br/><b>Note:</b>Some n-gram objects exceeded the maximum result count (" + json.max + "), so the results may be distorted."
            }
            quokkaLines("ngramCanvas", names_neat, ngram_arr, {broken: state.broken, stack: state.stack, curve: true, verts: false, title: "n-gram stats for " + state.listname + "@" + state.domain }, tsum)
            // power law distribution check
            if (state.plaw) {
                document.getElementById('plawCanvas').style.display = "block"
                tsum.sort(function(b,a) {return a - b})
                var ref = tsum[0]
                var xs = []
                for (var i in tsum) {
                    xs.push([i, tsum[i], ref])
                    ref /= 2
                }
                quokkaLines("plawCanvas", ['Actual distribution', 'PL distribution reference'], xs, {nosum: true, curve: false, verts: false, title: "Power Law distribution check chart"})
            }
            
        }, 200)
    }
    
}

// ngram URL generator:
function makeNgramURL() {
    var list = document.getElementById('listname').value
    var timespan = document.getElementById('timespan').getAttribute("data")
    var qs = []
    if (document.getElementById('stack').checked) qs.push("stack")
    if (document.getElementById('topics').checked) qs.push("topics")
    if (document.getElementById('avg').checked) qs.push("avg")
    if (document.getElementById('plaw').checked) qs.push("plaw")
    for (n = 0; n < 20; n++) {
        if (document.getElementById('query' + n) && document.getElementById('query' + n).value.length > 0) {
            qs.push(document.getElementById('query' + n).value)
        }
    }
    var url = "ngrams.html?" + list + ":" + timespan + ":" + qs.join("||")
    location.href = url
}

//function for adding another field to the ngram form
function addNgramBox(hmm) {
    if (hmm > 0) {
        ngramboxes++
        var nobj = document.getElementById('ngram_query')
        var lbox = generateFormDivs('query' + ngramboxes, 'Query #' + ngramboxes + ':', 'text', "")
        lbox.childNodes[1].childNodes[0].setAttribute("onblur", "addNgramBox(this.value.length)")
        nobj.insertBefore(lbox, document.getElementById('ngrambutton'))
    }
}

// onload func that figures out what we want and then asks the API for stats
function loadNgrams() {
    
    // get list, timespan and query from the html page
    var args = document.location.search.substr(1)
    var a_arr = args.split(/:/, 3)
    var list = a_arr[0]
    var dspan = a_arr[1]
    var query = a_arr[2]
    
    // Try to detect header searches, if present
    var queries = unescape(query ? query : "").split("||")
    var ngrams = []
    var avg = false
    var topics = false
    var stack = false
    var plaw = false
    for (var n in queries) {
        var nquery = []
        var q = queries[n]
        if (q == 'avg') {
            avg = true
            continue
        } else if (q == 'stack') {
            stack = true
            continue
        } else if (q == 'plaw') {
            plaw = true
            continue
        } else if (q == 'topics') {
            topics = true
            continue
        } else if (q.length == 0) {
            continue
        } else if (q == '*') {
            ngrams.push("q=")
            continue
        }
        else if (q && q.length > 0) {
            var stuff = ['from', 'subject', 'body', 'to']
            for (var k in stuff) {
                // can we find 'header=foo' stuff?
                var r = RegExp(stuff[k] + "=([^&=]+)&?", "mi")
                var m = q.match(r)
                if (m) {
                    q = q.replace(m[0], "")
                    // append to the header_foo query
                    nquery.push("header_" + stuff[k] + "=" + escape(m[1]))
                }
            }
        }
        if (q.length > 0) {
            nquery.push("q=" + q)
        }
        ngrams.push(nquery.join("&"))
    }
    
    // default to 1 month view if nothing else is supplied
    if (!dspan || dspan.length == 0) {
        dspan = "lte=1M"
    }
    
    // figure out when this is and what the double is (for comparisons)
    var xa = datePickerDouble(dspan)
    
    // split list name for stats.lua
    var arr = list.split(/@/)
    var listname = arr[0]
    var domain = arr[1]
    
    // make the ngram generator div
    var nobj = document.getElementById('ngram_query')
    // options for ngram generator
    
    nobj.appendChild(generateFormDivs('listname', 'List(s):', 'text', list))
    var tspanner = generateFormDivs('timespan', 'Date range:', 'text', datePickerValue(dspan))
    tspanner.childNodes[1].childNodes[0].setAttribute("onmousedown", 'datePicker(this);')
    tspanner.childNodes[1].childNodes[0].setAttribute("data", dspan)
    nobj.appendChild(tspanner)
    nobj.appendChild(generateFormDivs('stack', 'Stack n-grams:', 'checkbox', stack))
    nobj.appendChild(generateFormDivs('avg', 'Use rolling averages:', 'checkbox', avg))
    nobj.appendChild(generateFormDivs('topics', 'Group messages by topics:', 'checkbox', topics))
    nobj.appendChild(generateFormDivs('plaw', 'Check for PL distribution:', 'checkbox', plaw))
    
    
    // query fields
    
    for (var n in queries) {
        var q = queries[n];
        if (q != 'stack' && q != 'topics' && q!= 'avg' && q != 'plaw') {
            ngramboxes++;
            nobj.appendChild(generateFormDivs('query' + ngramboxes, 'Query #' + ngramboxes + ':', 'text', q != undefined ? q : ""))
        }
        
    }
    
    
    // submit button
    var btn = document.createElement('input')
    btn.setAttribute("id", "ngrambutton")
    btn.setAttribute("type", "button")
    btn.setAttribute("value", "Generate n-grams")
    btn.setAttribute("onclick", "makeNgramURL()")
    nobj.appendChild(btn)
    
    
    // add an empty field
    addNgramBox(2)
    
    // Get us some data
    if (ngrams.length > 0) {
        var nngram = ngrams.pop()
        GetAsync('/api/stats.lua?' + (topics ? "" : "quick=true&") + 'list='+listname+'&domain='+domain+'&d=' + dspan + "&" + nngram, { plaw: plaw, topics: topics, stack: stack, avg: avg, ngram: nngram, ngrams: ngrams, listname: listname, domain: domain, dbl: dspan, dfrom: xa[1], dto: xa[2], tspan: xa[3], dspan: dspan, query: query }, addNgram)
        document.title = "n-gram stats for " + list + " - Pony Mail!"
    } else {
        document.getElementById('trends').innerHTML = ""
    }
    
}

/******************************************
 Fetched from dev/ponymail_pagebuilder.js
******************************************/



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
    
    // Build the main calendar (desktop version)
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
        dp.innerHTML += "<label onmouseout='this.setAttribute(\"class\", \"label label-success\");'  onmouseover='this.setAttribute(\"class\", \"label label-warning\");' onclick='toggleCalendar(" + year + ");' class='label label-success' style='float: left; width: 110px; font-size: 11pt; cursor: pointer'>" + year + "</label><br/>"
        var cale = "<div style='float: left; width: 80%; display: " + n + "; padding-left: 15px; margin-bottom: 15px;' id='cal_" + year + "'>"
        var em = (new Date().getFullYear() == year) ? new Date().getMonth() : 11;
        for (var y = em; y >= 0; y--) {
            var url = "/list.html?" + xlist + ":" + (year+"-"+(y+1))
            cale += "<a href='" + url + "' onclick='return false;'><label id='calmonth_" + (year+"-"+(y+1)) + "' style='width: 80px; float: left;cursor: pointer;' class='label label-default label-hover' onclick='toggleEmail(" + year + ", " + (y + 1) + ");' >" + months[y] + "</label></a><br/>"
        }
        cale += "</div>"
        dp.innerHTML += cale
    }
    
    // Build the mobile version (dropdown)
    var mdp = document.getElementById('datepicker_mobile')
    
    if (mdp) {
        mdp.innerHTML = ""
        for (var year = fyear; year >= (firstYear ? firstYear : current_cal_min); year--) {
            var n = "none";
            if (fyear == firstYear) {
                n = "block"
            }
            var ye = document.createElement('OPTGROUP');
            ye.label = year
            mdp.appendChild(ye)
            var em = (new Date().getFullYear() == year) ? new Date().getMonth() : 11;
            for (var y = em; y >= 0; y--) {
                var m = document.createElement('OPTION');
                m.textContent = months[y] + ", " + year
                m.value = year + '-' + (y+1)
                ye.appendChild(m)
            }
        }
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

// buildStats: build the stats window
function buildStats(json, state, show) {
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
    var ap = ""
    if (json.numparts && json.numparts > 1) {
        ap = " by " + json.numparts + " people"
    }
    stats.innerHTML += (json.emails.length ? json.emails.length : 0) + " emails sent" + ap + ", divided into " + json.no_threads + " topics."
    
    stats.innerHTML += "[<a href='/trends.html" + document.location.search + "'>details</a>]"
    stats.innerHTML += "<br/>"

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
        
        // Only logged-in users should be able to see actual email addresses here
        if (login && login.credentials) {
            stats.innerHTML += "<img src='https://secure.gravatar.com/avatar/" + par.gravatar + ".jpg?s=32&r=g&d=mm' style='vertical-align:middle'/>&nbsp;<a href='javascript:void(0)' onclick='do_search(\"" + par.email + "\", \"" + current_retention + "\")'><b>" + par.name.replace(/[<>]/g, "") + "</a>:</b> " + par.count + " email(s)<br/>";
        }
        else {
            stats.innerHTML += "<img src='https://secure.gravatar.com/avatar/" + par.gravatar + ".jpg?s=32&r=g&d=mm' style='vertical-align:middle'/>&nbsp;<b title='Log in to see the email address of this person'>" + par.name.replace(/[<>]/g, "") + ":</b> " + par.count + " email(s)<br/>";
        }
    }


    
    var btn = document.createElement('a')
    btn.setAttribute("href", "javascript:void(0);")
    btn.setAttribute("class", "btn btn-warning")
    btn.setAttribute("onclick", "prefs.hideStats='yes'; saveEphemeral(); buildStats(old_json, old_state, false);")
    btn.style.marginRight = "10px"
    btn.style.marginTop = "10px"
    btn.innerHTML = "Hide stats"
    stats.appendChild(btn)
    if (prefs.hideStats == 'yes' || show == false) {
        document.getElementById('emails_parent').style.width = "calc(100% - 190px)"
        
        // Resize on resize to work around CSS bug. Might wanna move this elsewhere later on..
        window.onresize = function() {
            var dwidth = document.getElementById('datepicker').offsetParent === null ? 0 : document.getElementById('datepicker').offsetWidth
            var sw =  dwidth + 20;
            document.getElementById('emails_parent').style.width = "calc(100% - " + sw + "px)"
        }
        stats.setAttribute("class", "col-md-1 vertical-text")
        stats.innerHTML = "<div onclick=\"prefs.hideStats='no'; saveEphemeral(); buildStats(old_json, old_state, true);\">Show stats panel..</div>"
    }
    if (prefs.hideStats == 'no' || show == true) {
        stats.setAttribute("class", "hidden-xs hidden-sm col-md-3 col-lg-3")
        var dwidth = document.getElementById('datepicker').offsetParent === null ? 0 : document.getElementById('datepicker').offsetWidth
        var sw =  dwidth + 30 + stats.offsetWidth;
        document.getElementById('emails_parent').style.width = "calc(100% - " + sw + "px)"
        // Resize on resize to work around CSS bug. Might wanna move this elsewhere later on..
        window.onresize = function() {
            var dwidth = document.getElementById('datepicker').offsetParent === null ? 0 : document.getElementById('datepicker').offsetWidth
            var sw =  dwidth + 30 + stats.offsetWidth;
            document.getElementById('emails_parent').style.width = "calc(99% - " + sw + "px)"
        }
        stats.removeAttribute("onclick")
        //stats.style.display = "block"
        if (json.cloud) {
            for (var i in json.cloud) {
                stats.innerHTML += "<h4 style='text-align: center;'>Hot topics:</h4>"
                stats.appendChild(wordCloud(json.cloud, 250, 80))
                break // so..this'll run if cloud has stuff, otherwise not.
            }
        }
    }
}

// buildPage: build the entire page!
function buildPage(json, state) {
    loadEphemeral(); // load ephem config if need be
    start = new Date().getTime()
    pb_refresh = start
    json = json ? json : old_json
    old_json = json
    old_state = state
    current_thread_mids = []
    checkCalendar(json)
    document.title = json.list + " - Pony Mail!"
    
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

    buildStats(json, state, null)
    
    nest = ""
    
    // Add/reset list view modes
    var vmobj = document.getElementById('viewmode')
    vmobj.innerHTML = "" // reset innerhtml
    for (var mode in viewModes) {
        var opt = document.createElement('option')
        opt.setAttribute("value", mode)
        opt.text = mode
        if (mode == prefs.displayMode) {
            opt.setAttribute("selected", "selected")
        }
        vmobj.appendChild(opt)
    }

    viewModes[prefs.displayMode].list(json, 0, 0, state ? state.deep : false);
    if (!json.emails || !json.emails.length || json.emails.length == 0) {
        document.getElementById('emails').innerHTML = "<h3>No emails found fitting this criteria</h3>"
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
        search(current_query, "lte=1M", true, true)
    }
    else if (xdomain && xdomain != "") {
        if (xdomain.length <= 1) {
            xdomain = null
        } else {
            if (xdomain.search(/:/) != -1) {
                var arr = xdomain.split(/:/)
                xdomain = arr[0]
                xlist = xdomain
                if (arr[1].match(/-/) && !arr[1].match(/\|/)) {
                    var ya = arr[1].split(/-/)
                    toggleEmail(ya[0], ya[1], nopush)
                    var dp = document.getElementById('dp')
                    current_retention = arr[1]
                    dealtwithit = true
                } else {
                    current_retention = parseInt(arr[1])
                    if (("x"+current_retention) != ("x"+arr[1])) {
                        current_retention = arr[1]
                        nopush = true
                        
                    }
                    current_query = unescape(arr[2])
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
    dp.value = datePickerValue(current_retention)
    dp.setAttribute("data", current_retention)
    
    document.getElementById('q').value = unescape(current_query)
    document.getElementById('aq').value = unescape(current_query)
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
            if (i >= 4) {
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
        document.getElementById('listtitle').innerHTML = list + ", last month"
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



/******************************************
 Fetched from dev/ponymail_phonebook.js
******************************************/


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


/******************************************
 Fetched from dev/ponymail_search.js
******************************************/



// toggleEmail: Fetch a list of emails from an ML in a specific year/month
function toggleEmail(year, mo, nopush) {
    if (typeof year == 'string' && year.search(/-/) && typeof(mo) == 'undefined') {
        var m = year.split(/-/)
        year = parseInt(m[0])
        mo = parseInt(m[1])
    }
    global_deep = false
    current_query = ""
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var domain = arr[1]
    var s = year + "-" + mo
    var e = s
    // if year and month is supplied, the calendar (to the left) should show where we are
    // so let's open up the right year and set the CSS for the selected month
    if (year && mo) {
        kiddos = []
        traverseThread(document.getElementById('datepicker'), 'calmonth', 'LABEL')
        for (var n in kiddos) {
            // if this is the active month, blue-ify it
            if (kiddos[n].getAttribute("id") == ("calmonth_" + year + "-" + mo)) {
                kiddos[n].setAttribute("class", "label label-info")
            // otherwise, default css
            } else {
                kiddos[n].setAttribute("class", "label label-default label-hover")
            }
        }
    }
    
    // if month is supplied, prettify it
    var xmo = mo ? parseInt(mo).toString() : ""
    if (mo.length > 0 && mo <= 9) {
        xmo = '0' + xmo
    }
    // push history state, fetch the data from API
    if (!nopush) window.history.pushState({}, "", "list.html?" + xlist + ":" + year + '-' + xmo);
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&s=" + s + "&e=" + e, null, buildPage)
    
    // set list title to list and year/month
    document.getElementById('listtitle').innerHTML = xlist + " (" + months[mo - 1] + ", " + year + ")"
}



// search: run a search
function search(q, d, nopush, all) {
    keywords = q
    current_retention = d // we use this later in the pagebuilder
    current_query = q // ditto
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var olist = listname
    var domain = arr[1]
    
    // are we checking *@foo.tld ?
    if (document.getElementById('checkall')) {
        all = document.getElementById('checkall').checked
    }
    // If checking multiple lists, the globa_deep will tell the pagebuilder to also
    // include the mailing list name in each result
    global_deep = false
    if (all == true) {
        listname = "*"
        global_deep = true
    }
    
    // we just made a new search, clear the selected month in the calendar to the left if that makes sense
    clearCalendarHover()
    
    // As usual, push new history state
    if (!nopush) window.history.pushState({}, "", "list.html?" + listname + "@" + domain + ":" + d + ":" + escape(q));
    
    // get the data from backend, push to page builder func
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&q=" + q.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "&d=" + d, null, buildPage)
    
    // for the list title, prepare the date range
    // TODO: improve this much like we have with trends.html
    var arr = datePickerDouble(d)
    howlong = arr[3]
    if (isNaN(howlong)) {
        howlong = "custom date range"
    } else {
        if (howlong >= 365) {
            howlong = "last " + parseInt(howlong/365) + " year" + (howlong>365 ? "s" : "")
        } else if (howlong >= 30) {
            howlong = "last " + parseInt(howlong/30) + " month" + (howlong>59 ? "s" : "")
        } else {
            howlong = "last " + howlong + " days"
        }
    }
    document.getElementById('listtitle').innerHTML = listname + "@" + domain + " (Quick Search, " + howlong + ") <a class='btn btn-warning' href='javascript:void(0);' onclick='getListInfo(xlist)'>Clear filters</a>"
    xlist = olist + "@" + domain
    return false;
}

// searchAll: run a deep search of all lists
// much the same as search(), but with added stuff for from and subject field searches.
function searchAll(q, dspan, from, subject, where) {
    keywords = q
    current_retention = 30
    current_query = q
    global_deep = true
    var wherel = "*"
    var whered = "*"
    if (where && where == 'xlist') {
        var a = xlist.split(/@/)
        wherel = a[0]
        whered = a[1]
    }
    var url = "/api/stats.lua?list="+wherel+"&domain="+whered+"&q=" + q.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "&d=" + escape(dspan)
    if (from) {
        url += "&header_from="  + "\""+ from.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "\""
        current_query += " FROM:"  + "\""+ from.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "\""
    }
    if (subject) {
        url += "&header_subject=\"" + subject.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "\""
        current_query += " SUBJECT:\"" + subject.replace(/([\s&+=%])/g, function(a) { return escape(a)}) + "\""
    }
    GetAsync(url, {
        deep: true
    }, buildPage)
    var arr = datePickerDouble(dspan)
    howlong = arr[3]
    if (isNaN(howlong)) {
        howlong = "custom date range"
    } else {
        if (howlong >= 365) {
            howlong = parseInt(howlong/365) + " year"
        } else if (howlong >= 30) {
            howlong = "last " + parseInt(howlong/30) + " month" + (howlong>59 ? "s" : "")
        } else {
            howlong =  howlong + " day"
        }
    }
    document.getElementById('listtitle').innerHTML = "Deep Search, " + howlong + " view <a class='btn btn-warning' href='javascript:void(0);' onclick='getListInfo(xlist)'>Clear filters</a>"
    clearCalendarHover()
    return false;
}

// do_search: run a search and update textboxes
function do_search(q, d, nopush, all) {
    document.getElementById('q').value = q
    document.getElementById('aq').value = q
    current_retention = d ? d : "lte=1M"
    current_query = q
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var domain = arr[1]
    if (!nopush) window.history.pushState({}, "", "list.html?" + xlist + ":" + d + ":" + escape(q));
    if (global_deep == true) {
        listname = "*"
        domain = "*"
    }
    var arr = datePickerDouble(d)
    howlong = arr[3]
    if (isNaN(howlong)) {
        howlong = "Custom date range"
    }
    else if (howlong >= 365) {
        howlong = parseInt(howlong/365) + " year" + (howlong>769 ? "s" : "")
    } else if (howlong >= 30) {
        howlong = parseInt(howlong/30) + " month" + (howlong>59 ? "s" : "")
    } else {
        howlong = howlong + " days"
    }
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&q=" + q + "&d=" + d, null, buildPage)
    document.getElementById('listtitle').innerHTML = listname + '@' + domain + " (Quick Search, last " + howlong + ") <a class='btn btn-warning' href='javascript:void(0);' onclick='getListInfo(xlist)'>Clear filters</a>"
    clearCalendarHover()
    return false;
}

// Adds an opensearch engine to the browser
function addSearchEngine() {
    window.external.AddSearchProvider("/api/websearch.lua?" + gxdomain)
}

// for firefox (chrome doesn't seem to get it just yet): add an opensearch header element,
// so the browser will notice that it's available, and inform the user in the quick search bar
function addSearchBar() {
    var h = document.getElementsByTagName('head')[0]
    var sl = document.createElement('link')
    sl.setAttribute("rel", "search")
    sl.setAttribute("type", "application/opensearchdescription+xml")
    sl.setAttribute("href", "/api/websearch.lua?" + gxdomain)
    sl.setAttribute("title", "PonyMail: " + gxdomain + " mailing lists")
    h.appendChild(sl)
}


/******************************************
 Fetched from dev/ponymail_seeders.js
******************************************/


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



/******************************************
 Fetched from dev/ponymail_stats.js
******************************************/



// showStats: Show the ML stats on the front page
function showStats(json) {
    var obj = document.getElementById('list_stats')
    
    obj.innerHTML = "<h3 style='margin-top: -10px;'>Overall 14 day activity:</h3>"
    obj.innerHTML += '<span class="glyphicon glyphicon-user"> </span> ' + json.participants.toLocaleString() + " People &nbsp; "
    obj.innerHTML += '<span class="glyphicon glyphicon-envelope"> </span> ' + json.hits.toLocaleString() + ' messages &nbsp';
    obj.innerHTML += '<span class="glyphicon glyphicon-list-alt"> </span> ' + json.no_threads.toLocaleString() + " topics &nbsp; "
    obj.innerHTML += '<span class="glyphicon glyphicon-inbox"> </span> ' + json.no_active_lists.toLocaleString() + " active lists."
    
    
    // Make a table (cheap way to graph stuff) for the daily stats
    var ts = "<table border='0' style='float: right; margin-top: -30px;'><tr>"
    
    // find the max no. of emails in a single day, for calculating max height of the 14 day chart
    var max = 1
    for (var i in json.activity) {
        max = Math.max(max, json.activity[i][1])
    }
    
    // for each day, make a bar, taking into account the max value
    for (var i in json.activity) {
        var day = new Date(json.activity[i][0]).toDateString()
        ts += "<td style='padding-left: 2px; vertical-align: bottom'><div title='" + day + ": " + json.activity[i][1] + " emails' style='background: #369; width: 6px; height: " + parseInt((json.activity[i][1] / max) * 48) + "px;'> </div></td>"
    }
    ts += "</tr></table>"
    obj.innerHTML += ts
}

/******************************************
 Fetched from dev/ponymail_timetravel.js
******************************************/



// simple func that just redirects to the original thread URL we just got if possible
function timeTravelSingleThreadRedirect(json) {
    if (json && json.thread) {
        location.href = "/thread.html/" + (pm_config.shortLinks ? shortenID(json.thread.mid) : json.thread.mid)
    }
}

// Func that fetches the timetravel data for the current thread (permalink mode)
function timeTravelSingleThread() {
    var mid = current_thread_json[0].mid
    GetAsync("/api/thread.lua?timetravel=true&id=" + mid, null, timeTravelSingleThreadRedirect)
}



// time travel in list view mode, callback from the API:
function timeTravelListRedirect(json, state) {
    if (json && json.emails) {
        for (var i in json.emails) {
            current_flat_json.push(json.emails[i])
        }
    }
    // Did we receive timetravel data?
    if (json && json.thread) {
        var osubs = countSubs(current_thread_json[state.id])
        var nsubs = countSubs(json.thread)
        var oid = current_thread_json[state.id].tid
        
        // Did we actually get more emails now than we had before?
        if (nsubs > osubs || nsubs >= osubs && !json.thread.irt) {
            if (prefs.displayMode == 'threaded') {
                toggleEmails_threaded(state.id)
                current_thread_json[state.id] = json.thread
                toggleEmails_threaded(state.id)
            } else if (prefs.displayMode == 'treeview') {
                toggleEmails_treeview(state.id)
                current_thread_json[state.id] = json.thread
                toggleEmails_treeview(state.id)
            }
            var subs = countSubs(json.thread)
            var parts = countParts(json.thread)
            if (document.getElementById('subs_' + state.id) != null) {
                document.getElementById('subs_' + state.id).innerHTML = "<span class='glyphicon glyphicon-envelope'> </span> " + subs + " replies"
                document.getElementById('people_' + state.id).innerHTML = "<span class='glyphicon glyphicon-user'> </span> " + parts + " people"
                document.getElementById('people_' + state.id).style.visibility = parts > 1 ? "visible" : "hidden"
            }
            document.getElementById('magic_' + state.id).innerHTML = "<i>Voila! We've found the oldest email in this thread for you and worked our way forward. Enjoy!</i>"
        }
        // Nope, nothing new - bummer!
        else {
            document.getElementById('magic_' + state.id).innerHTML = "<i>Hm, we couldn't find any more messages in this thread. bummer!</i>"
        }
        // Should we jump in the HTML to somewhere?
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

// time travel inside a list view
function timeTravelList(id, jump) {
    var mid = current_thread_json[id].tid
    GetAsync("/api/thread.lua?timetravel=true&id=" + mid, {id: id, jump: jump}, timeTravelListRedirect)
}

/******************************************
 Fetched from dev/ponymail_trends.js
******************************************/



// showTrends: Show the ML trends on trends.html
function showTrends(json, state) {
    
    var now = new Date().getTime() / 1000
    
    // Do we have a trend DOM object to edit?
    var obj = document.getElementById('trends')
    if (!obj) {
        return;
    }
    
    // size down trend obj
    obj.style.maxWidth = "660px"
    
    // Make sure we actually have a timespan > 0 days to analyze.
    if (state.tspan == 0) {
        obj.innerHTML += "<h4>Invalid date range specified!</h4>"
        return
    }
    
    
    // Add the timespan if it makes sense (has a beginning and end)
    var daterange = ""
    if (state.dfrom || state.dto) {
        daterange = " between " + (state.dfrom ? state.dfrom.toDateString() : "beginning of time") + " and " + (state.dto ? state.dto.toDateString() : "now")
    }
    
    // Link back to list view if possible
    var lname = json.list.replace(/</, "&lt;")
    if (lname.search(/\*/) == -1) {
        lname = "<a href='/list.html?" + lname + "'>" + lname + "</a>"
    }
    
    // Set page title
    var title = "<div><h2>Statistics for " + lname + "<br/><small>" + daterange + ":</small></h2>"
    if ((state.query && state.query.length > 0) || (state.nquery && state.nquery.length > 0)) {
        title += "<i>(NB: You are using a search query which may distort these results)"
    }
    title += "</div>"
    obj.innerHTML = title
    
    
    // for sake of displaying "N days" or just "days", make tspan empty string if null
    if (state.tspan == null) {
        state.tspan = ""
    }

    // save each daily stat for later canvas drawing
    var daily = {}
    
    // total emails sent in the past N days
    var total_emails_current = 0;
    var total_emails_past = 0;
    
    // For each email, count the ones in this and the previous time span
    for (var i in json.emails) {
        var f = parseInt(json.emails[i].epoch/86400)
        daily[f] = daily[f] ? daily[f]+1 : 1
        if ((state.dfrom == null) || json.emails[i].epoch >= (state.dfrom.getTime()/1000)) {
            total_emails_current++;
        } else {
            total_emails_past++;
        }
    }
    
    // change since past timespan as relative number and percentage
    var diff = total_emails_current-total_emails_past
    var pct = parseInt((diff / total_emails_past)*100)
    
    // Make div for emails sent
    var emls_sent = document.createElement('div')
    emls_sent.setAttribute("style", "float: left; margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #F8684E; color: #FFF; font-family: sans-serif; width: 300px;")
    emls_sent.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-envelope'> </span> " + total_emails_current.toLocaleString() + "</h2><span style='font-size: 13px;'>Emails sent during these " + state.tspan + " days,<br/></span>"
    
    // If a comparison with previous timespan makes sense (can be calculated), show it
    if (!isNaN(pct)) {
        if (total_emails_current >= total_emails_past) {
        emls_sent.innerHTML += "<span style='font-size: 11px;'><b style='color:#00D0F1'>up</b> " + (total_emails_current-total_emails_past) + " (" + pct + "%) compared to previous " + state.tspan + " days.</span>"
        } else {
            emls_sent.innerHTML += "<span style='font-size: 11px;'><b style='color:#F9BA00'>down</b> " + (total_emails_past-total_emails_current) + " (" + pct + "%) compared to previous " + state.tspan + " days.</span>"
        }
    }
    
    
    obj.appendChild(emls_sent)
    
    
    // total topics started in the past 3 months
    var total_topics_current = 0;
    var total_topics_past = 0;
    
    // For each thread, count the ones _started_ in this time span and the previous one
    for (var i in json.thread_struct) {
        if ((state.dfrom == null) || json.thread_struct[i].epoch >= (state.dfrom.getTime()/1000)) {
            total_topics_current++;
        } else {
            total_topics_past++;
        }
    }
    
    var diff = total_topics_current-total_topics_past
    var pct = parseInt((diff / total_topics_past)*100)
    
    
    // Make div for topics started
    var topics_sent = document.createElement('div')
    topics_sent.setAttribute("style", "float: left; margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #F99A00; color: #FFF; font-family: sans-serif; width: 300px;")
    topics_sent.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-list-alt'> </span> " + total_topics_current.toLocaleString() + "</h2><span style='font-size: 13px;'>topics started during these " + state.tspan + " days,<br/></span>"
    
    // If a comparison with previous timespan makes sense (can be calculated), show it
    if (!isNaN(pct)) {
        if (total_topics_current >= total_topics_past) {
            topics_sent.innerHTML += "<span style='font-size: 11px;'><b style='color:#00D0F1'>up</b> " + (total_topics_current-total_topics_past) + " (" + pct + "%) compared to previous " + state.tspan + " days.</span>"
        } else {
            topics_sent.innerHTML += "<span style='font-size: 11px;'><b style='color:#F9BA00'>down</b> " + (total_topics_past-total_topics_current) + " (" + pct + "%) compared to previous " + state.tspan + " days.</span>"
        }
    }
    
    obj.appendChild(topics_sent)
    
    
    // people participating in the past 3 months
    // As we can't just count them, we'll construct a hash and count the no. of elements in it
    var total_people_current = 0;
    var total_people_past = 0;
    var hc = {}
    var hp = {}
    
    // For each email, add to the sender hash for current and previous time span. Count 'em later
    for (var i in json.emails) {
        if ((state.dfrom == null) || json.emails[i].epoch >= (state.dfrom.getTime()/1000)) {
            hc[json.emails[i].from] = (hc[json.emails[i].from] ? hc[json.emails[i].from] : 0) + 1
        } else {
            hp[json.emails[i].from] = (hp[json.emails[i].from] ? hp[json.emails[i].from] : 0) + 1
        }
    }
    
    // count elements in the hashes
    for (var i in hc) { total_people_current++;}
    for (var i in hp) { total_people_past++;}
    
    var diff = total_people_current-total_people_past
    var pct = parseInt((diff / total_people_past)*100)
    
    // Make div for participants
    var parts = document.createElement('div')
    parts.setAttribute("style", "float: left; break-after: always; margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #00A757; color: #FFF; font-family: sans-serif; width: 300px;")
    parts.innerHTML = "<h2 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-user'> </span> " + total_people_current.toLocaleString() + "</h2><span style='font-size: 13px;'>Participants during these " + state.tspan + " days,</span><br/>"
    
    // If a comparison with previous timespan makes sense (can be calculated), show it
    if (!isNaN(pct)) {
        if (total_people_current >= total_people_past) {
            parts.innerHTML += "<span style='font-size: 11px;'><b style='color:#00D0F1'>up</b> " + (total_people_current-total_people_past) + " (" + pct + "%) compared to previous " + state.tspan + " days.</span>"
        } else {
            parts.innerHTML += "<span style='font-size: 11px;'><b style='color:#F9BA00'>down</b> " + (total_people_past-total_people_current) + " (" + pct + "%) compared to previous " + state.tspan + " days.</span>"
        }
    }
    
    obj.appendChild(parts)
    
    // Display charts if possible
    if (state.dfrom && state.dto) {
        quokkaBars("trendCanvas", 
        ['Previous timespan', 'Current timespan'], 
        [ 
            ["Emails sent", total_emails_past, total_emails_current],
            ["Topics started", total_topics_past, total_topics_current],
            ["Participants", total_people_past, total_people_current], 
        ],
        { stack: false, curve: false, title: "Stats for the past " + state.tspan + " days (compared to previous timespan)", nox: false }
      );
    }
    GetAsync('/api/stats.lua?list='+state.listname+'&domain='+state.domain+'&d=' + state.dspan + "&q=" + ((state.query && state.query.length > 0) ? state.query : "") + state.nquery, {tspan: state.tspan}, showTop)
    
    
    // daily chart rendering with quokka
    var days = []
    for (var d in daily) {
        days.push(d)
    }
    days.sort()
    
    var arr = []
    
    // Start from the beginning
    var D = new Date(state.dfrom)
    D.setDate(D.getDate()-state.tspan)
    
    // For each day from $beginning to $now, push the no. of emails sent that day into an array
    while (D <= state.dto) {
        var day = new Date(D)
        D.setDate(D.getDate()+1)
        var d = parseInt(D.getTime()/86400/1000) // make correct pointer to daily[] array
        
        // if in this timespan, color it blue
        if (day.getTime() >= state.dfrom.getTime()) {
            arr.push([day, daily[d] ? daily[d] : 0, '#00C0F1'])
            
        // else, color it green
        } else {
            arr.push([day, daily[d] ? daily[d] : 0, '#2DC47B'])
        }
        
    }
    // draw the chart
    quokkaBars("dayCanvas", ['Current timespan', '', 'Previous timespan'], arr, {verts: false, title: "Daily email stats"})
    
    // Add ngrams teaser
    var obj = document.getElementById('ngrams')
    obj.innerHTML = "Interested in more data? Try our <a href='ngrams.html?" + document.location.search.substr(1) + "'> n-grams page</a>!"
}

// callback for top10 stats
function showTop(json, state) {
    
    // Make sure we have a trend object to edit in the DOM
    var obj = document.getElementById('trends')
    if (!obj) {
        return;
    }
    var daterange = ""
    
    // Can't do much analysis if the timespan is 0 days
    if (state.tspan == 0) {
        return
    }
    
    // Top 10 participants
    var top10 = document.createElement('div')
    top10.setAttribute("style", "float: left; margin: 10px; padding: 5px; text-align: left; border-radius: 8px; background: #00C0F1; color: #FFF; font-family: sans-serif; width: 300px; min-height: 300px;")
    top10.innerHTML = "<h3 style='margin: 0px; padding: 0px; text-align: left;'><span class='glyphicon glyphicon-star-empty'> </span> Top 10 participants:</h3>"
    
    var l = "<ul style='margin-left: 0px; padding-left: 0px; list-style: none;'>"
    for (var i in json.participants) {
        var part = json.participants[i]
        l += "<li style='font-size: 13px;'><img src='https://secure.gravatar.com/avatar/" + part.gravatar + ".jpg?s=24&r=g&d=mm' style='margin-top: 3px; margin-right: 5px;'/><b>" + part.name.replace(/</, "&lt;") + ": </b>" + part.count + " email" + (part.count == 1 ? "" : "s") + "</li>"
    }
    l += "</ul>"
    top10.innerHTML += l
    
    obj.insertBefore(top10, obj.childNodes[1])    
}

// onload func that figures out what we want and then asks the API for stats
function gatherTrends() {
    
    // get list, timespan and query from the html page
    var args = document.location.search.substr(1)
    var a_arr = args.split(/:/, 3)
    var list = a_arr[0]
    var dspan = a_arr[1]
    var query = a_arr[2]
    
    // Try to detect header searches, if present
    var nquery = ""
    if (query && query.length > 0) {
        var stuff = ['from', 'subject', 'body']
        
        for (var k in stuff) {
            // can we find 'header=foo' stuff?
            var r = RegExp(stuff[k] + "=(.+)", "mi")
            var m = query.match(r)
            if (m) {
                query = query.replace(m[0], "")
                // append to the header_foo query
                nquery += "&header_" + stuff[k] + "=" + escape(m[1])
            }
        }
    }
    
    // don't let JavaScript try to send 'undefined' as an actual query here.
    if (query == undefined) {
        query = ""
    }
    // default to 1 month view if nothing else is supplied
    if (!dspan || dspan.length == 0) {
        dspan = "lte=1M"
    }
    // figure out when this is and what the double is (for comparisons)
    var xa = datePickerDouble(dspan)
    
    // split list name for stats.lua
    var arr = list.split(/@/)
    var listname = arr[0]
    var domain = arr[1]
    
    // Get us some data
    GetAsync('/api/stats.lua?list='+listname+'&domain='+domain+'&d=' + xa[0] + "&q=" + ((query && query.length > 0) ? query : "") + nquery, { nquery: nquery, listname: listname, domain: domain, dbl: xa[0], dfrom: xa[1], dto: xa[2], tspan: xa[3], dspan: dspan, query: query }, showTrends)
    document.title = "Stats for " + list + " - Pony Mail!"
}

/******************************************
 Fetched from dev/ponymail_user_preferences.js
******************************************/



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
        default: "Default theme"
    }, prefs.theme))
    
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
function setupUser() {
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

/******************************************
 Fetched from dev/ponymail_zzz.js
******************************************/



// dealWithKeyboard: Handles what happens when you hit the escape key
function dealWithKeyboard(e) {
    if (e.keyCode == 27) {
        if (document.getElementById('splash').style.display == 'block') {
            document.getElementById('splash').style.display = "none"
            saveDraft()
        } else if (location.href.search(/list\.html/) != -1) { // should only work for the list view
            
            // If datepicker popup is shown, hide it on escape
            var thread = document.getElementById('thread_' + current_thread.toString().replace(/@<.+>/, ""))
            if (document.getElementById('datepicker_popup') && document.getElementById('datepicker_popup').style.display == "block") {
                document.getElementById('datepicker_popup').style.display = "none"
            }
            // otherwise, collapse a thread?
            else if (thread) {
                    // Close one thread?
                if (thread.style.display == 'block') {
                    toggleEmails_threaded(current_thread, true)
                } else {
                    // Close all threads?
                    kiddos = []
                    traverseThread(document.body, '(thread|helper)_', 'DIV')
                    for (var i in kiddos) {
                        kiddos[i].style.display = 'none';
                    }
                }
            }
        }
    }
}


// Add Pony Mail powered-by footer
var footer = document.createElement('footer')
footer.setAttribute("class", 'footer')
footer.style.height = "32px"
footer.style.width = "100%"
var fd = document.createElement('div')
fd.setAttribute("class", "container")
fd.innerHTML = "<p class='muted' style='text-align: center;'>Powered by <a href='https://github.com/quenda/ponymail'>Pony Mail v/" + _VERSION_ + "</a>.</p>"
footer.appendChild(fd)
document.body.appendChild(footer)

// Add listener for keys (mostly for escape key for hiding stuff)
window.addEventListener("keyup", dealWithKeyboard, false);

// Add listener for when URLs get popped from the browser history
window.onpopstate = function(event) {
    getListInfo(null, document.location.search.substr(1), true)
}
