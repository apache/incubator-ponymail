# Pony Mail Archive API

### Fetching a specific email:

Usage:
`GET /api/email.lua?id=$mid[&attachment=true&file=$hash]`

Parameters: (cookie may be required)
  - $mid: The email ID or Message-ID: header
  - $hash: the file attachment hash

Response example:

~~~
{
    "references": "<git-pr-18-any23@git.apache.org>",
    "from_raw": "lewismc <git@git.apache.org>",
    "message-id": "<20150905153416.0CDCFDFE66@git1-us-west.apache.org>",
    "@import_timestamp": "2015/10/04 09:52:41",
    "body": "Body of email here...",
    "request_id": "06b318af97ca96c115e878c14d0814a53407751c31388410421c1751@1441467256@<dev.any23.apache.org>",
    "@version": 1,
    "attachments": {},
    "list": "<dev.any23.apache.org>",
    "date": "2015/09/05 17:34:16",
    "from": "lewismc <git@git.apache.org>",
    "gravatar": "a676c0bf448fcd49f588249ead719b4c",
    "in-reply-to": "<git-pr-18-any23@git.apache.org>",
    "epoch": 1441467256,
    "subject": "[GitHub] any23 pull request: Gsoc 2015 Microformats2",
    "mid": "06b318af97ca96c115e878c14d0814a53407751c31388410421c1751@1441467256@<dev.any23.apache.org>",
    "private": false,
    "tid": "06b318af97ca96c115e878c14d0814a53407751c31388410421c1751@1441467256@<dev.any23.apache.org>",
    "list_raw": "<dev.any23.apache.org>"
}
~~~


### Fetching list data
Usage:
`GET /api/stats.lua?list=$list&domain=$domain[&d=$timespan][&q=$query][&header_from=$from][&header_subject=$subject]`

Parameters:
    - $list: The list prefix (e.g. `dev`). Wildcards may be used
    - $domain: The list domain (e.g. `httpd.apache.org`). Wildcards may be used
    - $timespan: A [timespan](#Timespans) value
    - $query: A search query (may contain wildcards or negations):
      - `foo`: Find all documents containing `foo` in headers or body
      - `-foo`: Find all documents NOT containing `foo`.
      - `foo*`: Find all documents containing `foo`, `fooa`, `foob` etc
    - $from: Optional From: address
    - $subject: Optional Subject: line
    
Response example:

~~~
{
    "took": 437179,
    "firstYear": 2015,
    "emails": {...},
    "no_threads": 10,
    "domain": "ponymail.info",
    "participants": {...},
    "lastYear": 2015,
    "name": "dev",
    "cloud": {...},
    "hits": 25,
    "thread_struct": {...},
    "max": 5000,
    "searchlist": "<dev.ponymail.info>",
    "list": "dev@ponymail.info",
    "numparts": 0,
    "using_wc": false
}
~~~


### Fetching preferences and quick list overview
Usage:
`GET /api/preferences.lua[?logout=true]`

Parameters: (cookie required)
  - logout: Whether to log out of the system (optional)
  - associate=$email - associate the account with the $email address
  - verify&hash=$hash - verify an association request $hash
  - removealt=$email - remove an alternate $email address
  - save - save preferences
  - addfav=$list - add a favourite $list
  - remfav=$list - remove a favourite $list


Response example:

~~~
{
    "lists": {
        "ponymail.info": {
            "user": 5,
            "dev": 36,
            "commits": 279
        }
    },
    "descriptions": {
    },
    "preferences": {
        "displayMode": "threaded",
        "hideStats": "no",
        "theme": "default",
        "notifications": "direct",
        "sortOrder": "forward",
        "compactQuotes": "yes",
        "fullname": "Daniel Gruno",
        "groupBy": "thread"
    },
    "took": 38487,
    "login": {
        "notifications": 0,
        "credentials": {
            "fullname": "Daniel Gruno",
            "email": "foo@bar.tld"
        }
    }
}
~~~


### Fetching notifications for a logged in user
Usage:
`GET /api/notifications.lua`

Parameters: `None` (cookie required)


Response example:

~~~
{
    "notifications": {...}
}
~~~

