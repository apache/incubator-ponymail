# Building Pony Mail for Production #
Most of Pony Mail is ready-for-deployment files that just need to be checked out
in order to work. Some areas, such as the JavaScript needs to be combined by a script,
as they have been split into several smaller files to make it easier to find and
work on various elements of the rendering process.

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
