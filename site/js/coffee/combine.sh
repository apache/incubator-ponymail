#!/bin/bash

OUTFILE='../ponymail-coffee.coffee'
echo "Combining Coffee files..."
echo '###
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
###

### THIS IS AN AUTOMATICALLY COMBINED FILE. PLEASE EDIT coffee/*.coffee!! ###
' > $OUTFILE

for f in `ls *.coffee`; do
    printf "\n\n###\n******************************************\n Fetched from coffee/${f}\n******************************************###\n\n" >> $OUTFILE
    # WARNING: this assumes the AL header occupies lines 1-16
    sed -e '1,16d' ${f} >> $OUTFILE || exit
done
echo "Created $OUTFILE; compiling..."

coffee --bare --output .. --compile $OUTFILE || exit
rm $OUTFILE
echo "All done!"
