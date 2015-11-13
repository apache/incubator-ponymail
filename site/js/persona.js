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

// We need to fetch the account data, so we can determine how to set up the
// persona stuff here
GetAsync("/api/preferences.lua", null, setupPersona)


function setupPersona(json) {
  
  navigator.id.watch({
    loggedInUser: json.login ? json.login.email : 'not@logged.in',
    onlogin: function(assertion) {
      $.ajax({ 
        type: 'POST',
        url: '/api/oauth.lua?mode=persona',
        data: {assertion: assertion},
        success: function(res, status, xhr) { location.href = "/"; },
        error: function(xhr, status, err) {
          navigator.id.logout();
          alert("Login failure: " + err);
        }
      });
    },
    onlogout: function() {
      $.ajax({
        type: 'POST',
        url: '/api/persona.lua?mode=logout', // This does nothing atm!
        success: function(res, status, xhr) { }
      });
    }
  });
}