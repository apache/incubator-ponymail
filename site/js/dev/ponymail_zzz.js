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
            
            
            var thread = document.getElementById('thread_' + current_thread.toString().replace(/@<.+>/, ""))
            if (thread) {
                    // Close one thread?
                if (thread.style.display != 'none') {
                    toggleEmails_threaded(current_thread, true)
                } else {
                    // Close all threads?
                    kiddos = []
                    traverseThread(document.body, 'thread_', 'DIV')
                    for (var i in kiddos) {
                        var id = kiddos[i].getAttribute('id').match(/thread_(.+)/)[1]
                        toggleEmails_threaded(id, true)
                    }
                }
            }
        }
    }
}

var footer = document.createElement('footer')
footer.setAttribute("class", 'footer')
footer.style.height = "32px"
footer.style.width = "90%"
var fd = document.createElement('div')
fd.setAttribute("class", "container")
fd.innerHTML = "<p class='muted' style='text-align: center;'>Powered by <a href='https://github.com/Humbedooh/ponymail'>Pony Mail v/0.1a</a>.</p>"
footer.appendChild(fd)
document.body.appendChild(footer)

window.addEventListener("keyup", dealWithKeyboard, false);
window.onpopstate = function(event) {
    getListInfo(null, document.location.search.substr(1), true)
}
