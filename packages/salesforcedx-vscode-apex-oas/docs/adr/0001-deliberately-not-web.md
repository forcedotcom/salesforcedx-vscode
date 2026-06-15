# The apex-oas extension is deliberately not web-enabled

`salesforcedx-vscode-apex-oas` has no `browser` field and is intentionally desktop-only: OAS generation depends on the apex extension / Apex LSP (Jorje), which can never run on web (see [root ADR-0016](../../../../docs/adr/0016-apex-jorje-never-web.md)). This is a deliberate "no", not "not yet".
