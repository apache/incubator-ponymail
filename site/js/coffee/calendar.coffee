calendar_months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
    ]

###*
# Calendar: Make a HTML calendar with years and months
# that expands/contracts. For the left side view.
# Usage: cal = new Calendar('2001-2', '2016-9', 2010)
# Would make a calendar going from 2001 to 2016 with 2010 expanded.
###
class Calendar
    constructor: (start, end, jumpTo) ->
        now = new Date()
        
        ### Split start and end into years and months ###
        [sYear, sMonth] = start.split("-")
        
        [eYear, eMonth] = [now.getFullYear(), now.getMonth()+1]
        
        ### If end year+month given, use it ###
        if end
            [eYear, eMonth] = end.split("-")
        
        ### For each year, construct the year div to hold months ###
        years = []
        for year in [parseInt(sYear)..parseInt(eYear)]
            yDiv = new HTML('div', {
                id: "calendar_year_" + year
                data: String(year)
                class: "calendar_year"
                onclick: "toggleYear(this);"
            }, String(year))
            
            ### Construct the placeholder for months ###
            ### Hide unless active year ###
            monthsDiv = new HTML('div', {
                style:{
                    display: if (jumpTo and jumpTo == year) or
                        (not jumpTo and year == parseInt(eYear))
                    then "block"
                    else "none",
                }
                class: "calendar_months"
                id: "calendar_months_" + year
            })
            
            ### For each month, make a div ###
            for month in [12..1]
                ### Make sure this is within the start<->end range ###
                if (year > sYear or month >= sMonth) and (year < eYear or month <= eMonth)
                    monthDiv = new HTML('div', {
                        class: "calendar_month"
                        id: "calendar_month_{#year}-{#month}"
                        data: "#{year}-#{month}"
                        onclick: "toggleMonth(this)"
                    }, calendar_months[month-1])
                    monthsDiv.inject(monthDiv)
            
            ### unshift year into the div list (thus reverse order) ###
            years.unshift(monthsDiv)
            years.unshift(yDiv)
            
        ### Return a combined div ###
        div = new HTML('div', {
            class: "calendar"
            data: sYear + "-" + eYear
            }, years)
        
        return div
    
toggleYear = (div) ->
    
    ### Get the start and end year from the parent div ###
    [sYear, eYear] = div.parentNode.getAttribute('data').split("-")
    
    ### Get the year we clicked on ###
    year = parseInt(div.getAttribute("data"))
        
    ### For each year, hide if not this year, else show ###
    for y in [sYear..eYear]
        if y == year
            get('calendar_months_' + y).show(true)
        else
            get('calendar_months_' + y).show(false)
            
toggleMonth = (div) ->
    #### TODO later... ###
    