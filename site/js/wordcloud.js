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

function intersects(x1, x2) {
    var r1 = x1.getBoundingClientRect();
    var r2 = x2.getBoundingClientRect();
 
  return !(r2.left > r1.right || 
           r2.right < r1.left || 
           r2.top > r1.bottom ||
           r2.bottom < r1.top);
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
        var w
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
        
        // Try with random placement
        if (!popped) {
            for(var n = 0; n < 50; n++) {
                var nx = (width-w.width) * Math.random()
                var ny = ((height-w.height) * Math.random()) + w.height
                txt.setAttribute("x", nx)
                txt.setAttribute("y", ny)
                size *= 0.9
                txt.setAttribute("font-size", size + "px")
                if (!(nx > 8 && nx < (width-w.width-16) && (ny > w.height+8 && ny < height-8))) continue
                var it = false
                for (var b in boxes) {
                    if (intersects(txt, boxes[b], nx, ny)) {
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
        
        // Didn't work? Spiral time!
        if (!popped) {
            for (var ss = size; ss > 10; ss -= 3) {
                txt.setAttribute("font-size", size + "px")
                while( theta < 60*Math.PI) {
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
                        if (intersects(txt, boxes[b], nx, ny)) {
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