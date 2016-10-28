# Design Notes

This file is an attempt to summarise some of the design issues.

## Database
The project uses the ElasticSearch (ES) database to store the mails as individual documents.
The database stores each mail to each list as a separate document.
If the same mail was sent to multiple lists, then it exists as multiple documents in the database.

ES requires that each distinct document has a unique id (MID).
The MID is used to insert the document in the database, and can be used to fetch it.

### Database design
The mails are stored in two separate ES indexes:
* "mbox" - this stores information about the document, plus the parsed content, and is used for searching and summary displays.
* "mbox_source" - this is used to store the raw content of the document.
The two versions of the document are linked by using the same MID.

### Requirements for the MID
As mentioned above, each different document must have a unique id (MID).
This document may arrive as a single mail message, or be loaded from a collection such as an mbox file.

Duplicate database entries can be avoided by ensuring that the same MID is calculated regardless of the input source.
[If the same message is processed more than once, it then does not matter as only the last instance will be stored.]
The MID format does not have to be transparent; it can be an opaque hash.

### Generation of the MID
The same message may be sent to multiple lists, so the message data alone is not sufficient to identify it uniquely.
The same message may potentially be sent more than once to the same list,
so the combination of message and listname is also not sufficient to identify a message.

Many messages will have a Message-Id header which is intended to be unique to the message.
However this may not be the case, and some messages do not have one.

Many mailing list servers will allocate a squence number or other such id to each message they send.
This should be unique for the list, assuming that sequence is not reset.

Where the Message-Id and List Server Id both exist, they can be combined to generate a MID.
[If the List Server Id is known to be unique, then that can potentially be used alone.] 

Where one or other id does not exist, then alternative means need to be used to generate the MID.
The data used to do so must be present it all supported message sources.

### Permalink requirements
The application provides Permalinks which can later be used to refer to any document in the database.
Once published, it is important that such links must continue to work.

Links should be portable; i.e. if the raw messages are loaded into a new archive it should be possible
to support existing published Permalinks.

Multiple links may refer to the same document, however each link should refer to a single document.
Ideally the Permalink should be relatively short; however that may conflict with the uniqueness requirement.

It may be useful for the Permalink format to be relatively transparent.
For example, a current ASF mod_mbox link looks like:

http://mail-archives.apache.org/mod_mbox/ponymail-commits/201605.mbox/<1f73b4e0fc1a4fbbbfe4d155293c2f1a@git.apache.org>

This includes a reference to the:
- mailing list name (ponymail-commits)
- month when mail was sent (201605.mbox)
- the Message-Id (<1f73b4e0fc1a4fbbbfe4d155293c2f1a@git.apache.org>)

This information should be sufficient to find the message in just about any mail-archive.

Whereas vendor-specific links may be much shorter, but are only valid for the particular service.
For example the equivalent Markmail link is:
http://markmail.org/message/oanktcpxlxkmyora

There may be use cases for both styles of link.

### Permalink design
TBA
