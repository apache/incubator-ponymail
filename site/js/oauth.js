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

function GetAsync(theUrl, xstate, callback) {
    var xmlHttp = null;
    if (window.XMLHttpRequest) {
        xmlHttp = new XMLHttpRequest();
    } else {
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlHttp.open("GET", theUrl, true);
    xmlHttp.send(null);
    xmlHttp.onreadystatechange = function(state) {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            if (callback) {
                try {
                    callback(JSON.parse(xmlHttp.responseText), xstate);
                } catch (e) {
                    callback(JSON.parse(xmlHttp.responseText), xstate)
                }
            }

        }
        if (xmlHttp.readyState == 4 && xmlHttp.status == 404) {
            alert("404'ed: " + theUrl)
        }
    }
}

function oauthPortal(key) {
    var ot = pm_config.oauth[key]
    var state = parseInt(Math.random()*1000000000) + '' + parseInt(Math.random()*1000000000)
    location.href = ot.oauth_portal + "?state=" + state + "&redirect_uri=" + escape(window.location + "?key=" + key + "&state=" + state)
}


function parseOauthResponse(json) {
    if (json.okay) {
        location.href = "/"
    }
}

function oauthOptions() {
    var oobj = document.getElementById('oauthtypes')
    oobj.innerHTML = ""
    for (var key in pm_config.oauth) {
        var ot = pm_config.oauth[key]
        var img = document.createElement('img')
        img.setAttribute("src", "images/oauth_" + key + ".png")
        img.setAttribute("title", "Log on with " + ot.name)
        img.setAttribute("onclick", "oauthPortal('" + key + "');")
        img.style.cursor = "pointer"
        oobj.appendChild(img)
        oobj.appendChild(document.createElement('br'))
        oobj.appendChild(document.createTextNode(' '))
        oobj.appendChild(document.createElement('br'))
    }
    
    if (pm_config.persona.enabled) {
        var img = document.createElement('img')
        img.setAttribute("src", "images/persona.png")
        img.setAttribute("title", "Log on with persona")
        img.setAttribute("onclick", "navigator.id.request();")
        img.style.cursor = "pointer"
        oobj.appendChild(img)
        oobj.appendChild(document.createElement('br'))
        oobj.appendChild(document.createTextNode(' '))
        oobj.appendChild(document.createElement('br'))
    }
}

function oauthWelcome(args) {
    if (args && args.length > 64) {
        var key = args.match(/key=([a-z]+)/i)
        if (key) {
            key = key[1]
        }
        if (key && key.length > 0 && pm_config.oauth[key]) {
            document.getElementById('oauthtypes').innerHTML = "Logging you in, hang on..!"
            GetAsync("/api/oauth.lua?" + args + "&oauth_token=" + pm_config.oauth[key].oauth_url, {}, parseOauthResponse)
        } else {
            alert("Key missing or invalid! " + key)
        }
    } else {
        oauthOptions()
    }
}