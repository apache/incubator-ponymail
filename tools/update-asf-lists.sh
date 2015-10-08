#!/bin/bash
DIR=$1
for tlp in `ls -1 ${DIR}`; do 
    if [ "${tlp}" != "DONE" ]; then
        TLPN=`echo ${tlp} | cut -d. -f1`
        if [ "${TLPN}" != "incubator" ]; then
          printf "\n*** Updating ${TLPN} ***\n"
          python3 import-mbox.py --source "http://mail-archives.eu.apache.org/mod_mbox/" --quick --mod-mbox --project ${TLPN} --attachments;
        fi
    fi
done

