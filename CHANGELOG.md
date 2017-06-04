## CHANGES in 0.10:
- Added sample configs for Pony Mail (#374)
- Renamed ll.py to list-lists.py (#378)
- ID generators have now been split into a separate library (generators.py)
- more comprehensive ID generation mechanisms
- private messages are now included in downloads if the user has access to them (#169, #108)
- mbox export now generates valid From_ line (#190)
- mbox export now escapes 'From ' lines in body text (#188)
- stats.lua ignores negated words when building the word cloud (#277)
- combine pminfo.lua aggregations for efficiency (#273)
- various typos fixed and other tidyup
- quicker to fetch only aggregation results where the hits are not needed (#271)
- archiver and import-mbox create different mbox_source entries - drop spurious importer field (#266)
- make it easier to test the archiver - --dry option (#264)
- import-mbox dry run should exercise as much as possible of the code (#258)
- archiver and import-mbox handle invalid encodings differently (#261)
- archiver unconditionally ignores encoding errors (#260)
- archiver does not allow for attachment which is not multipart (#257)
- archiver drops empty attachments (#256)
- archiver drops attachment with utf-8 encoded name (#255)
- import-mbox.py and archiver.py create different source texts (#251)
- import-mbox.py messages need the thread number (#248)
- import-mbox.py does not identify which messages failed (#246)
- edit-list.py does not process --obfuscate if it is used alone (#238)
- edit-list.py does not honour --test with --desc (#237)
- elastic.lua checkReturn() does not properly check return code (#236)
- import-mbox.py keeps rechecking if the index exists (#233)
- import-mbox.py allows invalid lid (#230)
- import-mbox.py --project qualifier regex errors (#229)
- properties missing from mappings in setup.py (#228)
- setup.py does not create mbox mapping property 'cc' (#226)
- setup.py does not create notifications/account mappings (#225)
- archiver fails when adding entries to the notifications table (#223)
- elastic.lua index function should not auto-generate ids (#222)
- coffee script generation order seems to vary between OSes (#215)
- display treats >From as quoted text (#213)
- import-mbox.py should be able to import individual files (#210)
- import-mbox.py should not start more threads than there are files (#209)
- No point creating an 'Other lists:' drop-down if it will only contain a single entry (#208)
- combine.sh uses GNU-only sed extension -s (--separate); it's not needed (#187)
- setup.py can overwrite existing config files (#185)
- setup.py does not handle connection failure well (#184)
- Other lists drop-down should be sorted by name (#183)
- does not handle missing or empty subjects well (#182)
- import-mbox.py does not report if List-Id is missing (#174)
- mailinglists index should be created by setup.py or made truly optional (#164)
- elastic.lua checkReturn should throw errors in the callers context (#150)
- elastic.lua does not always check http return status (#145)
- use of global variables in handle() methods (#141)
- lib/elastic.lua: various bugs (#139)
- user.getUser() overwrites login global variable; defines unused variable 'usr' (#138)
- import-mbox.py does not handle protocol choice well (#135)
- setup.py does not handle empty response to port number well (#133)
- broken mail thread; attempted recovery causes unhandled error (#124)
- https://lists.apache.org/list.html?dev@eagle.apache.org fails (#121)
- get by message-id does not work (#88)
- stored date uses locale-dependent conversion and is ambiguous (#86)
- search strings not properly quoted. (#76)
- pminfo.lua creates top100 sender information but it's not used (#282)
- stats.lua could use single aggregate query to get first and last years (#276)
- stats.lua can fail when creating top10 senders (#283)
- ponymail.js/formatDate may show the wrong timezone (#285)
- archiver.py fails when attachment name is not ASCII (#287)
- emails with no body content are ignored (#109)
- does not handle text/enriched mails (#289)
- ll.py retrieves results but does not use them (#291)
- lib/aaa.lua various bugs (#140)
- lua modules should define local functions only (#294)
- inconsistent rights checking (#267)
- thread.lua fails to fetch rights when fetching private child of public parent (#296)
- typo in all example aaa modules: xemail != exmail (#299)
- lib/aaa.lua overwrites local customisations on updates (#292)
- rights checking should be localised (#293)
- pminfo.lua does some unnecessary work (#220)
- stats.lua uses inconsistent email canonicalisation code (#300)
- stats.lua - inconsistent output between slow_count = true/false (#301)
- confusion of storageAvailable and localStorage in ponymail.js (#194)
- unnecessary double-checking of window.sessionStorage in ponymail.js (#193)
- lua scripts not using cross.contentType() compatibility function (#218)
- code assumes that subject is always present in an e-mail (#149)
- elastic.lua:getHeaders uses different sort field (#146)
- redundant matching of same string (#117)
- ponymail.js uses unsupported preferences.lua parameter (#165)
- preferences.lua never fetches descriptions (#163)
- API.md does not document all the stats.lua parameters (#115)
- allow preferences to use non-default mail port (#303)
- preferences.lua should not return list data if it was not requested (#305)
- preferences.lua should not update the user account if the mail is not sent OK (#306)
- alts.js does not check for errors when calling preferences.lua (#304)
- An unauthorised private mail should be treated like a non-existent mail (#295)
- Move common anonymizing code to utils (#308)
- Move extractCanonEmail to utils
- preferences does not properly remove nulls from account.credentials.altemail (#309)
- manage e-mails can create multiple identical alternate addresses (#307)
- elastic.get does not return if a document is not found but some callers overlook this (#137)
- pcall() idiom to protect against elastic.lua exceptions is flawed (#162)
- unhelpful error reporting for invalid Permalinks/Source links (#123)
- import-mbox.py fails to unescape >From lines (#212)
- Updated Google+ API for logins
- Fixed a redirect bug with oauth
- Removed support for Mozilla Persona
- elastic.scroll does not return nil sid when there are no more results (#315)
- stats.lua should return firstMonth and lastMonth (#120)
- many python scripts insist on Python 3.4 (#312)
- config.hidePrivate should be dropped (#272)
- limit filter is deprecated in ES 2.0; dropped in ES 5.0 (#318)
- domain parameter is not used externally (#319)
- pminfo.lua fetches and saves epoch but never uses it #320
- pminfo.lua - no need to use scroll unless doc count > 10000 (#321)
- pminfo.lua - scroll/scan ignores sort order (#322)
- flat view mode does not show first line of body (#198)
- Fetch URLBase once in Javascript
- absolute URLs must be prefixed with URLBase in JS files (#327)
- cannot use absolute URLs in HTML pages (#328)
- setup.py now prompts for shard and replica counts when creating the index (#313)
- 'hot topics' feature should use terms, not significant_terms (#329)
- stats.lua - slow_count option is unnecessary (#323)
- stats.lua updates senders array unnecessarily in statsOnly (quick) mode (#330)
- stats.lua returns email time instead of os time in unixtime field (#331)
- stats.lua - cache causes inconsistent output when quick is used (#118)
- does not show mixed private/public lists unless logged in (#70)
- inconsistent error reporting for invalid mailing lists (#112)
- Always use Javascript conditional blocks (#333)
- links in stats pane don't set up the correct date range (#106)
- code should delete scroll id after use (#336)
- ll.py - Make --count work with --pretty; show private message counts
- DRY: move leapYear and end of month calculations to utils
- indicate which months are outside the archive span for a list (#340)
- default to medium ID generator (#343)
- scroll/scan is not supported in ES 5.x (#344)
- GUI does not report maxResult truncation correctly (#335)
- ponymail.js creates/displays dates with no timezone - confusing (#286)
- Make it clearer when you're not logged in. (#195)
- list name not normalised when imported (#253)
- GUI ignores date span in list.html URI if query is blank (#346)
- search phrase dropped from list.html URI if date span is yyyy-mm (#347)
- stats.lua first/last dates don't always agree with visible mails (#350)
- Use constant for max list count instead of 500000 (#352)
- Tighten wildcard searches to only search in the same domain level (#348)
- useless conditional when fetching id parameter (#353)
- ES 5.0 no longer supports the write consistency option for index(); archiver fails (#351)
- Cookie should use httpOnly and Secure (#355)
- Allow insecure cookie (config item intended for local testing only) (#355)
- crash in import-mbox when list-id is missing and --lid is not provided (#358)
- archiver traverses multi-part message parts twice (#359)
- Add unsubscribe button (#362)
- Bug: invalid style setting: overflow:hide => overflow:hidden (#364)
- Bug: wordcloud.js logs to the console (#363)
- Bug: source.lua does not specify the charset (#367)
- Bug: archiver stores attachment binary data types with embedded newlines (#262)
- Bug: may corrupt 8bit message source if it is not encoded in UTF-8 (#366)
- Enh: make debug info optional (#369)
- import-mbox.py: mailbox defaults to Create if file is not found (#370)
- Bug: import --dedup does not cater for messages sent to multiple lists (#373)

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

