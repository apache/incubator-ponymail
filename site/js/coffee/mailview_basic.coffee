readEmail = (obj) ->
    mid = null
    insertPoint = null
    ### Did we get this from a div? if so, find out things ###
    if typeof obj is 'object'
        mid = obj.getAttribute("data")
        insertPoint = obj
    else if typeof obj is 'string'
        mid = obj
        insertPoint = new HTML('div')
        document.body.inject(insertPoint)
    if mid and insertPoint
        markRead(mid)
        mailDiv = new HTML('div')
        insertPoint.inject(mailDiv)
        mailDiv.inject("foo bar baz!")
        