#!/bin/bash

# Test file importing

echo ++++++++++++ Testing failures ++++++++++++
../tools/import-mbox.py --dry --duplicates --source resources/fail
echo ------------ Should be zero records inserted --------------
echo

COUNT=$(grep '^From ' resources/pass/*.mbox | wc -l)
echo ++++++++++++ Testing passes ++++++++++++
../tools/import-mbox.py --dry --duplicates --source resources/pass
echo ------------ Expecting $COUNT records inserted/updated and 0 bad records --------------
