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

var svgNS = "http://www.w3.org/2000/svg"


function fastIntersect(x,y) {
    var a = x.getBoundingClientRect()
    var b = y.getBoundingClientRect()
    return !(b.left > a.right
        || b.right < a.left
        || b.top > a.bottom
        || b.bottom < a.top);
}
function definitely_intersecting(a, b, aangle,gw, w,h) {
    var r1 = a.getBoundingClientRect();
    var xangle = 0
    var r2
    if (aangle != null) {
        xangle = parseFloat(b.hasAttribute("transform") ? b.getAttribute("transform").match(/(-?\d+\.?\d*)/)[1] : "0")
        b.setAttribute("transform", "rotate(" + -xangle + ")")
        r2 = b.getBoundingClientRect();
        b.setAttribute("transform", "rotate(" + xangle + ")")
    } else {
        aangle = 0
        r2 = b.getBoundingClientRect();
    }
    
    a = {
        w: r1.width+2,
        h: r1.height+2,
        x: r1.left + r1.width/2 - gw.left,
        y: h - r1.top + (r1.height/2) - gw.top,
        theta: aangle,
        otheta: 0
    }
    
    b = {
        w: r2.width+2,
        h: r2.height+2,
        x: r2.left + r2.width/2 - gw.left,
        y: h - r2.top + (r2.height/2) - gw.top,
        theta: xangle
    }
    //alert(b.theta + ":" + a.theta + "::" + a.otheta)
    var a_w2, a_h2, b_w2, b_h2;
    a_w2 = a.w/2
    a_h2 = a.h/2
    b_w2 = b.w/2
    b_h2 = b.h/2

    var torad = Math.PI/180
    b_xc_tmp = (b.x+b_w2) - (a.x+a_w2)
    b_yc_tmp = (b.y+b_h2) - (a.y+a_h2)
    

    c = Math.cos(-a.theta*torad)
    s = Math.sin(-a.theta*torad)

    b_xc = b_xc_tmp*c - b_yc_tmp*s
    b_yc = b_yc_tmp*c + b_xc_tmp*s

    theta = b.theta - a.theta
    c = Math.cos(theta*torad)
    s = Math.sin(theta*torad)

    b_x1 = b_w2*c - b_h2*s
    b_y1 = b_w2*s + b_h2*c
    b_x2 = b_w2*c + b_h2*s
    b_y2 = b_w2*s - b_h2*c
    b_xmin = b_xc + Math.min(b_x1, b_x2, -b_x1, -b_x2)
    b_xmax = b_xc + Math.max(b_x1, b_x2, -b_x1, -b_x2)
    b_ymin = b_yc + Math.min(b_y1, b_y2, -b_y1, -b_y2)
    b_ymax = b_yc + Math.max(b_y1, b_y2, -b_y1, -b_y2)
    var is = ((b_xmax < -a_w2) || (b_xmin > a_w2) || (b_ymax < -a_h2) || (b_ymin > a_h2))
    //alert(JSON.stringify([b_xmax < -a_w2 ,b_xmin > a_w2, b_ymax < -a_h2, b_ymin > a_h2 ]))
    //alert(is)
    return !is
}

function makeWord(word, size) {
    var txt = document.createElementNS(svgNS, "text");
    txt.setAttribute("font-size", size + "px")
    txt.setAttribute("x", "0")
    txt.setAttribute("y", "40")
    txt.setAttribute("class", "cloudword")
    txt.setAttribute("onclick", "do_search(\"" + word + "\", 30)")
    txt.textContent = word
    return txt
}

function wordCloud(hash, width, height) {
    var total = 0
    var boxes = []
    var space = width * height
    for (i in hash) {
        total += Math.sqrt(hash[i])
    }
    var hashSorted = []
    for (word in hash) hashSorted.push(word)
    hashSorted = hashSorted.sort(function(a,b) { return hash[a] > hash[b] })
    var svg = document.createElementNS(svgNS, "svg");
    document.body.appendChild(svg)
    svg.setAttribute("width",  width)
    svg.setAttribute("height",  height)
    svg.setAttribute("class", "wordcloud")
    for (var n in hashSorted) {
        var word = hashSorted[n]
        var size = 0;
        var expected_area = ( Math.sqrt(hash[word]) / total ) * (space*1.25)
        console.log(expected_area)
        
        var txt = document.createElementNS(svgNS, "text");
        txt.textContent = word
        txt.setAttribute("font-size", "100px")
        svg.appendChild(txt)
        
        w = txt.getBoundingClientRect();
        
        for (var s = 100; s > 0; s-=1) {
                        
            var area = w.width * w.height * ( (s/100)*(s/100) );
            if (area <= expected_area ) {
                //alert(area + ":" + expected_area + ":" + s)
                size = s;
                svg.removeChild(txt)
                break
            }
        }
        
        
        
        var theta = 50;
        var prop = height/width
        var popped = false
        
        var angle = 0;
        
        // Try with random placement
        var gw = svg.getBoundingClientRect()
        var w
        
        
        // Spiral time!
        var txt = makeWord(word, ss)
        svg.appendChild(txt)
        if (!popped) {
            for (var ss = size; ss > 5; ss -= 2) {
               // alert(ss)
                if (popped) {
                    break
                }
                txt.setAttribute("font-size", ss + "px")
                var theta = 0
                var increment = 2*Math.PI/5;       
                while( theta < 40*Math.PI) {
                    angle = (Math.random() * 120) - 60
                    //txt.setAttribute("transform", "rotate(0)")//rotate(" + angle + ", " + nx + "," + ny + ")")
                    var nx = (width/2) - (w.width/2) + ((theta *2 * Math.cos(theta)))
                    var ny = (height/2) - ((theta *2*Math.sin(theta))*prop) + (w.height/2)
                    txt.setAttribute("x", nx)
                    txt.setAttribute("y", ny)
                    theta = theta + increment;
                    increment *= 0.97
                    if (increment < 0.05) {
                        increment = 0.05
                    }
                    var it = false
                    var w = txt.getBoundingClientRect()
                    var y = {}
                    y.bottom = w.bottom - gw.top
                    y.top = w.top - gw.top
                    y.left = w.left - gw.left
                    y.right = w.right - gw.left
                    if (y.bottom > height || ny < 8 || nx < 8 || y.right > width) {
                        //alert(JSON.stringify([y.bottom, y.top, y.left, y.right]))
                        break
                    }
                    for (var b in boxes) {
                        //if (definitely_intersecting(txt, boxes[b], null, gw, width, height)) {
                        if (fastIntersect(txt, boxes[b])) {
                            it = true
                            break
                        }
                    }
                    if (it == false) {
                        popped = true
                        break
                    } 
                }
            }
        }
        
        
        
        if (popped) {
            var color = 'hsl('+ Math.random()*360 +', 40%, 50%)';
            txt.setAttribute("fill", color)
            boxes.push(txt)
        } else {
            //alert("Could not add " + word)
            svg.removeChild(txt)
        }
        
    }
    document.body.removeChild(svg)
    return svg
}