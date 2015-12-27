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
    // Set up request object
    if (window.XMLHttpRequest) {
        xmlHttp = new XMLHttpRequest();
    } else {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    
    // Set the start time of the request, used for the 'loading data...' spinner later on
    if (pending_urls) {
        pending_urls[theUrl] = new Date().getTime() / 1000;
    }
    
    // Caching feature: if we've seen this URL before, let's try to only fetch it again if it's updated
    var finalURL = theUrl
    if (visited_urls[theUrl]) {
        finalURL += ((finalURL.search(/\?/) == -1) ? '?' : '&') + 'since=' + visited_urls[theUrl]
    }
    
    // Set visitation timestamp for now (may change if the result JSON has a unix timestamp of its own)
    visited_urls[theUrl] = new Date().getTime()/1000
    
    // GET URL
    xmlHttp.open("GET", finalURL, true);
    xmlHttp.send(null);
    
    // Callbacks
    xmlHttp.onprogress = function() {
        checkForSlows()
    }
    xmlHttp.onerror = function() {
        delete pending_urls[theUrl]
        checkForSlows()
    }
    xmlHttp.onreadystatechange = function(state) {
        // All done, remove from pending list
        if (xmlHttp.readyState == 4) {
            delete pending_urls[theUrl]
        }
        checkForSlows()
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            if (callback) {
                // Try to parse as JSON and deal with cache objects, fall back to old style parse-and-pass
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
        // If 404'ed, alert! It is kind of a big deal if we get this
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