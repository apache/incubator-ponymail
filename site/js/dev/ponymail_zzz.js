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


// dealWithKeyboard: Handles what happens when you hit the escape key
function dealWithKeyboard(e) {
    if (e.keyCode == 27) {
        if (document.getElementById('splash').style.display == 'block') {
            document.getElementById('splash').style.display = "none"
            saveDraft()
        } else if (location.href.search(/list\.html/) != -1) { // should only work for the list view
            
            // If datepicker popup is shown, hide it on escape
            var thread = document.getElementById('thread_' + current_thread.toString().replace(/@<.+>/, ""))
            if (document.getElementById('datepicker_popup') && document.getElementById('datepicker_popup').style.display == "block") {
                document.getElementById('datepicker_popup').style.display = "none"
            }
            // otherwise, collapse a thread?
            else if (thread) {
                    // Close one thread?
                if (thread.style.display == 'block') {
                    toggleEmails_threaded(current_thread, true)
                } else {
                    // Close all threads?
                    kiddos = []
                    traverseThread(document.body, '(thread|helper)_', 'DIV')
                    for (var i in kiddos) {
                        kiddos[i].style.display = 'none';
                    }
                }
            }
        }
    }
}


// Add Pony Mail powered-by footer
var footer = document.createElement('footer')
footer.setAttribute("class", 'footer')
footer.style.height = "32px"
footer.style.width = "90%"
var fd = document.createElement('div')
fd.setAttribute("class", "container")
fd.innerHTML = "<p class='muted' style='text-align: center;'>Powered by <a href='https://github.com/quenda/ponymail'>Pony Mail v/" + _VERSION_ + "</a>.</p>"
footer.appendChild(fd)
document.body.appendChild(footer)

// Add listener for keys (mostly for escape key for hiding stuff)
window.addEventListener("keyup", dealWithKeyboard, false);

// Add listener for when URLs get popped from the browser history
window.onpopstate = function(event) {
    getListInfo(null, document.location.search.substr(1), true)
}
