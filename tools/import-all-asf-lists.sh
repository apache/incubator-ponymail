#!/bin/bash

for tlp in `ls -1 /mbox/`; do 
  for list in `ls -1 /mbox/${tlp}/ | sort -g`; do
    printf "\n*** Importing ${tlp}/${list} ***\n"
    python ./import-mbox.py --source /mbox/${tlp}/${list} --ext "" --lid "<${list}.${tlp}.apache.org>" ; 
  done
done





