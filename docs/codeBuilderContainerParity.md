# Code Builder container e2e — coverage ledger

Tracks, per package, which Playwright specs run as **Code Builder container** specs (driven by a
browser against the real image, running the desktop extension build in a Node host — see ADR 0022)
and which cannot, with the reason.

The goal here is **maximal** container coverage: every spec that *can* run against the container is
ported. That is bounded by three hard constraints of the container model, so it is **not** a 1:1
port of the desktop/web suites:

1. **One shared, persistent workbench.** All container specs drive the single code-server the
   orchestrator stands up ([`scripts/codeBuilderLocalE2E.ts`](../scripts/codeBuilderLocalE2E.ts)) —
   there is no fresh instance per spec. They run **serially** (`workers: 1`, `fullyParallel: false`)
   and each hardens for leftover state: `beforeEach` closes editors + clears notifications, created
   artifacts use unique (`Date.now()`) names, and assertions avoid absolute/global counts.
2. **One boot-authed tracking org.** A single tracking scratch org is authed at container boot and
   is the default target-org. Specs cannot create/delete/switch orgs or do interactive web login;
   org-dependent specs were rewired from `createMinimalOrg`/`setupNonTrackingOrgAndAuth`/etc. to the
   boot org, deploying what they need to it first.
3. **One mounted fixture workspace.** The
   [`container-workspace`](../packages/salesforcedx-vscode-core/test/playwright/fixtures/container-workspace)
   fixture (Apex classes `PagedResult`/`ExampleClass` + tests, an anonymous-Apex script, an `aura1`
   bundle). Specs needing a different workspace shape (no-folder, empty, multi-package) can't run.

Because the container runs the **desktop build** in a Node host, it is strictly *more* capable than
VS Code Web (the Apex/Aura/LWC language servers, `child_process`, and the `sf` CLI are all present),
so many specs that are `isDesktop()`-gated in the web suite run here — those gates are dropped in the
container ports.

## Coverage summary — 75 specs across 15 packages

| Package | Specs | Container specs |
| --- | --: | --- |
| `salesforcedx-vscode-metadata` | 17 | deploy (Source/Path/Palette/Manifest/OnSave), retrieve (Source/Manifest/StaleApiVersion), deleteSource, sourceDiff(+Multiple), viewChangesCommands, generateManifest, editorWatcher, projectDeployStart, projectInfo, packageInstall |
| `salesforcedx-vscode-lwc` | 10 | generateComponent, rename, snippets, customComponentsIndex + LSP (autocomplete, goToDefinition Html/Js, hover, indexing, sfdxTypings) |
| `salesforcedx-vscode-apex-testing` | 9 | testExplorer, runApexTests (CodeLens/CommandPalette/FailAndFix), apexTestSuite(+Delete), clearApexTestResults, codeCoverageColorizer, staleTestResultsRestoration |
| `salesforcedx-vscode-apex-log` | 8 | executeAnonymous, logRetrieval, apexGenerateClass, apexTestClassCreate, createApexTrigger, autoCollection, traceFlagsCrud, traceFlagExpiry |
| `salesforcedx-vscode-org` | 6 | orgDisplay, aliasList, orgOpen, orgCommands, orgDeleteCommandVisibility, orgLoginAccessToken |
| `salesforcedx-vscode-apex` | 4 | apexLsp (go-to-def/autocomplete), apexLspHover, apexLspRestart, apexSnippets |
| `salesforcedx-vscode-lightning` | 4 | auraLspAutocompletion, auraLspGoToDefinition, auraRename, auraTemplates |
| `salesforcedx-vscode-org-browser` | 4 | orgBrowser (types), orgBrowser.describe, orgBrowser.filterToggle, orgBrowser.textFilter |
| `salesforcedx-vscode-apex-oas` | 3 | ineligibleClass, mixedFrameworksClass, restResourceNoHttpMethod (all pre-LLM eligibility guards) |
| `salesforcedx-vscode-core` | 3 | configList, seededWorkspace, coreOutputChannel |
| `salesforcedx-vscode-soql` | 2 | soqlRunQuery, soqlQueryPlan |
| `salesforcedx-vscode-visualforce` | 2 | visualforceLsp, visualforceTemplates |
| `salesforcedx-vscode-services` | 1 | retrieveOnLoad (activation + no-op branch) |
| `salesforcedx-vscode-apex-debugger` | 1 | debuggerStop (stop-session command; no DAP) |
| `salesforcedx-vscode-apex-replay-debugger` | 1 | errorPaths (command error-paths; no debug session) |
| `playwright-vscode-ext` | 0 | test library itself — validated by jest + its own `.headless` specs |

The orchestrator auto-discovers every package that declares a `test:container` script, so adding a
suite to a new package wires it in with no orchestrator edit.

## Not ported (and why)

These specs cannot run in the container and stay desktop/web-only. Grouped by the blocking
constraint:

**Interactive debug session (DAP launch/attach/breakpoints/replay)** — apex-replay-debugger:
`apexReplayDebugger`, `apexReplayDebuggerVariables`, `checkpoints`, `debugAnonymousApex`,
`debugApexTests`; apex-debugger: `isvDebugBootstrap`; lwc: `lwcDebugTests`.

**Rate-limited A4V/Einstein LLM (OpenAPI generation)** — apex-oas: `composedCaseManager`,
`composedManualMerge`, `composedOverwrite`, `decomposedSimpleAccount`, `contextMenuEditor`,
`contextMenuExplorer`.

**Requires a different org (non-tracking / second org / dev hub / web login / delete / logout)** —
metadata: `nonTrackingOrgDeployRetrieveManifest`, `nonTrackingOrgDeployRetrieveOperations`,
`nonTrackingOrgTrackingCommandsHidden`, `nonTrackingOrgTrackingUIHidden`, `deleteBundleSource`;
apex-testing: `clearOnLogout`, `orgOnlyClassRetrieve`, `inWorkspaceFilter`; apex-log:
`traceFlagsForOtherUser`; org: `orgLoginWeb`, `orgDeleteUsername`, `orgListClean`, `orgPicker`,
`orgPickers`; core: `workspaceContextOrgSwitch`.

**Requires a different workspace shape (no-folder / empty / multi-package)** — metadata:
`createProject`, `createProjectEmptyWindow`, `createProjectWithManifest`, `emptyWorkspaceSfdxCommands`,
`manifestCommandVisibility`, `noProjectCommandsHidden`; apex-log: `apexGenerateClassMultiPackageDirs`,
`noOrgVisibility`, `noProjectVisibility`; apex-testing: `noOrgVisibility`, `noProjectVisibility`.

**Requires custom/Dreamhouse org metadata a bare scratch org lacks** — org-browser:
`orgBrowser.customObject`, `orgBrowser.customTab`, `orgBrowser.folderedReport` (+ the `Broker__c`
subtests of `textFilter`); metadata: `refreshSObjectDefinitions`, `sourceTrackingStatusBar`.

**Reads local span/telemetry files or needs the spans:server** — apex: `apexTelemetrySpans`;
metadata: `cliEnvSpans`; lightning: `telemetryOutput`, `spanRedaction`; org: `telemetryIdentitySeeding`.

**Webview-only surface** — soql: `soql-builder`, `soql-save-query-results` (SOQL Builder + results
webviews).

**Slow/mutating positive retrieve (writes metadata into the shared fixture)** — services:
`retrieveOnLoadMetadata`, `retrieveOnLoadRetry` (the no-op branch is covered by `retrieveOnLoad`).

**Needs a desktop window reload the web container can't do** — org-browser:
`orgBrowser.filterToggle.desktop`.

**Needs a fixture dev-dependency not in the workspace** — lwc: `lwcRunTests` (`@salesforce/sfdx-lwc-jest`).

## Adding a container suite to a package

1. `test/playwright/playwright.config.container.ts` → `createContainerConfig({ testDir: './specs/container' })`.
2. `test/playwright/fixtures/containerFixtures.ts` → `export const containerTest = createContainerTest()`.
3. `test/playwright/specs/container/<name>.container.spec.ts` importing `containerTest` and only
   plain-`Page` helpers from `@salesforce/playwright-vscode-ext`. Drive the boot org, harden for the
   shared workbench (unique names, `beforeEach` cleanup), and drop `isDesktop()` gates.
4. Add a `test:container` script + wireit block mirroring the other packages.
5. The orchestrator discovers the suite automatically. Update the tables above.
