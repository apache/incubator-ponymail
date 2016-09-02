testCoffee = () ->
    ### Get main div from HTML ###
    parent = get('testdiv')
    # Make a paragraph with some text in it
    p = mk('p', { onclick: 'testToggle(this);', class: "fooclass", style: { textAlign: 'center'}}, "Text goes here")
    # Inject paragraph into div
    parent.inject(p)
    p.inject(". More text here")
    
testToggle = (div) ->
    div.show()