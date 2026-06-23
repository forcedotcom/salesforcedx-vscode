# Apex Testing Discovery And Artifact Flow

This note documents how Apex Testing currently handles test discovery data and test run artifacts.

## Discovery Flow

- Activation initializes `ApexTestController` in `src/index.ts`.
- Org changes trigger `testController.discoverTests()` from `initializeTestDiscovery()`.
- `discoverTests()` in `src/views/testController.ts`:
  - Ensures org connection and `TestService`.
  - Clears in-memory test items.
  - Populates suites (`retrieveAllSuites()`).
  - Fetches discovered classes from Tooling API via `src/testDiscovery/testDiscovery.ts` using `getConnection()` helper.
  - Builds Test Explorer items from discovered classes.

**Note**: For org operations, use `withDefaultOrg(org => org.query(...))` to acquire a scoped `ServicesOrg` facade (W-22419571). The connection lifetime is managed by services; `ServicesOrg` is the owned, import-free interface for query/create/update/delete. Legacy: `getConnection()` returns a live `@salesforce/core` Connection; this is deprecated in favor of the owned `ServicesOrg` loan pattern.

## In-Memory Runtime State

- `ApexTestController` holds maps for suite/class/method items and suite membership.
- Org-only class source text cached in `src/utils/orgApexClassProvider.ts` via `getConnection()` with 5-min TTL.
- Discovery data fetched from org each refresh; class/method UI state rebuilt in-memory.

## Test Run Artifact Persistence

- Test execution writes files to `.sfdx/tools/testresults/apex` via:
  - `src/utils/pathHelpers.ts`
  - `src/utils/testUtils.ts`
  - `src/utils/testReportGenerator.ts`
- Expected files include:
  - `test-result[-<runId>].json`
  - `test-run-id.txt`
  - `test-result-<runId>-codecoverage.json` (when coverage enabled)
  - report output (`.md` / `.txt`)
- `src/index.ts` listens for file changes and routes matching result JSON events to
  `testController.onResultFileCreate(...)` for Test Explorer result updates.

## Scope For VFS Work

- Keep test run artifact persistence in `.sfdx/tools/testresults/apex` unchanged.
- Introduce VFS management only for discovered Apex test class metadata using `apex-testing:`.
- Metadata XML files (e.g. Apex `-meta.xml` companions in a source-formatted project) are **not** necessarily part of the `apex-testing:` VFS. The virtual tree focuses on discovered class **`.cls`** paths under each org; do not assume XML sidecars are mirrored or addressable on that scheme.
