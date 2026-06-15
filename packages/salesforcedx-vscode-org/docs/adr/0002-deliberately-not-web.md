# The org extension is deliberately not web-enabled

`salesforcedx-vscode-org` is intentionally desktop-only (no `browser` field): it manages orgs across the machine — switching and picking the default org — whereas the [Web Console](../../CONTEXT.md) is always single-org (only the org it started in). Cross-org management would break that single-org invariant, so this is a deliberate "no", not "not yet"; being known-never-web, its CLI use is allowed (see [root ADR-0009](../../../../docs/adr/0009-reduce-cli-deps-web-no-cli.md)).
