## CHANGES in 0.9b:

- Private lists can be hidden in the index from users without access
- Fixed an issue where LocalStorage limits would break the site
- Fixed an issue with gravatars not showing up
- UI can now auto-scale, allowing as many results per page as screen height will support
- Users can add favorite lists to their user menu (shortcuts)
- Reply-to and compose now works from the permalink page
- Archiver can now set an explicit List ID from command-line
- Archiver and importer can now do on-the-fly regex List ID replacement
- Increased import parsing timeout from 2 to 6 minutes per mbox file
- Private emails are now more clearly marked as such in the UI
- Logging in via OAuth now remembers where you left off
- Added support for Maildir imports
- Added three distinct Message-ID generators (short, medium, full)
- Fixed some issues with email association
- Added obfuscation mechanism to the list editor
- Added a dry-run feature to the list editor (no changes made)
- Added a single-message edit feature for the list editor


## CHANGES in 0.8b:

- Fixed a bug where single-email topics in treeview mode would not display
- Hitting the escape key will now properly close threads in treeview mode
- Fixed an issue where threads were sometimes sorted the wrong way, time-wise
- UI shortcut improvements for high resolution users
- Added additional keyboard shortcuts and a help menu (H key to open)
- Very long emails can now be replied to via own MUA (albeit truncated)
- Internal httpd auth is now supported (for use with CAS etc)
- Fixed a bug where the in-reply-to data was garbled internally
- Various fixups in the URL recognition routine
- HTML-only emails can now be parsed (as markdown) by the archiver
- Fixed an issue where --altheader was not respected properly if list-id was supplied
- Fixed an issue where emails were not inserted into threads in the correct order
- Users can now associate secondary email addresses with their account

## CHANGES in 0.7b (released 2016-01-05):

- Added several AAA example scripts
- Fixed a bug where long threads could break the UI (0.6a regression)

## CHANGES in 0.6a (not released):
 
- Added a caching system for search results to reduce load times
- The statistics panel is now hidden by default
- Config changes are now persistent through reloads, even if not logged in
- The importer can now import from Pipermail archives
- Improved responsive interface
- Fixed the >100% width CSS bug
- Better sizing of some elements in the list view to accommodate smaller screens
- New unified quick search bar
- Added a new theme, compact, a cross between social and default
- Lists more than 3 years old are now also displayed, but still sorted by 90 day activity
- Composer window now properly resets once an email has been dispatched
- Fixed some import/archive issues with 8bit encoding
- Fixed an issue where a multi-line in-reply-to could cause import to fail
- Better fuzzy logic when grouping emails in topics
  
## CHANGES in 0.5a (released 2015-12-21):

- Fixed an issue where shortened URLs were not unpacked correctly.
- Setup can now quietly exit if the system is already set up
- List access can now be defined down to individual lists
- Fixed an error where emails were wrongly archived as public when
  the --private flag was used
- Added the treeview email list mode
- Turned the view mode buttons into a dropdown menu to save space
- Moved the list view title to save some space
- Improved responsive interface (better resizing and low res display)

## CHANGES in 0.4a (released 2015-11-10):

- Notification pane correctly notes if there are no notifications
- Trend page now correctly displays dates with 0 emails in the bottom chart
- Admins can now specify which OAuth portals can provide access to private archives
- Fixed a bug where raw From: headers were not masked when not logged in
- By default, all From: headers are now anonymized for anonymous users
- Email IDs in links are now by default shortened to 15 chars
- Minor changes to the chart graphics
- Fixed an issue where the word cloud would not update the search terms
- Pony Mail now works with ElasticSearch 2.0
- Added an n-gram analysis page
- You can now do complete sentence searches ("foo bar" as opposed to foo bar)
- Various bug fixes to date-parsing and -defaults in the UI
- Permalink view now shows the email subject in the tab title
- Added copy-lists.py for copying archives to a new DB
- Archiver can be set to only allow specific IP blocks in STDIN mode
- Further customization of oauth providers

## CHANGES in 0.3a (released 2015-10-15):

- Permalink page now accepts shortened IDs (first 18 chars)
- Archiver can ignore specific emails (like list owner/system messages)
- Archiver can be told to use current timestamp instead of the Date header
- Added 'table' view mode for the front page for smaller list systems
- Users can now grey out emails they have seen before in a threaded view
- Trends and stats for lists are now available for custom date ranges
- Users can roll up (collapse) threads between currently viewed email and immediate parent
- Searches can now exclude terms by prepending a '-' to them.
- UTF-8 fixes for the STDIN version of the archiver
- Archiver can now exit quietly (not bounce) with --quiet in STDIN mode in case of parser errors

## CHANGES in 0.2a (released 2015-10-05):

- Social theme
- Unified import/archiving methodologies
- Moved to Python 3 for all Python scripts
- Faster aggregation of results
- Conditional anonymization of email addresses
- Various HTML/CSS fixes
- Better search interface for deep search
- Quick search is better at matching email addresses
- Added support for MM3 mailing list descriptions
- New (optional) short phonebook layout for front page
- Added list editor for moving/editing/deleting lists
- Added Google Auth support
- Added custom date picker support for searches
- Added list editing tool, edit-list.py

