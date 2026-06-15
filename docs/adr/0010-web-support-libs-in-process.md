# Web support: Salesforce libs run in-process, not via CLI

Web-enabled extensions run the Salesforce libraries in-process (bundle `@salesforce/core` + SDR + source-tracking, build a `Connection` from injected auth, back files with memfs + IndexedDB via `vscode.workspace.fs`) because the browser has no `sf` binary and no local filesystem. The `child_process` branch is tree-shaken at build time (`ESBUILD_PLATFORM === 'web'`); the Effect/services dependency inversion is what lets the same service code run against platform-specific backends. See [Build.md](../Build.md), [Extensions.md](../architecture/Extensions.md), and services `connectionService.ts`/`terminalService.ts`/`runWebAuth.ts`.

## Status

Expands [ADR-0009](./0009-reduce-cli-deps-web-no-cli.md) with the mechanism behind "web must avoid the CLI."

## Consequences

Web status per extension (by `browser` field in `package.json`):

- **Enabled**: services, metadata, org-browser, lwc, apex-log, apex-testing, soql.
- **Deliberately not** (see their ADRs): org, apex-oas, apex/Jorje.
- **Not yet / welcome** (not rejected): replay-debugger, aura/lightning, visualforce.
