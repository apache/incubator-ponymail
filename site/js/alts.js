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
function setupUserAlts(json) {
    if (typeof json.login != undefined && json.login) {
        login = json.login
        if (login.credentials) {
            setupUser(json.login)
        }
    }
    renderAlts(json)
}


// Func for rendering the list of notifications
function renderAlts(json) {
    if (json.login && json.login.credentials) {
        var obj = document.getElementById('alts')
        var main = json.login.credentials.email.replace(/<>"'/g, "")
        obj.innerHTML = main + " - primary address<br/>"
        for (var i in json.login.alternates) {
            var alt = json.login.alternates[i]
            alt = alt.replace(/<>"'/g, "")
            obj.innerHTML += alt + " - [<a href='javascript:void(0);' onclick='delAlt(\"" + alt + "\");'>Remove</a>]<br/>"
        }
    }    
}

// onLoad function, fetches the needed JSON and renders the notif list
function listAlts() {
    GetAsync("/api/preferences.lua", null, setupUserAlts)
}

function newAlt(addr) {
    GetAsync("/api/preferences.lua?associate=" + addr, null, function() { alert("Your association request has been handled. Please check your inbox!")})
    return false;
}

function delAlt(addr) {
    GetAsync("/api/preferences.lua?removealt=" + addr, null, function() { location.href = location.href; })
    return false;
}