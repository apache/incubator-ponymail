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


// loadList_flat: Load a chunk of emails as a flat (non-threaded) list
function loadList_flat(mjson, limit, start, deep) {
    if (prefs.theme && (prefs.theme == "social" || prefs.theme == "compact")) {
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
        if (prefs.theme && prefs.theme == 'compact') {
            var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
            from = from.replace(/\"/g, "")
            
            var sbody = (eml.body ? eml.body.replace(/</g, "&lt;") : "") + "&nbsp;"
            
            nest += "<li class='list-group-item'>" +
                    
                    "<div style='min-height: 32px;'><div style='width: 190px; float: left; white-space:nowrap; text-overflow: ellipsis; overflow: hidden;'>" +
                    "<img src='https://secure.gravatar.com/avatar/" + eml.gravatar + ".jpg?s=32&r=g&d=mm'/>&nbsp;<b>" +
                    from +
                    "</b></div> " +
                    "<div style='width: calc(100% - 230px); white-space:nowrap; overflow: hidden;'>" +
                    d + "<a style='overflow:hidden;" + estyle + "' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id)  + "' onclick='this.style=\"\"; loadEmails_flat(" + i + "); latestEmailInThread = 0; return false;'>" + subject +
                    "</div></a> <div style='float: right;position:absolute;right:4px;top:12px;';><a style='float: right; opacity: 0.75; margin-left: 2px; margin-top: -3px;' href='/api/atom.lua?mid=" + eml.id + "'><img src='/images/atom.png' title='Subscribe to this thread as an atom feed'/></a><label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label>" +
                    "</div><div style='width: calc(100% - 270px); color: #999; white-space:nowrap; 	text-overflow: ellipsis; overflow: hidden;'>" + sbody +
                    "</div></div>" + "<div id='thread_" + i + "' style='display:none';></div></li>"
        } else {
            nest += "<li class='list-group-item'> " + at + " &nbsp; <a style='" + estyle + "' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' onclick='this.style=\"\"; loadEmails_flat(" + i + "); return false;'>" + subject + "</a> <label style='float: left; width: 140px;' class='label label-info'>" + from + "</label><label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label><div id='thread_" + i + "' style='display:none';></div></li>"
        }
    }
    nest += "</ul>"


    var bulk = document.getElementById('emails')
    bulk.innerHTML = ""
    
    // Top nav buttons
    var tnav = "<div style='float: left; width: 100%'>"
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        tnav += '<div style="width: 50%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_flat(false, ' + d_ppp + ', ' + nstart + ');">Show previous ' + d_ppp + '</a> &nbsp </div>'
    } else {
        tnav += '<div style="width: 50%; float: left;">&nbsp;</div>'
    }
    var remain
    if (json.length > (start + limit)) {
        remain = Math.min(d_ppp, json.length - (start + limit))
        tnav += '<div style="width: 50%; float: left;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_flat(false, ' + d_ppp + ', ' + (start + d_ppp) + ');">Show next ' + remain + '</a></div>'
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
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_flat(false, ' + d_ppp + ', ' + nstart + ');">Show previous ' + d_ppp + '</a> &nbsp </div>'
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    
    var sublist = xlist.replace(/@/, "-subscribe@")
    var innerbuttons = '<a href="mailto:' + sublist + '" title="Click to subscribe to this list" style="margin: 0 auto" class="btn btn-primary">Subscribe</a>'
    if (login && login.credentials) {
        innerbuttons += ' &nbsp; <a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-danger" onclick="compose(null, \'' + xlist + '\');">Start a new thread</a>'
    }
    bulk.innerHTML += '<div style="width: 33%; float: left;">' + innerbuttons + '</div>'
    
    
    if (json.length > (start + limit)) {
        remain = Math.min(d_ppp, json.length - (start + limit))
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_flat(false, ' + d_ppp + ', ' + (start + d_ppp) + ');">Show next ' + remain + '</a></div>'
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
