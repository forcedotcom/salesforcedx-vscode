# Apex Testing Discovery And Artifact Flow

This note documents how Apex Testing currently handles test discovery data and test run artifacts.

## Discovery Flow

- Activation initializes `ApexTestController` in `src/index.ts`.
- Org changes trigger `testController.refresh()` from `initializeTestDiscovery()`.
- `refresh()` in `src/views/testController.ts` deduplicates concurrent calls (later callers join the in-flight refresh rather than starting a second one); calls `doRefresh()`:
  - Ensures org connection and `TestService`.
  - Clears in-memory test items.
  - Populates suites (`retrieveAllSuites()`).
  - Fetches discovered classes from Tooling API via `src/testDiscovery/testDiscovery.ts`.
  - Builds Test Explorer items from discovered classes.

## In-Memory Runtime State

- `ApexTestController` holds maps for suite/class/method items and suite membership.
- Services' `OrgMetadataCatalog` caches metadata inventory and resolves source on demand.
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

## Org Catalog Integration

- Test run artifact persistence (`.sfdx/tools/testresults/apex`) is unchanged.
- Test discovery queries services-owned `OrgMetadataCatalog` presence for each Apex class.
- Workspace classes use their existing `file:` URI.
- Org-only classes use a read-only `sf-org-metadata:` text document supplied by services.
- Source bodies are fetched lazily when the document is opened; discovery does not fetch or persist bodies.
- Apex Testing owns the Test Explorer hierarchy, tags, commands, and retrieve CodeLens.
- Services owns catalog state, org/workspace invalidation, and closing stale catalog documents after an org change.
