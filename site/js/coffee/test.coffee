testCoffee = () ->
    ### Get main div from HTML ###
    parent = get('testdiv')
    # Make a paragraph with some text in it
    p = mk('p', { class: "fooclass", style: { textAlign: 'center'}}, "Text goes here")
    
    # Inject paragraph into div
    parent.inject(p)
    
    # Add some plain text and a break
    p.inject([". Here's a textNode added afterwards", mk('br')])
    
    # Make an object we can hide when clicked on, using the show() prototype
    hider = mk('b', { onclick: 'testToggle(this);'}, "Click here to hide this text!")
    p.inject(hider)
    
    
testToggle = (div) ->
    div.show()