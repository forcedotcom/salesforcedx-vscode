---
name: W-20890801 IndexedDB Isolation
overview: Isolate IndexedDB storage per Salesforce org by incorporating the myDomain from the instance URL into the database name, and delete the legacy shared database.
todos:
  - id: parse-mydomain
    content: Add exported `parseMyDomain` function to `indexedDbStorage.ts` that strips known Salesforce domain suffixes from the hostname (`.my.salesforce.com`, `.my.salesforce.mil`, `.my-salesforce.com`, `.my.sfcrmproducts.cn`)
    status: completed
  - id: dynamic-db-name
    content: Replace static `DB_NAME` with `getDbName()` that reads instance URL from vscode settings and returns `fsProviderDB-${myDomain}`
    status: completed
  - id: delete-old-db
    content: Add `indexedDB.deleteDatabase('fsProviderDB')` call in the scoped factory before opening the new DB
    status: completed
  - id: unit-tests
    content: Add unit tests for `parseMyDomain` covering production, sandbox, scratch, and edge case URLs
    status: completed
  - id: verify-compile
    content: Run `npm run compile` and fix any errors
    status: completed
  - id: verify-lint
    content: Run `npm run lint` and fix any new warnings/errors
    status: completed
  - id: verify-test
    content: Run `npm run test` and ensure all tests pass
    status: completed
  - id: verify-bundle
    content: Run `npm run vscode:bundle` to ensure extensions still bundle
    status: completed
  - id: verify-knip
    content: Run `npx knip` to check for dead code
    status: completed
  - id: e2e-services
    content: Run `npm run test:web -w salesforcedx-vscode-services -- --retries 0`
    status: completed
  - id: e2e-metadata
    content: Run `npm run test:web -w salesforcedx-vscode-metadata -- --retries 0`
    status: completed
  - id: e2e-apex-testing
    content: Run `npm run test:web -w salesforcedx-vscode-apex-testing -- --retries 0`
    status: completed
  - id: e2e-org-browser
    content: Run `npm run test:web -w salesforcedx-vscode-org-browser -- --retries 0`
    status: completed
isProject: false
---

# W-20890801: Isolate IndexedDB Per-Org via myDomain

## Problem

CBW executes from a CDN origin, so all orgs share the same IndexedDB origin. The current static `DB_NAME = 'fsProviderDB'` means different orgs collide in storage.

## Approach

Parse the myDomain from the instance URL setting (always available on web) and use it as part of the DB name. Delete the old static DB on construction.

### Salesforce Instance URL Formats

Per `[sfdcUrl.ts` in sfdx-core]([https://github.com/forcedotcom/sfdx-core/blob/2ab8c4734fe2834b919ebe3c69d465fe3f1312bc/src/util/sfdcUrl.ts](https://github.com/forcedotcom/sfdx-core/blob/2ab8c4734fe2834b919ebe3c69d465fe3f1312bc/src/util/sfdcUrl.ts)), there are four domain families:

- `.my.salesforce.com` — standard enhanced domains
- `.my.salesforce.mil` — military/government
- `.my-salesforce.com` — alternative domains (hyphen, not dot)
- `.my.sfcrmproducts.cn` — China/Alibaba Cloud

**Approach**: strip these known suffixes from the hostname to extract the org identifier:

- Production: `https://acme.my.salesforce.com` -> `acme`
- Sandbox: `https://acme--dev.sandbox.my.salesforce.com` -> `acme--dev.sandbox`
- Scratch: `https://speed-inspiration-1234-dev-ed.scratch.my.salesforce.com` -> `speed-inspiration-1234-dev-ed.scratch`
- Military: `https://acme.my.salesforce.mil` -> `acme`
- Alternative: `https://acme.my-salesforce.com` -> `acme`
- China: `https://acme.my.sfcrmproducts.cn` -> `acme`
- Internal/unknown: fallback to full hostname

```typescript
const SALESFORCE_DOMAIN_SUFFIXES = [
  '.my.salesforce.com',
  '.my.salesforce.mil',
  '.my-salesforce.com',
  '.my.sfcrmproducts.cn'
];

export const parseMyDomain = (instanceUrl: string): string => {
  const { hostname } = new URL(instanceUrl);
  const suffix = SALESFORCE_DOMAIN_SUFFIXES.find(s => hostname.endsWith(s));
  return suffix ? hostname.slice(0, -suffix.length) : hostname;
};
```

This naturally avoids collisions between org types (sandbox includes `.sandbox`, scratch includes `.scratch`).

## File Changes

### 1. [indexedDbStorage.ts](packages/salesforcedx-vscode-services/src/virtualFsProvider/indexedDbStorage.ts)

- Import `CODE_BUILDER_WEB_SECTION` and `INSTANCE_URL_KEY` from `../constants`
- Add exported `parseMyDomain(instanceUrl: string): string` — strips known Salesforce domain suffixes from hostname; falls back to full hostname if no known suffix found
- Replace static `DB_NAME = 'fsProviderDB'` with a `getDbName()` function that reads `vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION).get(INSTANCE_URL_KEY)` directly (bypassing SettingsService, which isn't in the layer graph at this point) and returns `fsProviderDB-${parseMyDomain(url)}`
- In the `scoped` factory, before opening the new DB, delete the old `fsProviderDB` database via `indexedDB.deleteDatabase('fsProviderDB')`
- Update the `indexedDB.open(...)` call to use `getDbName()` instead of the static constant

Key detail: both `IndexedDBStorageServiceShared` (used in `fileSystemSetup`) and the daemon in `memfsWatcher.ts` (which uses `IndexedDBStorageService.Default` directly) go through the same scoped factory, so both will read the same setting and open the same per-org database. No changes needed in `memfsWatcher.ts`.

### 2. Tests for `parseMyDomain`

Add unit tests covering all domain families from `sfdcUrl.ts`:

- Production: `https://acme.my.salesforce.com` -> `acme`
- Sandbox: `https://acme--dev.sandbox.my.salesforce.com` -> `acme--dev.sandbox`
- Scratch: `https://mycorp.scratch.my.salesforce.com` -> `mycorp.scratch`
- Military: `https://acme.my.salesforce.mil` -> `acme`
- Alternative: `https://acme.my-salesforce.com` -> `acme`
- China: `https://acme.my.sfcrmproducts.cn` -> `acme`
- URL with trailing path: `https://acme.my.salesforce.com/` -> `acme`
- Edge: unknown hostname (fallback to full hostname)

## Design Decisions

- **Read setting directly via vscode API, not SettingsService**: `IndexedDBStorageService` constructs before `globalLayers` (which contain `SettingsService`). The setting is a workspace-level config available immediately.
- **Delete old DB, no migration**: per user direction. `indexedDB.deleteDatabase('fsProviderDB')` is idempotent and non-blocking.
- **memfsWatcher untouched**: its separate `IndexedDBStorageService.Default` instance reads the same setting and gets the same DB name. Two connections to the same DB is fine.

## Verification

- `npm run compile`
- `npm run lint`
- `npm run test`
- `npm run vscode:bundle`
- `npx knip`
- `npm run test:web -w salesforcedx-vscode-services -- --retries 0`
- `npm run test:web -w salesforcedx-vscode-metadata -- --retries 0`
- `npm run test:web -w salesforcedx-vscode-apex-testing -- --retries 0`
- `npm run test:web -w salesforcedx-vscode-org-browser -- --retries 0`
