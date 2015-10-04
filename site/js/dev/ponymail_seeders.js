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

// seedGetListInfo: Callback that seeds the list index and sets up account stuff
function seedGetListInfo(json, state) {
    all_lists = json.lists
    if (typeof json.preferences != undefined && json.preferences) {
        prefs = json.preferences
    }
    if (typeof json.login != undefined && json.login) {
        login = json.login
        if (login.credentials) {
            setupUser(login)
        }
    }
    getListInfo(state.l, state.x, state.n)
}

// seedPrefs: get prefs/login and call something else
function seedPrefs(json, state) {
    if (typeof json.preferences != undefined && json.preferences) {
        prefs = json.preferences
    }
    if (typeof json.login != undefined && json.login) {
        login = json.login
        if (login.credentials) {
            setupUser(login)
        }
    }
    if (state && state.docall) {
        GetAsync(state.docall[0], null, state.docall[1])
    }
}
// preGetListInfo: Callback that fetches preferences and sets up list data
function preGetListInfo(list, xdomain, nopush) {
    GetAsync("/api/preferences.lua", {
        l: list,
        x: xdomain,
        n: nopush
    }, seedGetListInfo)
}

