function handle(r)
    local domain = r:escape_html(r.args)
    local scheme = "https"
    if r.port == 80 then
        scheme = "http"
    end
    local hostname = ("%s://%s:%u"):format(scheme, r.hostname, r.port)
    r.content_type = 'application/opensearchdescription+xml'
    r:puts(([[<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Pony Mail: %s</ShortName>
  <Description>Search for emails on the %s mailing lists</Description>
  <Tags>mailing lists, email</Tags>
  <Image height="16" width="16" type="image/vnd.microsoft.icon">%s/favicon.ico</Image>
  <Url type="text/html" template="%s/list.html?websearch={searchTerms}&amp;domain=%s&amp;utm_source=opensearch" />
  <Query role="example" searchTerms="cat" />
</OpenSearchDescription>
]]):format(domain, domain, hostname, hostname, domain))
    return apache2.OK
end