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

Note: date and epoch are in UTC

~~~


### Fetching list data
Usage:
`GET /api/stats.lua?list=$list&domain=$domain[&d=$timespan][&q=$query][&header_from=$from][&header_to=$to][&header_subject=$subject][&header_body=$body][&quick][&emailsOnly][&s=$s&e=$e][&since=$since]`

Parameters:

    - $list: The list prefix (e.g. `dev`). Wildcards may be used
    - $domain: The list domain (e.g. `httpd.apache.org`). Wildcards may be used
    - $timespan: A [timespan](#Timespans) value
    - $s: yyyy-mm start of month (day 1)
    - $e: yyyy-mm end of month (last day)
    - $query: A search query (may contain wildcards or negations):
      - `foo`: Find all documents containing `foo` in headers or body
      - `-foo`: Find all documents NOT containing `foo`.
      - `foo*`: Find all documents containing `foo`, `fooa`, `foob` etc
    - $from: Optional From: address
    - $to: Optional To: address
    - $subject: Optional Subject: line
    - $body: Optional body text
    - $since: number of seconds since the epoch, defaults to now. 
       Returns '{"changed":false}' if no emails are later than epoch, otherwise proceeds with normal search

Options:

    - quick: only return list of email epochs
    - emailsOnly: only return list of emails; omit thread structure, top 10 participants and word-cloud
    
Response example:

~~~
{
    "took": 437179,
    "firstYear": 2015,
    "emails": {
        {
            "list_raw": "<dev.ponymail.apache.org>",
            "gravatar": "66cf545ca7a1b8f595282bb9d8a59657",
            "id": "b1d6446f5cc8f4846454cbabc48ddb08afbb601a77169f8e32e34102@<dev.ponymail.apache.org>",
            "epoch": 1474883100,
            "subject": "Re: Missing tag for 0.9 release",
            "message-id": "<7f249f5e-e422-68a5-d57f-bfce585e638e@apache.org>",
            "private": false,
            "irt": "<CAOGo0VYrCOR=820LSDZA=czc==SOwCaRKasaEvVuxtUEXp9SDQ@mail.gmail.com>",
            "from": "Daniel Gruno <h...@apache.org>",
            "attachments": 0
        },...
    },
    "no_threads": 10,
    "domain": "ponymail.info",
    "participants": {
        {
            "count": 3,
            "name": "Daniel Gruno",
            "gravatar": "66cf545ca7a1b8f595282bb9d8a59657",
            "email": "hu...@apache.org"
        }, ...
    },
    "lastYear": 2015,
    "name": "dev",
    "cloud": {...},
    "hits": 25,
    "thread_struct": {...},
    thread_struct":
    {
        "nest": 2,
        "children": {
            {
                "children": {
                    {
                        "children": {
                            {
                                "children": { },
                                epoch: ...,
                                tid: ...,
                                nest: 1
                            }
                        },
                        epoch: ...,
                        tid: ...,
                        nest: 2
                    }
                },
                "epoch": 1474883100,
                "tid": "b1d6446f5cc8f4846454cbabc48ddb08afbb601a77169f8e32e34102@<dev.ponymail.apache.org>",
                "nest": 2
            }
        },
        epoch: ...,
        tid: ...,
        body: ...
    },
    "max": 5000,
    "searchlist": "<dev.ponymail.info>",
    "list": "dev@ponymail.info",
    "numparts": 0,
    "using_wc": false
}
~~~

### <a name="Timespans"></a>Timespans

Timespans supported by the &d= parameter.

    - d=yyyy-mm => equivalent to &s=yyyy-mm&e=yyyy-mm
    - d=lte=n[wMyd] (less than n[wMyd] ago, inclusive)
    - d=gte=n[wMyd] (more than n[wMyd] ago, inclusive)
    - d=.*dfr=yyyy-mm-dd.* (start date for search, inclusive)
    - d=.*dto=yyyy-mm-dd.* (end date for search, inclusive)
    - [wMyd] = weeks, Months, years, days
    - lte and gte are mutually exclusive
    - dfr and dto are normally both present

### Fetching preferences and quick list overview
Usage:
`GET /api/preferences.lua[?logout][?associate=$email][?verify&hash=$hash][?removealt=$email][?save][?addfav=$list][?remfav=$list]`

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
`GET /api/notifications.lua[?seen=$mid]`

Parameters: (cookie required)
  - $mid: id of the message to be marked as having been seen


Response example:

~~~
{
    "notifications": {...}
}
or
{"marked": true}
~~~

### Fetching a month's data as an mbox file
Usage:
`GET /api/mbox.lua?list=issues@ponymail.apache.org&date=2016-06`

Response example:

~~~
TBA
~~~

