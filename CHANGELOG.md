## CHANGES in 0.4a:

- Notification pane correctly notes if there are no notifications
- Trend page now correctly displays dates with 0 emails in the bottom chart
- Admins can now specify which OAuth portals can provide access to private archives
- Fixed a bug where raw From: headers were not masked when not logged in
- By default, all From: headers are now anonymized for anonymous users
- Email IDs in links are now by default shortened to 15 chars
- Minor changes to the chart graphics
- Fixed an issue where the word cloud would not update the search terms
- Pony Mail now works with ElasticSearch 2.0

## CHANGES in 0.3a:

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

## CHANGES in 0.2a:

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

