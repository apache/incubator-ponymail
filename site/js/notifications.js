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

function setupUserFromLua(json) {
    if (json.login) {
        setupUser(json.login)
        login = json.login
    }
}

function hasSeenResult(json, tid) {
    // Only decrease number if backend says 'seen' has changed
    if (json && json.marked) {
        document.getElementById('notif_' + tid).style.fontWeight = "normal"
        login.notifications--;
        setupUser(login)
    }
}

function hasSeen(mid, tid) {
    GetAsync("/notifications.lua?seen=" + mid, tid, hasSeenResult)
}

function renderNotifications(json) {
    var now = new Date().getTime() / 1000
    var deep = true
    if (json.notifications && json.notifications.length > 0) {
        current_flat_json = json.notifications
        
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
            var pmid = eml.mid
            eml.mid = eml.id
            var bold = eml.seen == 0 ? 'bold' : 'normal'
            var ld = 'default'
            var ti = ''
            if (eml.epoch > (now - 86400)) {
                ld = 'warning'
                ti = "Has activity in the past 24 hours"
            }
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
            mdate = new Date(eml.epoch * 1000)
            mdate = mdate.toLocaleFormat ? mdate.toLocaleFormat('%Y-%m-%d %T') : mdate.toLocaleString('en-GB', {
                hour12: false
            })
            var subject = eml.subject.replace(/</mg, "&lt;")
            var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
            from = from.replace(/\"/g, "")
            var extras = ""
            if (eml.seen == 0 ) {
                extras = "hasSeen(\"" + pmid + "\", " + i + "); "
            }
            nest += "<li class='list-group-item' style='font-weight: " + bold + ";' id='notif_" + i + "'> &nbsp; <a href='javascript:void(0);' onclick='" + extras + "toggleEmails_threaded(" + i + "); timeTravelList("+i+", \"" + eml.tid.replace(/@<.+>/, "") + "\");'>" + subject + "</a> " + d + " <label style='float: left; width: 140px;' class='label label-info'>" + from + "</label><label style='float: right; width: 140px;' class='label label-" + ld + "' title='" + ti + "'>(" + mdate + ")</label><div id='thread_" + i + "' style='display:none';></div></li>"
        }
        nest += "</ul>"
        document.getElementById('notifications').innerHTML = nest
    }
}
function listNotifications() {
    GetAsync("/notifications.lua", null, renderNotifications)
    GetAsync("/preferences.lua", null, setupUserFromLua)
}