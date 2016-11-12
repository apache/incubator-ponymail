#!/bin/bash
############################################################################
# Licensed to the Apache Software Foundation (ASF) under one or more       #
# contributor license agreements.  See the NOTICE file distributed with    #
# this work for additional information regarding copyright ownership.      #
# The ASF licenses this file to you under the Apache License, Version 2.0  #
# (the "License"); you may not use this file except in compliance with     #
# the License.  You may obtain a copy of the License at                    #
#                                                                          #
#     http://www.apache.org/licenses/LICENSE-2.0                           #
#                                                                          #
# Unless required by applicable law or agreed to in writing, software      #
# distributed under the License is distributed on an "AS IS" BASIS,        #
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. #
# See the License for the specific language governing permissions and      #
# limitations under the License.                                           #
############################################################################
DIR=$1
for tlp in `ls -1 ${DIR}`; do 
    if [ "${tlp}" != "DONE" ]; then
        TLPN=`echo ${tlp} | cut -d. -f1`
        if [ "${TLPN}" != "incubator" ]; then
          printf "\n*** Updating ${TLPN} ***\n"
          python3 import-mbox.py --source "http://mail-archives.eu.apache.org/mod_mbox/" --quick --mod-mbox --project ${TLPN};
        fi
    fi
done

