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


// loadList_threaded: Same as above, but threaded display
function loadList_threaded(mjson, limit, start, deep) {
    if (localStorageAvailable) {
        var th = window.localStorage.getItem("pm_theme")
        if (th) {
            prefs.theme = th
        }
    }
    
    // Set displayed posts per page to 10 if social/compact theme, or auto-scale
    if (prefs.theme && (prefs.theme == "social" || prefs.theme == "compact")) {
        d_ppp = 10
        if (prefs.autoScale && prefs.autoScale == 'yes') {
            d_ppp = Math.floor( ( (window.innerHeight - 450) / (prefs.theme == 'social' ? 128 : 48) ) / 5 ) * 5
            if (d_ppp <= 0) {
                d_ppp = 5
            }
        }
    // otherwise default to 15 or auto-scale
    } else {
        d_ppp = 15
        if (prefs.autoScale && prefs.autoScale == 'yes') {
            d_ppp = Math.floor( ( (window.innerHeight - 450) / 28 ) / 5 ) * 5
            if (d_ppp <= 0) {
                d_ppp = 5
            }
        }
    }
    // reset open email counter hash
    open_emails = []
    
    // set display limit to default ppp if not set by call
    limit = limit ? limit : d_ppp;
    
    // If no flat JSON is supplied (as with next/prev page clicks), fall back to the previous JSON,
    // otherwise, sort it descending by epoch
    var fjson = mjson ? ('emails' in mjson && isArray(mjson.emails) ? mjson.emails.sort(function(a, b) {
        return b.epoch - a.epoch
    }) : []) : current_flat_json
    // sync JSON
    current_flat_json = fjson
    
    // same with threaded JSON
    var json = mjson ? sortIt(mjson.thread_struct) : current_thread_json
    current_thread_json = json
    
    // get $now
    var now = new Date().getTime() / 1000
    
    // start = start or 0 (first email)
    if (!start) {
        start = 0
    }
    
    // start nesting HTML
    nest = '<ul class="list-group">'
    
    c_page = start
    // for each email from start to finish (or page limit), do...
    for (var i = start; i < json.length; i++) {
        if (i >= (start + limit)) {
            break
        }
        // Get the email
        var eml = findEml(json[i].tid)
        // allow for empty subject
        if (eml && eml.subject.length == 0) {
            eml.subject = '(no subject)'
        }
        
        // truncate subject (do we need this?)
        if (eml && eml.subject.length > 90) {
            eml.subject = eml.subject.substr(0, 90) + "..."
        }
        
        // do some counting
        var subs = countSubs(json[i])
        var people = countParts(json[i])
        var latest = countNewest(json[i])

        // coloring for labels
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
        // orange label for new timestamps
        if (latest > (now - 86400)) {
            ld = 'warning'
            ti = "Has activity in the past 24 hours"
        }
        var d = ''
        var estyle = ""
        // if deep search (multi-list), show the list name label as well
        var qdeep = document.getElementById('checkall') ? document.getElementById('checkall').checked : false
        if ((qdeep || deep || global_deep) && current_query.length > 0) {
            eml.list = eml.list ? eml.list : eml.list_raw // Sometimes, .list isn't available
            var elist = eml.list.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            var elist2 = elist
            // shortlist? show dev@ instead of dev@foo.bar then
            if (pm_config.shortLists) {
                elist = elist.replace(/\.[^.]+\.[^.]+$/, "")
            }
            d = "<a href='list.html?" + elist2 + "'><label class='label label-warning' style='width: 150px;'>" + elist + "</label></a> &nbsp;"
            // truncate subject even more if list labels are there
            if (eml.subject.length > 75) {
                eml.subject = eml.subject.substr(0, 75) + "..."
            }
        }
        // escape subject
        var subject = eml.subject.replace(/</mg, "&lt;")
        
        var mdate = formatEpochUTC(latest)
        var pds = people > 1 ? "visible" : "hidden"
        
        // style based on view before or not??
        if (localStorageAvailable) {
            if (! window.localStorage.getItem("viewed_" + eml.id) || (subs > 0 && parseInt(window.localStorage.getItem("viewed_" + eml.id)) < latest )){
                estyle = "font-weight: bold;"
            }
        }
        
        
        var people_label = "<label style='visibility:" + pds + "; float: right; margin-right: 8px; ' id='people_"+i+"' class='listview_label label label-" + lp + "'> <span class='glyphicon glyphicon-user'> </span> " + people + " <span class='hidden-xs hidden-sm'>people</span></label>"
        var subs_label = "<label id='subs_" + i + "' style='float: right; margin-right: 8px;' class='label label-" + ls + "'> <span class='glyphicon glyphicon-envelope'> </span>&nbsp;<span style='display: inline-block; width: 16px; text-align: right;'>" + subs + "</span>&nbsp;<span style='display: inline-block; width: 40px; text-align: left;' class='hidden-xs hidden-sm'>" +  (subs != 1 ? "replies" : "reply") + "</span></label>"
        
        // social theme display
        if (prefs.theme && prefs.theme == "social") {
            var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
            from = "<span class='from_name'>" + from.replace(/\"/g, "") + "</span>"
            nest += "<li class='list-group-item' style='min-height: 64px; float: left; width:100%;'><div style='min-height: 64px;'><div style='width:100%; float: left; padding-left: 70px;'>" +
                    d +
                    "<a style='" + estyle + "' href='thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' onclick='this.style=\"\"; latestEmailInThread = " +
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
                    "<div class='bubble-topic' style='float: left; width:calc(100% - 70px);'>"+ eml.body.replace(/</g, "&lt;") + "<br/>" +
                    "<a class='label label-info' href='thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' style='font-size: 85%; padding: 2px;' onclick='latestEmailInThread = " +
                    latest +
                    "; toggleEmails_threaded(" + i + "); latestEmailInThread = 0; return false;'>Read more..</a>" +
                    "</div>" +
                    "</div>" +
                    "<div id='thread_" + i + "' style='display:none';></div></div></li>"
        }
        // compact theme display
        else if (prefs.theme && prefs.theme == "compact") {
            var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
            from = "<span class='from_name'>" + from.replace(/\"/g, "") + "</span>"
            var sbody = eml.body.replace(/</g, "&lt;") + "&nbsp;"
            
            nest += "<li class='list-group-item'>" +
                    
                    "<div><div style='width: 190px; float: left; white-space:nowrap; text-overflow: ellipsis; overflow: hidden;'>" +
                    "<img src='https://secure.gravatar.com/avatar/" + eml.gravatar + ".jpg?s=32&r=g&d=mm'/>&nbsp;<b>" +
                    from +
                    "</b></div> " +
                    "<div style='width: calc(100% - 230px); white-space:nowrap; overflow: hidden;'>" +
                    d + "<a style='overflow:hidden;" + estyle + "' href='thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id)  + "' onclick='this.style=\"\"; latestEmailInThread = " + latest+ "; toggleEmails_threaded(" + i + "); latestEmailInThread = 0; return false;'>" + subject +
                    "</div></a> <div style='float: right;position:absolute;right:4px;top:12px;';><a style='float: right; opacity: 0.75; margin-left: 2px; margin-top: -3px;' href='api/atom.lua?mid=" + eml.id + "'><img src='images/atom.png' title='Subscribe to this thread as an atom feed'/></a><label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label>" +
                    subs_label + people_label + "&nbsp; " +
                    "</div><div style='width: calc(100% - 270px); color: #999; white-space:nowrap; text-overflow: ellipsis; overflow: hidden;'>" + sbody +
                    "</div></div>" + "<div id='thread_" + i + "' style='display:none';></div></li>"
        }
        // default theme display
        else {
            nest += "<li class='list-group-item'>" +
                    "<div style='width: calc(100% - 200px); white-space:nowrap; overflow: hidden;'>" +
                    d + "<a style='overflow:hidden;" + estyle + "' href='thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id)  + "' onclick='this.style=\"\"; latestEmailInThread = " + latest+ "; toggleEmails_threaded(" + i + "); latestEmailInThread = 0; return false;'>" + subject +
                    "</div></a> <div style='float: right;position:absolute;right:4px;top:12px;';><a style='float: right; opacity: 0.75; margin-left: 2px; margin-top: -3px;' href='api/atom.lua?mid=" + eml.id + "'><img src='images/atom.png' title='Subscribe to this thread as an atom feed'/></a><label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label>" +
                    subs_label + people_label + "&nbsp; " + "</div>" + "<div id='thread_" + i + "' style='display:none';></div></li>"
        }
    }
    nest += "</ul>"


    var bulk = document.getElementById('emails')
    bulk.innerHTML = ""
    
    // Top nav buttons
    var tnav = "<div style='width: 100%; position: relative;'>"
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        tnav += '<div style="width: 40%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_threaded(false, ' + d_ppp + ', ' + nstart + ');">Show previous '+d_ppp+'</a> &nbsp </div>'
    } else {
        tnav += '<div style="width: 40%; float: left;">&nbsp;</div>'
    }
    var remain
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
    
    // subscribe button
    var sublist = xlist.replace(/@/, "-subscribe@")
    var innerbuttons = '<a href="mailto:' + sublist + '" title="Click to subscribe to this list" style="margin: 0 auto" class="btn btn-primary">Subscribe</a>'
    
    // show subscribe button if logged in
    if (login && login.credentials) {
        innerbuttons += ' &nbsp; <a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-danger" onclick="compose(null, \'' + xlist + '\');">Start a new thread</a>'
    }
    
    // Favorite or forget
    if (login && login.credentials && xlist) {
        var found = false
        for (var i in (login.favorites || [])) {
            if (login.favorites[i] == xlist) {
                found = true
                break
            }
        }
        innerbuttons += '<span id="favbtn">'
        if (found) {
            innerbuttons += ' &nbsp; <a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-default" onclick="favorite(false, \'' + xlist + '\');">Remove from favorites</a>'
        } else {
            innerbuttons += ' &nbsp; <a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-info" onclick="favorite(true, \'' + xlist + '\');">Add list to favorites</a>'
        }
        innerbuttons += '</span>'
    }
    
    bulk.innerHTML += '<div style="width: 33%; float: left;">' + innerbuttons + '</div>'
    
    
    if (json.length > (start + limit)) {
        remain = Math.min(d_ppp, json.length - (start + limit))
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_threaded(false, ' + d_ppp + ', ' + (start + d_ppp) + ');">Show next ' + remain + '</a></div>'
    }

}


// loadEmails_threaded: Callback for receiving a doc via ES, save and displays the email
function loadEmails_threaded(json, state) {
    current_thread_mids = {}
    saved_emails[json.tid ? json.tid : json.mid] = json
    displayEmailThreaded(json, {
        main: state.blockid,
        before: state.blockid
    }, state.object)
    getChildren(state.blockid, state.thread)
}
