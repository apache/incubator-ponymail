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
        uid = parseInt(Math.random()*100000000).toString(16)
        
        ### Split start and end into years and months ###
        [sYear, sMonth] = String(start).split("-")
        
        [eYear, eMonth] = [now.getFullYear(), now.getMonth()+1]
        
        ### If end year+month given, use it ###
        if end
            [eYear, eMonth] = String(end).split("-")
            ### If end year is this year, restrict months to those that have passed ###
            if parseInt(eYear) == now.getFullYear()
                eMonth = now.getMonth() + 1
            
        ### Make sure months are there, otherwise set them ###
        if not sMonth
            sMonth = 1
        if not eMonth
            eMonth = 12
        
        ### For each year, construct the year div to hold months ###
        years = []
        for year in [parseInt(sYear)..parseInt(eYear)]
            yDiv = new HTML('div', {
                id: "calendar_year_#{uid}_" + year
                data: String(year)
                class: "calendar_year"
                onclick: "toggleYear(this);"
            }, String(year))
            
            ### Construct the placeholder for months ###
            ### Hide unless active year ###
            monthsDiv = new HTML('div', {
                class: if (jumpTo and jumpTo == year) or
                        (not jumpTo and year == parseInt(eYear))
                        then "calendar_months"
                        else "calendar_months_hidden"
                id: "calendar_months_#{uid}_" + year
            })
            
            ### For each month, make a div ###
            for month in [12..1]
                ### Make sure this is within the start<->end range ###
                if (year > sYear or month >= sMonth) and (year < eYear or month <= eMonth)
                    monthDiv = new HTML('div', {
                        class: "calendar_month"
                        id: "calendar_month_#{uid}_#{year}-#{month}"
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
            id: uid
            data: sYear + "-" + eYear
            }, years)
        
        return div
    
toggleYear = (div) ->
    
    ### Get the start and end year from the parent div ###
    [sYear, eYear] = div.parentNode.getAttribute('data').split("-")
    
    ### Get the year we clicked on ###
    year = parseInt(div.getAttribute("data"))
    
    ## Get Calendar UID
    uid = div.parentNode.getAttribute("id")

    ### For each year, hide if not this year, else show ###
    for y in [parseInt(sYear)..parseInt(eYear)]
        if y == year
            get("calendar_months_#{uid}_#{y}").setAttribute("class", "calendar_months")
        else
            get("calendar_months_#{uid}_#{y}").setAttribute("class", "calendar_months calendar_months_hidden")
            
toggleMonth = (div) ->
    #### TODO later... ###
    m = div.getAttribute("data")
    [year, month] = m.split("-")
    
    ### Update the list view using the new month ###
    listView({
        month: m
    })
    
    