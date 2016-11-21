#!/bin/bash

# Test file importing

echo ++++++++++++ Testing imports that should fail ++++++++++++
../tools/import-mbox.py --dry --duplicates --source resources/fail
echo ------------ Should be zero records inserted --------------
echo

COUNT=$(grep '^From ' resources/pass/*.mbox | wc -l)
echo ++++++++++++ Testing imports that should pass ++++++++++++
../tools/import-mbox.py --dry --duplicates --source resources/pass
echo ------------ Expecting $COUNT records inserted/updated and 0 bad records --------------
echo

COUNT=$(grep '^From ' resources/valid/*.mbox | wc -l)
echo "++++++++++++ Testing imports that should pass but don't currently ++++++++++++"
../tools/import-mbox.py --dry --duplicates --source resources/valid
echo ------------ Expecting 0 records inserted/updated and $COUNT bad records --------------
echo
