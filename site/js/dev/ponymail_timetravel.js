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