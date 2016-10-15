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

// Callback func for favorite/forget
// this just alerts and reverses the fav button
function favCallback(json, state) {
    var fvb = document.getElementById('favbtn')
    if (state[0]) {
        alert(state[1] + " added to favorites!")
        // fav button? set it to a 'remove' button
        if (fvb) {
            fvb.innerHTML = ' &nbsp; <a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-default" onclick="favorite(false, \'' + xlist + '\');">Remove from favorites</a>'
        }
    } else {
        alert(state[1] + " removed from favorites!")
        // remove button exists? set it to a 'fav this' button
        if (fvb) {
            fvb.innerHTML = ' &nbsp; <a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-info" onclick="favorite(true, \'' + xlist + '\');">Add list to favorites</a>'
        }
    }
}

// Favorite/forget call: either sub or unsub a list from favorites
function favorite(sub, list) {
    // favorite?
    if (sub) {
        GetAsync("/api/preferences.lua?addfav="+list, [sub,list], favCallback)
    }
    // forget?
    else {
        GetAsync("/api/preferences.lua?remfav="+list, [sub,list], favCallback)
    }
    
}
