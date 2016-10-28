#!/bin/bash
cat *.coffee | coffee --bare --compile --stdio > ../ponymail-coffee.js

