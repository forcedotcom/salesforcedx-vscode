# The services extension is the intended sole host of heavy Salesforce deps

The target is that `salesforcedx-vscode-services` is the only extension that declares the heavy Salesforce libraries (`@salesforce/core`, source-deploy-retrieve, source-tracking, jsforce) as runtime `dependencies`; other extensions work *through* the services API and keep these out of their runtime deps (devDependencies for tests are fine). Motivation: a single API abstraction, shared stateful singletons, web compatibility, and bundle size — every extension ships its own copy of its deps ([Extensions.md](../architecture/Extensions.md) "dependencies"), and jsforce is large.

## Status

In-progress migration; status is keyed to actual `package.json` runtime deps (heavy dep in `dependencies` = legacy, only in `devDependencies` = migrated):

- `salesforcedx-vscode-metadata` — **migrated** (runtime deps are only `effect`/`@salesforce/effect-ext-utils`/i18n/`vscode-uri`; no heavy Salesforce deps).
- `salesforcedx-vscode-org` — **not migrated** (still has `@salesforce/core` in runtime `dependencies`; see its package ADRs — legacy lift-and-shift, not yet services-routed).
- `salesforcedx-vscode-core`, apex, soql — expected legacy; verify the package's `dependencies` before relying on a status.
