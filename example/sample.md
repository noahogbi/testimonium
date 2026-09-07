# What a status code promises, and what it doesn't

HTTP status codes look like verdicts, but most of them are closer to shrugs.
A 404 tells a client that a URL currently resolves to nothing worth serving; it
carries no opinion about whether that gap is an accident or a policy.[^1]
Wikipedia's summary of the code puts it plainly: the response is commonly
described in exactly those terms, and its most familiar phrasing is not an
accident of one implementation but a convention repeated across servers.[^2]

410 is the sharper tool, and it is sharper by design. Where a 404 refuses to
guess at permanence, the status registered as Gone is defined to assert it: the
origin is telling you, on purpose, that the resource is not coming back and
that you should stop linking to it.[^3] The specification that governs both
codes is explicit that the choice between them is a statement about server
knowledge, not server mood - a 410 is only correct when an origin actually
knows the departure is permanent, and 404 remains the honest default
otherwise.[^4]

None of this is a judgment about whether the content that used to live at a
URL was worth keeping. It is bookkeeping - and reading it as anything richer
is where citation checking earns its keep.

[^1]: MDN Web Docs, "404 Not Found", <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/404>
[^2]: Wikipedia, "HTTP 404", <https://en.wikipedia.org/wiki/HTTP_404>
[^3]: MDN Web Docs, "410 Gone", <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/410>
[^4]: IETF, RFC 9110 "HTTP Semantics", <https://www.rfc-editor.org/rfc/rfc9110.html>
