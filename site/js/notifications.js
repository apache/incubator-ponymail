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

// Callback that sets up the user menu in JS, provided
// valid account JSON is supplied
function setupUserFromLua(json) {
    if (typeof json.login != undefined && json.login) {
        login = json.login
        if (login.credentials) {
            setupUser(json.login)
        }
    }
}


// Callback for hasSeen - marks the email as seen inside the browser and
// decreases notification count.
function hasSeenResult(json, tid) {
    // Only decrease number if backend says 'seen' has changed
    if (json && json.marked) {
        document.getElementById('notif_' + tid).style.fontWeight = "normal"
        login.notifications--;
        setupUser(login)
    }
}

// Function for telling the backend that we've seen a specific message, as
// denoted by the MID
function hasSeen(mid, tid) {
    GetAsync("/api/notifications.lua?seen=" + mid, tid, hasSeenResult)
}

// Func for rendering the list of notifications
function renderNotifications(json) {
    var now = new Date().getTime() / 1000
    var deep = true
    // Do we have notifications to show?
    if (json.notifications && json.notifications.length > 0) {
        current_flat_json = json.notifications
        
        // Make an unordered list, dirty innerHTML style for now.
        var nest = "<ul style='text-align: left;'>"
        for (var i in current_flat_json) {
            var notif = current_flat_json[i]
            if (!notif.epoch) {
                continue;
            }
            
            var eml = notif
            current_thread_json[i] = eml
            if (eml.subject.length > 90) {
                eml.subject = eml.subject.substr(0, 90) + "..."
            }
            var pmid = eml.nid
            eml.mid = eml.id
            
            // Have we read this notification already? if not, bold it.
            var bold = eml.seen == 0 ? 'bold' : 'normal'
            var ld = 'default'
            var ti = ''
            if (eml.epoch > (now - 86400)) {
                ld = 'warning'
                ti = "Has activity in the past 24 hours"
            }
            // This sets the list the notif is from and shortens the subject line
            if (deep  && typeof eml.list != undefined && eml.list != null) {
                var elist = (eml.list ? eml.list : "").replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
                var elist2 = eml.list.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
                if (pm_config.shortLists) {
                    elist = elist.replace(/\.[^.]+\.[^.]+$/, "")
                }
                d = "<a href='list.html?" + elist2 + "' style='float: left; margin-right: 4px;'><label class='label label-warning'>" + elist + "</label></a> &nbsp;"
                if (eml.subject.length > 75) {
                    eml.subject = eml.subject.substr(0, 75) + "..."
                }
            }
            // Convert email date into locale format, firefox or ecma style.
            mdate = new Date(eml.epoch * 1000)
            mdate = mdate.toLocaleFormat ? mdate.toLocaleFormat('%Y-%m-%d %T') : mdate.toLocaleString('en-GB', {
                hour12: false
            })
            
            // Escape HTML and make the From header have just the sender name
            var subject = eml.subject.replace(/</mg, "&lt;")
            var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
            from = from.replace(/\"/g, "")
            
            // If not viewed, add a hasSeen callback inside it when clicked
            var extras = ""
            if (eml.seen == 0 ) {
                extras = "hasSeen(\"" + pmid + "\", " + i + "); "
            }
            
            // Add notif to list
            nest += "<li class='list-group-item' style='font-weight: " + bold + ";' id='notif_" + i + "'> &nbsp; <a href='javascript:void(0);' onclick='" + extras + "toggleEmails_threaded(" + i + "); timeTravelList("+i+", "+ eml.epoch + ");'>" + subject + "</a> " + d + " <label style='float: left; width: 140px;' class='label label-info'>" + from + "</label><label style='float: right; width: 140px;' class='label label-" + ld + "' title='" + ti + "'>(" + mdate + ")</label><div id='thread_" + i + "' style='display:none';></div></li>"
        }
        nest += "</ul>"
        document.getElementById('notifications').innerHTML = nest
    } else {
        document.getElementById('notifications').innerHTML = "There don't seem to be any notifications for you yet."
    }
}

// onLoad function, fetches the needed JSON and renders the notif list
// invoked by onload in notifications.html
function listNotifications() {
    GetAsync("/api/notifications.lua", null, renderNotifications)
    GetAsync("/api/preferences.lua", null, setupUserFromLua)
}