testCoffee = () ->
    ### Get main div from HTML ###
    parent = get('testdiv')
    # Make a paragraph with some text in it
    p = new HTML('p', { class: "fooclass", style: { textAlign: 'center'}}, "Text goes here")
    
    # Inject paragraph into div
    parent.inject(p)
    
    # Add some plain text and a break
    p.inject([". Here's a textNode added afterwards", new HTML('br')])
    
    # Make an object we can hide when clicked on, using the show() prototype
    hider = new HTML('b', { onclick: 'testToggle(this);'}, "Click here to hide this text!")
    p.inject(hider)
    
    
testToggle = (div) ->
    div.show()