# Apex Testing Discovery And Artifact Flow

This note documents how Apex Testing currently handles test discovery data and test run artifacts.

## Discovery Flow

- Activation initializes `ApexTestController` in `src/index.ts`.
- Org changes trigger `testController.discoverTests()` from `initializeTestDiscovery()`.
- `discoverTests()` in `src/views/testController.ts`:
  - Ensures org connection and `TestService`.
  - Clears in-memory test items.
  - Populates suites (`retrieveAllSuites()`).
  - Fetches discovered classes from Tooling API via `src/testDiscovery/testDiscovery.ts`.
  - Builds Test Explorer items from discovered classes.

## In-Memory Runtime State

- `ApexTestController` holds maps for suite/class/method items and suite membership.
- Org-only class source text is cached in `src/utils/orgApexClassProvider.ts`.
- Discovery data is fetched from org each refresh; class/method UI state is rebuilt in memory.

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

## VFS For Discovered Classes

- Test run artifact persistence (`.sfdx/tools/testresults/apex`) unchanged.
- `apex-testing:` VFS serves per-org discovered Apex class `.cls` bodies (virtual files, write-only):
  - On discovery refresh, `ApexTestDiscoveryService.saveDiscoveredClasses(orgKey, classes, bodies)` writes per-class `.cls` files to `apex-testing:/orgs/<orgKey>/classes/<namespace>/<className>.cls`.
  - Enables org-only TestItems to open class source for inspection (read-only in editor).
  - `clearOrg(orgKey)` removes the org directory on org removal.
  - Index persistence removed (dead code; test tree always rebuilt from live Tooling API queries).
- Metadata XML files (e.g. `-meta.xml` in source-formatted projects) are **not** part of the `apex-testing:` VFS.
