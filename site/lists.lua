local JSON = require 'cjson'
local elastic = require 'lib/elastic'


function handle(r)
    local now = r:clock()
    r.content_type = "application/json"
    local now = r:clock()
    local get = r:parseargs()
    
    local doc = elastic.raw {
        aggs = {
            from = {
                terms = {
                    field = "list_raw",
                    size = 100000
                }
            }
        }
    }
    local lists = {}
    
    for x,y in pairs (doc.aggregations.from.buckets) do
        local list, domain = y.key:match("^<?(.-)%.(.-)>?$")
        if not domain:match("%..-%..-%..-") and domain:match("^[-_a-z0-9.]+$") and list:match("^[-_a-z0-9.]+$") then
            lists[domain] = lists[domain] or {}
            lists[domain][list] = y.doc_count
        end
    end
    
    r:puts(JSON.encode(lists))
    
    return apache2.OK
end