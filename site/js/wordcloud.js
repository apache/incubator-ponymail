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

function definitely_intersecting(a, b, aangle, gw) {
    var r1 = a.getBoundingClientRect();
    
    var xangle = parseFloat(b.getAttribute("transform").match(/(-?\d+\.?\d*)/)[1])
    b.setAttribute("transform", "rotate(0)")
    var r2 = b.getBoundingClientRect();
    b.setAttribute("transform", "rotate(" + xangle + ")")
    a = {
        w: r1.width,
        h: r1.height,
        x: r1.left + r1.width/2,
        y: gw.bottom - r1.bottom + (r1.height/2),
        theta: aangle,
        otheta: 0
    }
    
    b = {
        w: r2.width,
        h: r2.height,
        x: r2.left + r2.width/2,
        y: gw.bottom - r2.bottom + (r2.height/2),
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
    //alert(is)
    return !is
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
    var svgNS = "http://www.w3.org/2000/svg"
    var svg = document.createElementNS(svgNS, "svg");
    document.body.appendChild(svg)
    svg.setAttribute("width",  width)
    svg.setAttribute("height",  height)
    svg.setAttribute("class", "wordcloud")
    for (var n in hashSorted) {
        var word = hashSorted[n]
        var size = 0;
        var expected_area = ( Math.sqrt(hash[word]) / total ) * (space*0.9)
        console.log(expected_area)
        
        for (var s = 100; s > 0; s--) {
            var txt = document.createElementNS(svgNS, "text");
            txt.textContent = word
            txt.setAttribute("font-size", s + "px")
            svg.appendChild(txt)
            w = txt.getBBox();
            var area = w.width * w.height;
            if (area <= expected_area ) {
                size = s;
                svg.removeChild(txt)
                break
            }
            svg.removeChild(txt)
        }
        
        
        var txt = document.createElementNS(svgNS, "text");
        txt.setAttribute("font-size", size + "px")
        txt.setAttribute("x", "0")
        txt.setAttribute("y", "40")
        txt.setAttribute("class", "cloudword")
        txt.setAttribute("onclick", "do_search(\"" + word + "\", 30)")
        txt.textContent = word
        svg.appendChild(txt)
        w = txt.getBBox();
        
        var increment = 2*Math.PI/10;       
        var theta = 50;
        var prop = height/width
        var popped = false
        
        var angle = 0;
        
        // Try with random placement
        var gw = svg.getBoundingClientRect()
        txt.setAttribute("transform", "rotate(" + angle + ")")
        if (!popped) {
            var ss = size
            for(var n = 0; n < 50; n++) {
                var nx = (width-w.width) * Math.random()
                var ny = ((height-w.height) * Math.random()) + w.height
                txt.setAttribute("x", nx)
                txt.setAttribute("y", ny)
                angle = (Math.random() * 120) - 60
                
                ss *= 0.9
                txt.setAttribute("font-size", size + "px")
                var ow = txt.getBoundingClientRect()
                txt.setAttribute("transform", "rotate(" + angle + ", " + (ow.left + (ow.width/2)) + ", "+ (ow.top + (ow.height/2)) + ")")
                var w = txt.getBoundingClientRect()
                if (w.bottom > gw.bottom-12 || w.top < gw.top+12 || w.left < gw.left-12 || w.right > gw.right-12) continue
                txt.setAttribute("transform", "rotate(" + 0 + ", " + (ow.width/2) + ", "+ (ow.height/2) + ")")
                var it = false
                for (var b in boxes) {
                    if (definitely_intersecting(txt, boxes[b], angle, gw)) {
                        it = true
                        break
                    }
                }
                if (!it) {
                    popped = true
                    txt.setAttribute("transform", "rotate(" + angle + ", " + (ow.left + (ow.width/2)) + ", "+ (ow.top + (ow.height/2)) + ")")
                    //alert("added at " + angle)
                    break
                } 
            }
        }
        
        // Didn't work? Spiral time!
        if (!popped) {
            for (var ss = size; ss > 10; ss -= 3) {
                txt.setAttribute("font-size", size + "px")
                while( theta < 60*Math.PI) {
                    angle = (Math.random() * 120) - 60
                    txt.setAttribute("transform", "rotate(0)")//rotate(" + angle + ", " + nx + "," + ny + ")")
                    var nx = (width/2) - (w.width/2) + ((theta * Math.cos(theta)))
                    var ny = (height/2) + ((theta * Math.sin(theta))*prop)
                    txt.setAttribute("x", nx)
                    txt.setAttribute("y", ny)
                    theta = theta + increment;
                    increment *= 0.995
                    if (increment < 0.05) {
                        increment = 0.05
                    }
                    var it = false
                    if (!(nx > 8 && nx < (width-w.width-16) && (ny > w.height+8 && ny < height-8))) continue
                    for (var b in boxes) {
                        if (definitely_intersecting(txt, boxes[b], 0, gw)) {
                            it = true
                            break
                        }
                    }
                    if (!it) {
                        popped = true
                        
                        break
                    } 
                }
            }
        }
        
        
        
        if (popped) {
            boxes.push(txt)
        } else {
            //alert("Could not add " + word)
            svg.removeChild(txt)
        }
        
    }
    document.body.removeChild(svg)
    return svg
}