# Building Pony Mail Coffee-and-Cake for Production #
Most of Pony Mail is ready-for-deployment files that just need to be checked out
in order to work. Some areas, such as the CofeeScript needs to be compiled and combined
by a script, as they have been split into several smaller files to make it easier to 
find and work on various elements of the rendering process.

### Building the JavaScript amalgamation ###
All edits should be done to the `site/js/coffee/*.coffee` files.
Once done, you should run combine.sh in the `site/js/coffee` directory 
to generate ponymail-coffee.js from the scripts in the dev dir:

    $cd site/js/coffee
    $bash combine.sh
    (coffeescript output goes here...)
    Done!
    $

You may choose to commit the initial Coffee changes first before 
committing the new amalgamated JS, but that's up to you.
