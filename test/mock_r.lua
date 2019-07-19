-- Mock version of various items for testing

local _M = {}

local r = {
    puts = function(r, ...) print(...) end,
    getcookie = function(r, name) return nil end,
    strcmp_match = function(str, pat)
                    pat = pat:gsub("%.", "%%."):gsub("*", ".+")
                    return str:match(pat)
                end,
    ivm_set = function(r, key, val) _M['ivm_' .. key] = val end,
    ivm_get = function(r, key) return _M['ivm_' .. key] end,
}

local function account(uid)
    return {
        credentials = {
            uid = uid,
        },                    
        internal = {
            oauth_used = 'localhost',
        },
    }
end

return {
    r = r,
    account = account
}
