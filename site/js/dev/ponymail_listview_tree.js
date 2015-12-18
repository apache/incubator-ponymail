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


// loadList_treeview: Load a list as a treeview object, grouped by threads
function loadList_treeview(mjson, limit, start, deep) {
    if (typeof(window.localStorage) !== "undefined") {
        var th = window.localStorage.getItem("pm_theme")
        if (th) {
            prefs.theme = th
        }
    }
    if (prefs.theme && prefs.theme == "social") {
        d_ppp = 10
    } else {
        d_ppp = 15
    }
    open_emails = []
    limit = limit ? limit : d_ppp;
    var fjson = mjson ? ('emails' in mjson && isArray(mjson.emails) ? mjson.emails.sort(function(a, b) {
        return b.epoch - a.epoch
    }) : []) : current_flat_json
    current_flat_json = fjson
    
    var json = mjson ? sortIt(mjson.thread_struct) : current_thread_json
    current_thread_json = json
    
    var now = new Date().getTime() / 1000
    nest = '<ul class="list-group">'
    if (!start) {
        start = 0
    }
    for (var i = start; i < json.length; i++) {
        if (i >= (start + limit)) {
            break
        }
        var eml = findEml(json[i].tid)
        if (eml && eml.subject.length > 90) {
            eml.subject = eml.subject.substr(0, 90) + "..."
        }
        var subs = countSubs(json[i])
        var people = countParts(json[i])
        var latest = countNewest(json[i])

        var ls = 'default'
        if (subs > 0) {
            ls = 'primary'
        }
        var lp = 'success'
        if (people > 1) {
            lp = 'success'
        }
        var ld = 'default'
        var ti = ''
        if (latest > (now - 86400)) {
            ld = 'warning'
            ti = "Has activity in the past 24 hours"
        }
        var d = ''
        var estyle = ""
        var qdeep = document.getElementById('checkall') ? document.getElementById('checkall').checked : false
        if ((qdeep || deep || global_deep) && current_query.length > 0) {
            eml.list = eml.list ? eml.list : eml.list_raw // Sometimes, .list isn't available
            var elist = eml.list.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            var elist2 = elist
            if (pm_config.shortLists) {
                elist = elist.replace(/\.[^.]+\.[^.]+$/, "")
            }
            d = "<a href='list.html?" + elist2 + "'><label class='label label-warning' style='width: 150px;'>" + elist + "</label></a> &nbsp;"
            if (eml.subject.length > 75) {
                eml.subject = eml.subject.substr(0, 75) + "..."
            }
        }
        var subject = eml.subject.replace(/</mg, "&lt;")
        var mdate = new Date(latest * 1000)
        
        mdate = formatDate(mdate)
        var pds = people > 1 ? "visible" : "hidden"
        
        // style based on view before or not??
        if (typeof(window.localStorage) !== "undefined") {
            if (! window.localStorage.getItem("viewed_" + eml.id) || (subs > 0 && parseInt(window.localStorage.getItem("viewed_" + eml.id)) < latest )){
                estyle = "font-weight: bold;"
            }
        }
        if (prefs.theme && prefs.theme == "social") {
            var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
            from = from.replace(/\"/g, "")
            nest += "<li class='list-group-item' style='min-height: 64px; float: left; width:100%;'><div style='min-height: 64px;'><div style='width:100%; float: left; padding-left: 70px;'>" +
                    d +
                    "<a style='" + estyle + "' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' onclick='this.style=\"\"; latestEmailInThread = " +
                    latest +
                    "; toggleEmails_treeview(" + i + "); latestEmailInThread = 0; return false;'>" +
                    subject +
                    "</a> <label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" +
                    mdate +
                    "</label><label id='subs_" + i + "' style='float: right; margin-right: 8px; width: 88px;' class='label label-" + ls + "'> " +
                    "<span class='glyphicon glyphicon-envelope'> </span> " + subs + " " + (subs != 1 ? "replies" : "reply") + "</label> &nbsp; " +
                    "<label style='visibility:" + pds + "; float: right; margin-right: 8px;' id='people_"+i+"' class='label label-" + lp +
                    "'> <span class='glyphicon glyphicon-user'> </span> " + people + " people</label>" +
                    "<br/>By " + from + "</div>" 
                    
                    
            nest += "<div style='width: 100%; float: left; min-height: 64px;' id='bubble_"+i+"'>" +
                    "<div style='width: 64px; float: left;'>" +
                    "<img src='https://secure.gravatar.com/avatar/" + eml.gravatar + ".jpg?s=48&r=g&d=mm'/>" +
                    "</div>" +
                    "<div class='bubble-topic' style='float: left; width:calc(100% - 70px);'>"+ json[i].body.replace(/</g, "&lt;") + "<br/>" +
                    "<a class='label label-info' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' style='font-size: 85%; padding: 2px;' onclick='latestEmailInThread = " +
                    latest +
                    "; toggleEmails_treeview(" + i + "); latestEmailInThread = 0; return false;'>Read more..</a>" +
                    "</div>" +
                    "</div>" +
                    "<div id='thread_" + i + "' style='display:none';></div></div></li>"
        } else {
            nest += "<li class='list-group-item'>" +
                    "<div style='width: calc(100% - 300px); white-space:nowrap; overflow: hidden;'>" +
                    d + "<a style='overflow:hide;" + estyle + "' href='/thread.html/" + (pm_config.shortLinks ? shortenID(eml.id) : eml.id)  + "' onclick='this.style=\"\"; latestEmailInThread = " + latest+ "; toggleEmails_treeview(" + i + "); latestEmailInThread = 0; return false;'>" + subject +
                    "</div></a> <div style='float: right;position:absolute;right:4px;top:12px;';><a style='float: right; opacity: 0.75; margin-left: 2px; margin-top: -3px;' href='/api/atom.lua?mid=" + eml.id + "'><img src='/images/atom.png' title='Subscribe to this thread as an atom feed'/></a><label style='float: right; width: 110px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate + "</label><label id='subs_" + i + "' style='float: right; margin-right: 8px; width: 88px;' class='label label-" + ls + "'> <span class='glyphicon glyphicon-envelope'> </span> " + subs + " " + (subs != 1 ? "replies" : "reply") + "</label> &nbsp; " + "<label style='visibility:" + pds + "; float: right; margin-right: 8px;' id='people_"+i+"' class='label label-" + lp + "'> <span class='glyphicon glyphicon-user'> </span> " + people + " people</label></div>" + "<div id='thread_treeview_" + i + "' style='display:none';></div></li>"
        }
    }
    nest += "</ul>"


    var bulk = document.getElementById('emails')
    bulk.innerHTML = ""
    
    // Top nav buttons
    var tnav = "<div style='float: left; width: 100%; height: 50px;'>"
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        tnav += '<div style="width: 40%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_treeview(false, ' + d_ppp + ', ' + nstart + ');">Show previous '+d_ppp+'</a> &nbsp </div>'
    } else {
        tnav += '<div style="width: 40%; float: left;">&nbsp;</div>'
    }
    
    if (json.length > (start + limit)) {
        remain = Math.min(d_ppp, json.length - (start + limit))
        tnav += '<div style="width: 40%; float: right;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_treeview(false, ' + d_ppp + ', ' + (start + d_ppp) + ');">Show next ' + remain + '</a></div>'
    }
    tnav += "</div><br/><br>"
    
    // Emails
    bulk.innerHTML += tnav + nest
    if (prefs.hideStats == 'yes') {
        bulk.parentNode.setAttribute("class", "well col-md-10 col-lg-10")
    } else {
        bulk.parentNode.setAttribute("class", "well col-md-10 col-lg-7")
    }
    var dp = (deep || (global_deep && current_query.length > 0)) ? 'true' : 'false'
    
    
    // Bottom nav buttons
    if (start > 0) {
        var nstart = Math.max(0, start - limit)
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: left;" class="btn btn-success" onclick="loadList_treeview(false, ' + d_ppp + ', ' + nstart + ');">Show previous '+d_ppp+'</a> &nbsp </div>'
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    
    if (login && login.credentials) {
        bulk.innerHTML += '<div style="width: 33%; float: left; text-align: center;"><a href="javascript:void(0);" style="margin: 0 auto" class="btn btn-danger" onclick="compose(null, \'' + xlist + '\');">Start a new thread</a></div>'
    } else {
        bulk.innerHTML += '<div style="width: 33%; float: left;">&nbsp;</div>'
    }
    
    if (json.length > (start + limit)) {
        remain = Math.min(d_ppp, json.length - (start + limit))
        bulk.innerHTML += '<div style="width: 33%; float: left;"><a href="javascript:void(0);" style="float: right;" class="btn btn-success" onclick="loadList_treeview(false, ' + 15 + ', ' + (start + 15) + ');">Show next ' + remain + '</a></div>'
    }

}



function buildTreeview(nesting, list, obj, pbigger) {
    var now = new Date().getTime() / 1000
    for (var i in list) {
        var nvi = ""
        for (var z = 1; z <= nesting; z++) {
            if (z == nesting) {
                if (i == (list.length -1)) {
                    nvi += "<img src='/images/treeview_lastchild.png' style='margin-top: -5px;'/>"
                } else {
                    nvi += "<img src='/images/treeview_child.png' style='margin-top: -5px;'/>"
                }
            } else if (pbigger[z+1]) {
                nvi += "<img src='/images/treeview_parent.png' style='margin-top: -5px;'/>"
            } else {
                nvi += "<img src='/images/treeview_none.png' style='margin-top: -5px;'/>"
            }
        }
        
        
        var el = list[i]
        var friendly_id = (el.mid ? el.mid : el.tid).toString().replace(/@<.+>/, "")
        
        var node = document.createElement('div')
        node.setAttribute("id", "thread_parent_" + friendly_id)
        var nest = ""
        var eml = findEml(el.tid)
        if (eml && eml.subject.length > 90) {
            eml.subject = eml.subject.substr(0, 90) + "..."
        }
        var subs = countSubs(el)
        var people = countParts(el)
        var latest = countNewest(el)

        var ls = 'default'
        if (subs > 0) {
            ls = 'primary'
        }
        var lp = 'success'
        if (people > 1) {
            lp = 'success'
        }
        var ld = 'default'
        var ti = ''
        if (latest > (now - 86400)) {
            ld = 'warning'
            ti = "Has activity in the past 24 hours"
        }
        var d = ''
        var estyle = ""
        var qdeep = document.getElementById('checkall') ? document.getElementById('checkall').checked : false
        if ((qdeep || global_deep) && current_query.length > 0) {
            eml.list = eml.list ? eml.list : eml.list_raw // Sometimes, .list isn't available
            var elist = eml.list.replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            var elist2 = elist
            if (pm_config.shortLists) {
                elist = elist.replace(/\.[^.]+\.[^.]+$/, "")
            }
            d = "<a href='list.html?" + elist2 + "'><label class='label label-warning' style='width: 150px;'>" + elist + "</label></a> &nbsp;"
            if (eml.subject.length > 75) {
                eml.subject = eml.subject.substr(0, 75) + "..."
            }
        }
        var subject = eml.subject.replace(/</mg, "&lt;")
        var mdate = new Date(latest * 1000)
        
        mdate = formatDate(mdate)
        var pds = people > 1 ? "visible" : "hidden"
        
        ld = 'default'
        var ti = ''
        if (eml.epoch > (now - 86400)) {
            ld = 'warning'
            ti = "Has activity in the past 24 hours"
        }
        var d = ""
        var qdeep = document.getElementById('checkall') ? document.getElementById('checkall').checked : false
        if (qdeep || global_deep && typeof eml.list != undefined && eml.list != null) {
            var elist = (eml.list ? eml.list : "").replace(/[<>]/g, "").replace(/^([^.]+)\./, "$1@")
            var elist2 = elist
            if (pm_config.shortLists) {
                elist = elist.replace(/\.[^.]+\.[^.]+$/, "")
            }
            var d = "<a href='list.html?" + elist2 + "'><label class='label label-warning' style='width: 150px;'>" + elist + "</label></a> &nbsp;"
            if (eml.subject.length > 75) {
                eml.subject = eml.subject.substr(0, 75) + "..."
            }
        }
        mdate = new Date(eml.epoch * 1000)
        mdate = formatDate(mdate)
            
        var subject = eml.subject.replace(/</mg, "&lt;")
        var from = eml.from.replace(/<.*>/, "").length > 0 ? eml.from.replace(/<.*>/, "") : eml.from.replace(/[<>]+/g, "")
        from = from.replace(/\"/g, "")
        
        // style based on view before or not??
        var estyle = ""
        if (typeof(window.localStorage) !== "undefined") {
            if (! window.localStorage.getItem("viewed_" + eml.id) ){
                estyle = "font-weight: bold;"
            }
        }
        var at = ""
        if (eml.attachments && eml.attachments > 0) {
            at = "<img src='/images/attachment.png' title='" + eml.attachments + " file(s) attached' style='title='This email has attachments'/> "
        }
        nest += "<li class='list-group-item' style='height: 38px !important; border: none; padding: 0px; margin: 0px; padding-top: 5px; padding-bottom: -5px;'>" +
                nvi + at + "<span style='padding-top: 4px;'><a style='" + estyle + "' href='/thread.html/" +
                (pm_config.shortLinks ? shortenID(eml.id) : eml.id) + "' onclick='this.style=\"padding-top: 4px; padding-bottom: -4px; \"; loadEmails_flat(\"" +
                el.tid + "\", false, \""+friendly_id+"\"); return false;'>" + subject + "</a></span> "+
                "<label style='width: 140px;' class='label label-info'>" + from + "</label>" +
                "<label style='float: right; width: 110px; margin-top: 6px;' class='label label-" + ld + "' title='" + ti + "'>" + mdate +
                "</label><div id='thread_" + friendly_id + "' style='display: none;'></div></li>"
        node.innerHTML = nest
        // Guard against double post errors from time travel
        if (!treeview_guard[friendly_id]) {
            obj.appendChild(node)
        }
        treeview_guard[friendly_id] = true
        
        if (el.children && el.children.length > 0) {
            var npbigger = pbigger.slice()
            npbigger.push(i < (list.length-1))
            buildTreeview(nesting+1, el.children, obj, npbigger)
        }
    }
}




// toggleEmails_treeview: Open up a treeview display of a topic
function toggleEmails_treeview(id, close, toverride) {
    current_thread_mids = {}
    current_email_msgs = []
    var thread = document.getElementById('thread_treeview_' + id.toString().replace(/@<.+>/, ""))
    if (thread) {
        current_thread = id
        if (typeof(window.localStorage) !== "undefined") {
            var epoch = latestEmailInThread + "!"
            var xx = window.localStorage.getItem("viewed_" + current_thread_json[id].tid)
            if (xx) {
                var yy = parseInt(xx)
                if (yy >= parseInt(latestEmailInThread)) {
                    epoch = yy
                }
            }
            window.localStorage.setItem("viewed_" + current_thread_json[id].tid, epoch)
        }
        
        thread.style.display = (thread.style.display == 'none') ? 'block' : 'none';
        var helper = document.getElementById('helper_' + id)
        if (!helper) {
            helper = document.createElement('div')
            helper.setAttribute("id", "helper_" + id)
            helper.style.padding = "10px"
            thread.parentNode.insertBefore(helper, thread)
        }

        // time travel magic!
        helper.innerHTML = ""
        thread.innerHTML = ""
        var ml = findEml(current_thread_json[id].tid)
        if (!current_thread_json[id].magic && ml.irt && ml.irt.length > 0) {
            helper.innerHTML += "<p id='magic_"+id+"'><i><b>Note:</b> You are viewing a search result/aggregation in threaded mode. Only results matching your keywords or dates are shown, which may distort the thread. For the best result, go to the specific list and view the full thread there, or view your search results in flat mode. Or we can <a href='javascript:void(0);' onclick='timeTravelList("+id+")'>do some magic for you</a>.</i></p>"
            var btn = document.createElement('a')
            btn.setAttribute("href", "javascript:void(0);")
            btn.setAttribute("class", "btn btn-success")
            btn.setAttribute("onclick", "prefs.displayMode='flat'; buildPage();")
            btn.style.marginRight = "10px"
            btn.innerHTML = "View results in flat mode instead"
            helper.appendChild(btn)
        } else if (!current_thread_json[id].magic) {
            helper.innerHTML += "<p id='magic_"+id+"'></p>"
        }

        if (close == true) {
            thread.style.display = 'none'
        }
        if (thread.style.display == 'none') {
            helper.style.display = 'none'
            prefs.groupBy = 'treeview' // hack for now
            thread.innerHTML = ""
            if (document.getElementById('bubble_' + id)) document.getElementById('bubble_' + id).style.display = 'block'
            return
        } else {
            helper.style.display = 'block'
            if (document.getElementById('bubble_' + id)) document.getElementById('bubble_' + id).style.display = 'none'
        }
        if (!open_emails[id]) {
            open_emails[id] = true

        }
        
        // build treeview, set guard
        var nesting = 0
        treeview_guard = {}
        var html = buildTreeview(nesting, [current_thread_json[id]], thread, [true])
        
        
    }
}
