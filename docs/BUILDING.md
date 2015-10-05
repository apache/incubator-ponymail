# Building Pony Mail for Production #

### Building the JavaScript chunks ###
All JavaScript edits should be done to the `site/js/dev/*.js` files.
Once done, you should run combine.sh in the `site/js/dev` directory 
to generate ponymail.js from the scripts in the dev dir:

    $cd site/js/dev
    $bash combine.sh
    Combining JS...
    Done!
    $

You may choose to commit the initial JS changes first before 
committing the new combined JS, but that's up to you.
