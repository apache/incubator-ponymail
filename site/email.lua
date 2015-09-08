local JSON = require 'cjson'
local elastic = require 'lib/elastic'
function handle(r)
    r.content_type = "application/json"
    local get = r:parseargs()
    local doc = elastic.get("mbox", get.id or "hmm")
    r:puts(JSON.encode(doc))
    return apache2.OK
end