echo "Combining JS..."
echo '/*
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
// THIS IS AN AUTOMATICALLY COMBINED FILE. PLEASE EDIT dev/*.js!!
' > ../ponymail.js
# Warning: ls/sort order depends on the locale; this can affect the order
# of non-alphanumerics such as '.' and '_'. So force the use of 'C' locale
for f in `LC_ALL=C ls *.js`; do
    printf "\n\n/******************************************\n Fetched from dev/${f}\n******************************************/\n\n" >> ../ponymail.js
    sed -e '/^\/\*/,/\*\//d' ${f} >> ../ponymail.js
done
echo "Done!"
