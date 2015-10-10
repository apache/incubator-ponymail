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


// toggleEmail: Fetch a list of emails from an ML in a specific year/month
function toggleEmail(year, mo, nopush) {
    global_deep = false
    current_query = ""
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var domain = arr[1]
    var s = year + "-" + mo
    var e = s
    if (year && mo) {
        kiddos = []
        traverseThread(document.getElementById('datepicker'), 'calmonth', 'LABEL')
        for (var n in kiddos) {
            if (kiddos[n].getAttribute("id") == ("calmonth_" + year + "-" + mo)) {
                kiddos[n].setAttribute("class", "label label-info")
            } else {
                kiddos[n].setAttribute("class", "label label-default label-hover")
            }
        }
    }
    
    
    var xmo = mo ? parseInt(mo).toString() : ""
    if (mo.length > 0 && mo <= 9) {
        xmo = '0' + xmo
    }
    if (!nopush) window.history.pushState({}, "", "list.html?" + xlist + ":" + year + '-' + xmo);
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&s=" + s + "&e=" + e, null, buildPage)
    document.getElementById('listtitle').innerHTML = xlist + " (" + months[mo - 1] + ", " + year + ")"
}



// search: run a search
function search(q, d, nopush, all) {
    keywords = q
    current_retention = d
    current_query = q
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var olist = listname
    var domain = arr[1]
    if (document.getElementById('checkall')) {
        all = document.getElementById('checkall').checked
    }
    global_deep = false
    if (all == true) {
        listname = "*"
        global_deep = true
    }
    
    clearCalendarHover()
    if (!nopush) window.history.pushState({}, "", "list.html?" + listname + "@" + domain + ":" + d + ":" + q);
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&q=" + q + "&d=" + d, null, buildPage)
    document.getElementById('listtitle').innerHTML = listname + "@" + domain + " (Quick Search, last " + d + " days) <a class='btn btn-warning' href='javascript:void(0);' onclick='getListInfo(xlist)'>Clear filters</a>"
    xlist = olist + "@" + domain
    return false;
}

// searchAll: run a deep search of all lists
function searchAll(q, dfrom, dto, from, subject, age) {
    keywords = q
    current_retention = parseInt(dto)
    current_query = q
    global_deep = true
    var url = "/api/stats.lua?list=*&domain=*&q=" + escape(q) + "&dfrom=" + escape(dfrom)+ "&dto=" + escape(dto)
    if (from) {
        url += "&header_from=" + escape(from)
        current_query += " FROM:" + escape('"' + from + '"')
    }
    if (subject) {
        url += "&header_subject=" + escape(subject)
        current_query += " SUBJECT:" + escape('"' + subject + '"')
    }
    GetAsync(url, {
        deep: true
    }, buildPage)
    document.getElementById('listtitle').innerHTML = "Deep Search, " + dto + " day view <a class='btn btn-warning' href='javascript:void(0);' onclick='getListInfo(xlist)'>Clear filters</a>"
    clearCalendarHover()
    return false;
}

// do_search: run a search and update textboxes
function do_search(q, d, nopush, all) {
    document.getElementById('q').value = q
    document.getElementById('aq').value = q
    current_retention = d ? d : 30
    current_query = q
    var arr = xlist.split('@', 2)
    var listname = arr[0]
    var domain = arr[1]
    if (!nopush) window.history.pushState({}, "", "list.html?" + xlist + ":" + d + ":" + q);
    if (global_deep == true) {
        listname = "*"
        domain = "*"
    }
    GetAsync("/api/stats.lua?list=" + listname + "&domain=" + domain + "&q=" + q + "&d=" + d, null, buildPage)
    document.getElementById('listtitle').innerHTML = listname + '@' + domain + " (Quick Search, last " + d + " days) <a class='btn btn-warning' href='javascript:void(0);' onclick='getListInfo(xlist)'>Clear filters</a>"
    clearCalendarHover()
    return false;
}


function addSearchEngine() {
    window.external.AddSearchProvider("/api/websearch.lua?" + gxdomain)
}


function addSearchBar() {
    var h = document.getElementsByTagName('head')[0]
    var sl = document.createElement('link')
    sl.setAttribute("rel", "search")
    sl.setAttribute("type", "application/opensearchdescription+xml")
    sl.setAttribute("href", "/api/websearch.lua?" + gxdomain)
    sl.setAttribute("title", "PonyMail: " + gxdomain + " mailing lists")
    h.appendChild(sl)
}
