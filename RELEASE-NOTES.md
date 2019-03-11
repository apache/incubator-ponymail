# Apache Pony Mail (Incubating)

Release Notes

# Version 0.11 #

No changes that require additional setup.

# Version 0.10 #

### Fixing null favorite entries ###

There was a bug in the preferences API that could result in one or more null entries
being added to the favorite mailing lists for an account. This would prevent the '*' tab from displaying.
The bug has been fixed which will prevent further nulls from being created.
There is a script - tools/nullfav.py - which can be used to clean up existing favorites.
Run as follows:

$ python3 nullfav.py # list affected accounts

If there are any, then:

$ python3 nullfav.py --apply # apply changes to affected accounts

If the database is busy it's possible that some accounts may fail to update.
If so, just run the script again.

To confirm that all the accounts have been fixed, run the script again:

$ python3 nullfav.py

Once this has been done, there should be no need to run the script again.

### Change to AAA ###

Pony Mail now has two AAA modules:
- lib/aaa.lua
- lib/aaa_site.lua

The aaa.lua file is now a generic module which implements the AAA API.
It does not grant any rights; that must be done by the aaa_site.lua module.

Before updating an existing installation, copy aaa.lua to aaa_site.lua otherwise it will be overwritten.
The new generic aaa.lua module will automatically use aaa_site.lua if present.

If this is a new installation, the lib/aaa_site.lua module needs to be created.
There are several examples in the aaa_examples directory or you can create your own.

This was done to simplify subsequent releases.

### Significant changes to GUI ###

- mixed public/private lists are now displayed in the menu
- improved display of quoted material in messages
- better handling of missing/empty Subjects and bodies
- better handling of broken mail threads
- dates are all displayed in UTC
- improved error reporting including for missing / inaccessible links
- flat view mode now shows first line of body (as for threaded views)
- search panel is updated with current month when selection changes

### Significant changes to functionality ###

- private messages are now included in archive downloads if the user has access to them
- various improvements to the archiver/importer:
  - better handling of encodings, including attachment names
  - handles more attachment types
  - handles more text types
  - can import individual mbox files
- better error handling when communicating with the ES server
- setup.py now sets up all mappings
- stored dates are now all in UTC
- API modules no longer return unnecessary data, reducing network traffic

### Potentially incompatible changes ###

- mbox_source messages are now stored as base64 encoded text if they cannot be stored as ASCII
  See #366. 
  This only affects the backend database contents, as the data is decoded as necessary on fetch.
  
- the archiver and importer now generate the same MID for identical messages
  In version 0.9, the archiver and importer could generate different MIDs for the same message.
  This has been fixed, however it means that messages archived with 0.9 may have a different MID from
  the same message archived - or imported - with 0.10.
  Messages imported with 0.10 will have the same MID as messages imported with 0.9
  It is only the 0.9 archiver that could generate different MIDs.

### Restrictions/Known bugs ###
 
 ------
There are unresolved design issues with the existing id generators.

The original and medium generators don't generate unique ids, so not
all distinct emails can be archived.
The full generator probably generates unique ids, however these are not
guaranteed stable, so re-importing mail may cause duplicates to be archived. 

Since Permalinks currently rely on the generated ids, there is no guarantee
that Permalinks are unique or permanent.
 ------

 - HTML-only mails are not archived unless the Python `html2text` package (GPLv3) is installed and the `--html2text` command line arg is used

 - there are no proper unit tests

 - the 'full' generator uses the same format as the 'medium' generator for the ids
