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
                    GetAsync("/api/email.lua?id=" + child.tid, {
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


function formatDate(date){
    return (date.getFullYear() + "-" +
        date.getMonth().toPrecision(2) + "-" +
        date.getDate().toPrecision(2) + " " +
        date.getHours().toPrecision(2) + ":" +
        date.getMinutes().toPrecision(2))        
}