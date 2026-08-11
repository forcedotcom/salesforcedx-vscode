# Build execute-anonymous SOAP and retry expired sessions manually

Apex execute anonymous uses `/services/Soap/s` with an Apex `DebuggingHeader` to return the execution log in the same request. jsforce's public SOAP API targets the Partner API and supports `SessionHeader` and `CallOptions`, not the Apex debugging categories or `DebuggingInfo` response required here. We therefore build the Apex SOAP envelope and send it through generic `Connection.request`.

Generic jsforce requests refresh expired sessions only for HTTP 401. Apex SOAP reports an expired session as HTTP 500 with `INVALID_SESSION_ID`; only jsforce's internal SOAP transport recognizes that response. Because our custom envelope bypasses that transport, execute anonymous detects this fault, refreshes the connection, rebuilds the envelope with the new access token, and retries once.
