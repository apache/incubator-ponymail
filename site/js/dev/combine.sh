echo "Combining JS..."
cat *.js | sed -s -e '/\/\*/,/\*\//d' > ../ponymail.js
echo "Done!"
