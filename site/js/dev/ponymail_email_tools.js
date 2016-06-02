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
    // for each email we currently have in the saved JSON array
    for (var i in current_flat_json) {
        // Does MID match?
        if (current_flat_json[i].id == id) {
            return current_flat_json[i]
        }
    }
}
 
 
// countSubs: counts the number of replies to an email   
function countSubs(eml, state) {
    var n = 0;
    // If first call, start with -1, as the main email will increment this by one
    if (!state) {
        n = -1
    }
    // construct a duplicate guard hash
    state = state ? state : {}
    // get email ID - either TID or MID, depends..
    var x = eml.tid ? eml.tid : eml.mid
    // If we haven't seen this email before in the count, increment by one
    if (!state[x]) {
        n++;
        state[x] = true
    }

    // Also count each child in the thread (and possibly their children)
    for (var i in eml.children) {
        n += countSubs(eml.children[i], state);
    }
    return n
}

// countNewest: finds the newest email in a thread
function countNewest(eml) {
    var n = eml.epoch;
    // for each child, find the oldest and keep that epoch val
    for (var i in eml.children) {
        n = Math.max(n, countNewest(eml.children[i]));
    }
    return n
}

// countParts: counts the number of unique participants in a thread
function countParts(eml, kv) {
    var n = 0;
    var email = findEml(eml.tid)
    // kv keeps tracks of duplicate entries, only count each email once
    kv = kv ? kv : {}
    if (!email) {
        return n
    }
    // have we seen any email from this sender before? If not, increment!
    if (!kv[email.from]) {
        kv[email.from] = true
        n++;
    }
    // Run the counter for each child in the thread..
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
function getChildren(main, email, level, pnode) {
    // nesting level
    level = level ? level : 1
    var pchild = null
    // if email is a valid thread struct and can be sorted (is array)...
    if (email && email.children && email.children.sort) {
        // Sort child emails ascending by epoch
        email.children.sort(function(a, b) {
            return a.epoch - b.epoch
        })
        var pchildo = null
        // for each child in the thread
        for (var i in email.children) {
            var child = email.children[i]
            // If it's not the parent (don't want a loop!), then..
            if (child.tid != email.mid) {
                // see if we have a saved copy of the email already
                var eml = saved_emails[child.tid]
                
                // Placeholder for the email, so we don't lose our sorting
                if (pnode) {
                    var node = document.createElement('div')
                    node.setAttribute("id", "thread_" + (child.mid ? child.mid : child.tid).toString().replace(/@<.+>/, ""))
                    pnode.appendChild(node)
                }
                
                // No saved copy? Let's fetch from the backend then!
                if (!eml || !eml.from) {
                    GetAsync("/api/email.lua?id=" + child.tid, {
                        main: main,
                        before: email.tid,
                        pchild: pchild,
                        child: child,
                        level: level+1
                    }, displayEmailThreaded)
                // Saved copy here? Just show it then!
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
            // set pchild (for proper DOM placement)
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
function getSingleEmail(id, object) {
    GetAsync("/api/email.lua?id=" + id, {object: object} , displaySingleEmail)
}


// seedGetSingleThread: pre-caller for the above.
function seedGetSingleThread(id) {
    GetAsync("/api/preferences.lua", {docall:["/api/thread.lua?id=" + id, displaySingleThread]}, seedPrefs)
}

// Padding prototype, akin to %0[size]u in printf
Number.prototype.pad = function(size) {
    var str = String(this);
    while (str.length < size) {
        str = "0" + str;
    }
    return str;
}


// formatDate: Return a date as YYYY-MM-DD HH:mm
function formatDate(date, dtz){
    tz = new Date().getTimezoneOffset()
    ttz = 0
    var plus = "+"
    if (tz < 0) {
        plus = "-"
        tz = Math.abs(tz)
    }
    while (tz >= 60) {
        tz-= 60;
        ttz++
    }
    ttz = (ttz*100) + tz
    while (ttz.length < 4) ttz = "0" + ttz
    return (date.getFullYear() + "-" +
        (date.getMonth()+1).pad(2) + "-" +
        date.getDate().pad(2) + " " +
        date.getHours().pad(2) + ":" +
        date.getMinutes().pad(2)) +
        (dtz ? "(" + plus + ttz + ")" : "")
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

