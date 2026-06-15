# The apex-oas extension is deliberately not web-enabled

`salesforcedx-vscode-apex-oas` has no `browser` field and is intentionally desktop-only: OAS generation depends on the apex extension / Apex LSP (Jorje), which can never run on web (see [apex extension ADR-0001](../../../salesforcedx-vscode-apex/docs/adr/0001-deliberately-not-web.md)). This is a deliberate "no", not "not yet".
