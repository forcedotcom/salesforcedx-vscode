# Apex Testing Discovery And Artifact Flow

This note documents how Apex Testing currently handles test discovery data and test run artifacts.

## Discovery Flow

- Activation initializes `ApexTestController` in `src/index.ts`.
- Org changes trigger `testController.refresh()` from `initializeTestDiscovery()`.
- `refresh()` in `src/views/testController.ts` resets state then discovers tests:
  - Clears in-memory test state via `resetState()`.
  - Fetches test data via `discoverTests()`.

## Test Suite Create/Edit Completion Sentinel

Suite create (`buildSuite`) and edit (`applyEdits`) operations emit a channel sentinel (`Ended SFDX: Create Apex Test Suite` or `Ended SFDX: Edit Apex Test Suite`) to signal completion for E2E tests. The sentinel fires **after** the refresh completes on success (ensuring the tree is fully rebuilt), but fires **immediately** on failure. This ordering prevents E2E tests gating on the sentinel from racing against an in-flight refresh.

## In-Memory Runtime State

- `ApexTestController` holds maps for suite/class/method items and suite membership.
- Org-only class source text is cached in `src/utils/orgApexClassProvider.ts`.
- Discovery data is fetched from org each refresh; class/method UI state is rebuilt in memory.

## Test Run Artifact Persistence

- Test execution writes files to `.sfdx/tools/testresults/apex` via:
  - `src/utils/pathHelpers.ts` — `getTestResultsFolder` is `Effect.fn`; yields folder URI or `NoDefaultOrgError`/`NoWorkspaceOpenError`
  - `src/utils/testUtils.ts`
  - `src/utils/testReportGenerator.ts`
- Expected files include:
  - `test-result[-<runId>].json`
  - `test-run-id.txt`
  - `test-result-<runId>-codecoverage.json` (when coverage enabled)
  - report output (`.md` / `.txt`)
- `src/index.ts` listens for file changes and routes matching result JSON events to
  `testController.onResultFileCreate(...)` for Test Explorer result updates.
- callers (`apexTestRun.ts`, `apexTestRunCodeAction.ts`, `testController.ts`): yield it in Effect, or `getApexTestingRuntime().runPromise(getTestResultsFolder())`

## Code Coverage Flow

- `CodeCoverageService` — Effect.Service; `Ref<Range[]>` decoration state
- reads result files via `FsService` (not `workspace.fs`); `CoverageItem` = `Schema.Struct`
- pipeline: stat files → filter recent → read+parse (sequential, last-write-wins) → match file → compute line ranges
- errors caught + user notified (channel if warnings disabled)
- `colorizer.ts` — not a Disposable; repaint via `watchActiveEditorForCoverage` fork in `index.ts`
  - subscribes `EditorService.pubsub`, not raw `window.onDidChangeActiveTextEditor`
  - seeds current editor so active editor repaints on subscribe
  - torn down on deactivation via scope

## VFS For Discovered Classes

- Test run artifact persistence (`.sfdx/tools/testresults/apex`) unchanged.
- `apex-testing:` VFS serves per-org discovered Apex class `.cls` bodies (virtual files, write-only):
  - On discovery refresh, `ApexTestDiscoveryService.saveDiscoveredClasses(orgKey, classes, bodies)` writes per-class `.cls` files to `apex-testing:/orgs/<orgKey>/classes/<namespace>/<className>.cls`.
  - Enables org-only TestItems to open class source for inspection (read-only in editor).
  - `clearOrg(orgKey)` removes the org directory on org removal.
  - Index persistence removed (dead code; test tree always rebuilt from live Tooling API queries).
- Metadata XML files (e.g. `-meta.xml` in source-formatted projects) are **not** part of the `apex-testing:` VFS.
