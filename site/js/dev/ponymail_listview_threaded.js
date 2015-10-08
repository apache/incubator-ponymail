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
    if (prefs.theme && prefs.theme == "social") {
        d_ppp = 10
    } else {
        d_ppp = 15
    }
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
        
        mdate = formatDate(mdate)
        var pds = people > 1 ? "visible" : "hidden"
        
        // style based on view before or not??
        if (typeof(window.localStorage) !== "undefined") {
            if (! window.localStorage.getItem("viewed_" + eml.id) || (subs > 0 && parseInt(window.localStorage.getItem("viewed_" + eml.id)) < latest )){
                estyle = "font-weight: bold;"
            }
        }
        if (prefs.theme && prefs.theme == "social") {
            var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
            from = from.replace(/\"/g, "")
            nest += "<li class='list-group-item' style='min-height: 64px; float: left; width:100%;'><div style='min-height: 64px;'><div style='width:100%; float: left; padding-left: 70px;'>" +
                    d +
                    "<a style='" + estyle + "' href='javascript:void(0);' onclick='this.style=\"\"; latestEmailInThread = " +
                    latest +
                    "; toggleEmails_threaded(" + i + "); latestEmailInThread = 0;'>" +
                    subject +
                    "</a> <label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" +
                    mdate +
                    "</label><label id='subs_" + i + "' style='float: right; margin-right: 8px; width: 80px;' class='label label-" + ls + "'> " +
                    "<span class='glyphicon glyphicon-envelope'> </span> " + subs + " " + (subs != 1 ? "replies" : "reply") + "</label> &nbsp; " +
                    "<label style='visibility:" + pds + "; float: right; margin-right: 8px;' id='people_"+i+"' class='label label-" + lp +
                    "'> <span class='glyphicon glyphicon-user'> </span> " + people + " people</label>" +
                    "<br/>By " + from + "</div>" 
                    
                    
            nest += "<div style='width: 100%; float: left; min-height: 64px;' id='bubble_"+i+"'>" +
                    "<div style='width: 64px; float: left;'>" +
                    "<img src='https://secure.gravatar.com/avatar/" + eml.gravatar + ".jpg?s=48&r=g&d=mm'/>" +
                    "</div>" +
                    "<div class='bubble-topic' style='float: left; width:calc(100% - 70px);'>"+ json[i].body.replace(/</g, "&lt;") + "</div>" +
                    "</div>" +
                    "<div id='thread_" + i + "' style='display:none';></div></div></li>"
        } else {
            nest += "<li class='list-group-item'>" + d + "<a style='" + estyle + "' href='javascript:void(0);' onclick='this.style=\"\"; latestEmailInThread = " + latest+ "; toggleEmails_threaded(" + i + "); latestEmailInThread = 0;'>" + subject + "</a> <label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label><label id='subs_" + i + "' style='float: right; margin-right: 8px; width: 80px;' class='label label-" + ls + "'> <span class='glyphicon glyphicon-envelope'> </span> " + subs + " " + (subs != 1 ? "replies" : "reply") + "</label> &nbsp; " + "<label style='visibility:" + pds + "; float: right; margin-right: 8px;' id='people_"+i+"' class='label label-" + lp + "'> <span class='glyphicon glyphicon-user'> </span> " + people + " people</label>" + "<div id='thread_" + i + "' style='display:none';></div></li>"
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
        bulk.setAttribute("class", "well col-md-10 col-lg-10")
    } else {
        bulk.setAttribute("class", "well col-md-10 col-lg-7")
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
