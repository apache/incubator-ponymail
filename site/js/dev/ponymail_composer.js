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


function saveDraft() {
    // If the user was composing a new thread, let's save the contents (if any)
    // for next time
    if (document.getElementById('reply_body')) {
        if (sessionStorageAvailable) {
            if (composeType == "new") {
                window.sessionStorage.setItem("reply_body_" + xlist, document.getElementById('reply_body').value)
                window.sessionStorage.setItem("reply_subject_" + xlist, document.getElementById('reply_subject').value)
                window.sessionStorage.setItem("reply_list", xlist)
                composeType = ""
            // Likewise, if composing a reply, save it in case the user wants to revisit
            // the draft
            } else if (composeType == "reply" && current_reply_eid) {
                window.sessionStorage.setItem("reply_body_eid_" + current_reply_eid, document.getElementById('reply_body').value)
                window.sessionStorage.setItem("reply_subject_eid_" + current_reply_eid, document.getElementById('reply_subject').value)
                window.sessionStorage.setItem("reply_list_eid_", current_reply_eid)
                composeType = ""
            }
        }
    }
}

// hideComposer: hide the composer (splash) window
function hideComposer(evt, nosave) {
    var es = evt ? (evt.target || evt.srcElement) : null;
    if (!es || !es.getAttribute || !es.getAttribute("class") || (es.nodeName != 'A' && es.getAttribute("class").search(/label/) == -1))  {
        if (!nosave) {
            saveDraft()
        }
        document.getElementById('splash').style.display = "none"
    }
}




// sendEmail: send an email
function sendEmail(form) {
    
    // We have a bit of a mix here due to nginx not supporting multipart form data
    var of = []
    for (var k in compose_headers) {
        of.push(k + "=" + encodeURIComponent(compose_headers[k]))
    }
    // Push the subject and email body into the form data
    of.push("subject=" + encodeURIComponent(document.getElementById('reply_subject').value))
    of.push("body=" + encodeURIComponent(document.getElementById('reply_body').value))
    if (login && login.alternates && document.getElementById('alt')) {
        of.push("alt=" + encodeURIComponent(document.getElementById('alt').options[document.getElementById('alt').selectedIndex].value))
    }
        
    var request = new XMLHttpRequest();
    request.open("POST", URL_BASE + "/api/compose.lua");
    request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    request.send(of.join("&")) // send email as a POST string
    
    // Clear the draft stuff
    if (sessionStorageAvailable) {
        if (compose_headers.eid && compose_headers.eid.length > 0) {
            window.sessionStorage.removeItem("reply_subject_eid_" + compose_headers.eid)
            window.sessionStorage.removeItem("reply_body_eid_" + compose_headers.eid)
        }
        // Clear new draft too if need be
        if (composeType == "new") {
            window.sessionStorage.removeItem("reply_subject_" + xlist)
            window.sessionStorage.removeItem("reply_body_" + xlist)
        }
    }
    hideComposer(null, true)
    
    // Open the annoying popup dialogue :)
    popup("Email dispatched!", "Provided it passes spam checks, your email should be on its way to the mailing list now. <br/><b>Do note:</b> Some lists are always moderated, so your reply may be held for moderation for a while.", 5, "composer")
}


// compose: render a compose dialog for a reply to an email
function compose(eid, lid, type) {
    var email = null
    
    // If a list ID is supplied, try to work out which list,
    // and create a dummy email object, as we're not
    // replying to an email here.
    if (lid) {
        if (lid == "xlist") {
            if (xlist != null && xlist.length > 4) {
                lid = xlist;
            } else {
                lid = null
            }
        }
        if (lid != null) {
            email = {
                'message-id': "",
                'list': xlist.replace("@", "."),
                'subject': "",
                'body': "",
                'from': "",
                'date': ""
            }
            composeType = "new"
        }
    }
    else {
        composeType = "reply"
        email = saved_emails[eid]
    }
    
    // If we have a valid dummy email or are replying to an email, then...
    if (email != null) {
        var truncated = false
        if (login.credentials) {
            current_reply_eid = eid
            // Turn list-id into an actual email address to send to
            var listname = email['list'].replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            
            // Save some smtp headers for later
            compose_headers = {
                'eid': eid,
                'in-reply-to': email['message-id'],
                'references': email['message-id'] + " " + (email['references'] ? email['references'] : ""),
                'to': listname
            }
            
            // find the composer pane and show it
            var obj = document.getElementById('splash')
            obj.style.display = "block"
            
            // Set the right title of the pane
            what = "Reply to email"
            if (lid) {
                what = "Start a new thread"
            }
            obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here<big> &#x2612;</big></a></p><h3>" + what + " on " + listname + ":</h3>"
            
            // Append the previous email body, if such exists
            var area = document.createElement('textarea')
            area.style.width = "660px"
            area.style.height = "400px";
            area.setAttribute("id", "reply_body")
            var eml = "\n\nOn " + email.date + ", " + email.from.replace(/</mg, "&lt;") + " wrote: \n"
            email.body = email.body.replace(/\r/mg, "")
            eml += email.body.replace(/^([^\n]*)/mg, "&gt; $1")
            var eml_raw = "\n\nOn " + email.date + ", " + email.from + " wrote: \n"
            eml_raw += email.body.replace(/^([^\n]*)/mg, "> $1")

            var subject = "Re: " + email.subject.replace(/^Re:\s*/mg, "").replace(/</mg, "&lt;")
            
            // If it's a new email, scrap what we just did...gee, swell!
            if (lid) {
                eml = ""
                eml_raw = ""
                subject = ""
            }
            
            // Do we have alternate email addresses associated?
            // If so, let the user pick which to send from
            if (login.alternates && login.alternates.length !== undefined) {
                var alts = {}
                alts[login.credentials.email] = login.credentials.email
                for (var i in login.alternates) {
                    alts[login.alternates[i]] = login.alternates[i]
                }
                obj.appendChild(generateFormDivs('alt', 'Send as:', 'select', alts, login.credentials.email))
                obj.innerHTML += "<div>&nbsp;</div>"
            }
            // Set up a subject text field, populate it
            obj.appendChild(document.createTextNode('Subject: '))
            var txt = document.createElement('input')
            txt.setAttribute("type", "text")
            txt.setAttribute("style", "width: 500px;")
            txt.setAttribute("value",  subject)
            txt.setAttribute("id", "reply_subject")
            obj.appendChild(txt)

            // Set email body in HTML
            area.innerHTML = eml
            obj.appendChild(area)
            
            // Do we need to fetch cache here?
            if (sessionStorageAvailable) {
                if (composeType == "new" && window.sessionStorage.getItem("reply_subject_" + xlist)) {
                    area.innerHTML = window.sessionStorage.getItem("reply_body_" + xlist)
                    txt.value = window.sessionStorage.getItem("reply_subject_" + xlist)
                } else if (composeType == "reply" && window.sessionStorage.getItem("reply_subject_eid_" + eid)) {
                    area.innerHTML = window.sessionStorage.getItem("reply_body_eid_" + eid)
                    txt.value = window.sessionStorage.getItem("reply_subject_eid_" + eid)
                }
            }
            
            // submit button
            var btn = document.createElement('input')
            btn.setAttribute("type", "button")
            btn.setAttribute("class", "btn btn-success")
            btn.style.background = "#51A351 !important"
            btn.setAttribute("value", lid ? "Send email" : "Send reply")
            btn.setAttribute("onclick", "sendEmail(this.form)")
            obj.appendChild(btn)
            
            
            
            // reply-via-mua button
            if (!lid) {
                // construct long and winding mailto: link
                // Make sure we don't go over 16k chars in the body,
                // or we'll risk a namespace error in the link
                var eml_raw_short = eml_raw
                var N = 16000
                if (eml_raw_short.length > N) {
                    truncated = true
                    eml_raw_short = eml_raw_short.substring(0, N) + "\n[message truncated...]"
                }
                var xlink = 'mailto:' + listname + "?subject=" + encodeURIComponent(subject) + "&amp;In-Reply-To=" + encodeURIComponent(email['message-id']) + "&body=" + encodeURIComponent(eml_raw_short)
                
                // Make a button object
                var btn = document.createElement('input')
                btn.setAttribute("type", "button")
                btn.setAttribute("class", "btn btn-info")
                btn.style.float = "right"
                btn.style.background = "#51A351 !important"
                btn.setAttribute("value", "reply via your own mail client")
                btn.setAttribute("onclick", "location.href=\"" + xlink + "\";")
                obj.appendChild(btn)
            }
            
            
            // Focus on body or subject, depending on what's going on
            area.focus()
            if (composeType == "new" && txt.value.length == 0) {
                txt.focus()
            }
        // If not logged in, we don't show the UI, but we do show a "reply-via-MUA" button
        } else {
            // Same as above, construct mailto: link
            var eml_raw = "\n\nOn " + email.date + ", " + email.from + " wrote: \n"
            eml_raw += email.body.replace(/([^\r\n]*)/mg, "> $1")
            
            // Same as before, we have to truncate very large emails
            // or the URL to MUA won't work and throw a namespace error
            var eml_raw_short = eml_raw
            var N = 16000
            if (eml_raw_short.length > N) {
                truncated = true
                eml_raw_short = eml_raw_short.substring(0, N) + "\n[message truncated...]"
            }
            var subject = "Re: " + email.subject.replace(/^Re:\s*/mg, "").replace(/</mg, "&lt;")
            var link = 'mailto:' + email.list.replace(/[<>]/g, "").replace(/([^.]+)\./, "$1@") + "?subject=" + encodeURIComponent(subject) + "&In-Reply-To=" + encodeURIComponent(email['message-id']) + "&body=" + encodeURIComponent(eml_raw_short)
            
            // Get compose pane, show it
            var obj = document.getElementById('splash')
            obj.style.display = "block"
            obj.innerHTML = "<p style='text-align: right;'><a href='javascript:void(0);' onclick='hideComposer(event)' style='color: #FFF;'>Hit escape to close this window or click here<big> &#x2612;</big></a></p><h3>Reply to email:</h3>"
            
            // "sorry, but..." text + mua link
            obj.innerHTML += "<p>You need to be logged in to reply online.<br/>If you have a regular mail client, you can reply to this email by clicking below:<br/><h4><a style='color: #FFF;' class='btn btn-success' onclick='hideComposer(event);' href=\"" + link + "\">Reply via Mail Client</a></h4>"
        }
        // truncation warning for very long emails
        if (composeType == 'reply' && truncated) {
            obj.innerHTML += "<div><br/><i><b>Note: </b>In case of very long emails such as this, the body may be truncated if you choose to reply using your own mail client</i></div>"
        }
        
    } else {
        alert("I don't know which list to send an email to, sorry :(")
    }
}
