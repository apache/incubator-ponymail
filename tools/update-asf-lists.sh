#!/bin/bash
DIR=$1
for tlp in `ls -1 ${DIR}`; do 
  for list in `ls -1 ${DIR}/${tlp}/ | sort -g`; do
    if [ "${tlp}" != "DONE" ]; then
        TLPN=`echo ${tlp} | cut -d. -f1`
        LETTER=`echo ${TLPN} | cut -c1-1`
        if [ "${LETTER}" != "a" ]; then
          if [ "${TLPN}" != "${list}" ]; then
            printf "\n*** Updating ${TLPN} ***\n"
            python import-mbox.py --source "http://mail-archives.eu.apache.org/mod_mbox/" --quick --mod-mbox --project ${TLPN};
          fi
        fi
      fi
  done
done

