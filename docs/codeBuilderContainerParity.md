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

## Coverage summary — 91 specs across 15 packages

Includes the multi-org / Dreamhouse ports (see "Multi-org container support" below): 13 previously
org-blocked specs now run by authing extra orgs into the container and switching the default with
save/restore; 2 more are ported but `test.fixme` for a documented code-server limitation.

Count is container spec **files**: 89 active + 2 `test.fixme`. Two origin specs are reachable but not
yet ported — see "Reachable but not yet ported" below.

| Package | Specs | Container specs |
| --- | --: | --- |
| `salesforcedx-vscode-metadata` | 23 | deploy (Source/Path/Palette/Manifest/OnSave), retrieve (Source/Manifest/StaleApiVersion), deleteSource, sourceDiff(+Multiple), viewChangesCommands, generateManifest, editorWatcher, projectDeployStart, projectInfo, packageInstall, **nonTrackingOrgDeployRetrieve(Manifest/Operations), refreshSObjectDefinitions, sourceTrackingStatusBar** + nonTrackingOrgTracking(Commands/UI)Hidden (`fixme`) |
| `salesforcedx-vscode-lwc` | 10 | generateComponent, rename, snippets, customComponentsIndex + LSP (autocomplete, goToDefinition Html/Js, hover, indexing, sfdxTypings) |
| `salesforcedx-vscode-apex-testing` | 12 | testExplorer(+Run), runApexTests (CodeLens/CommandPalette/FailAndFix), apexTestSuite(+Delete), clearApexTestResults, codeCoverageColorizer, staleTestResultsRestoration, **orgOnlyClassRetrieve, inWorkspaceFilter** |
| `salesforcedx-vscode-org-browser` | 8 | orgBrowser (types), orgBrowser.describe, orgBrowser.filterToggle, orgBrowser.textFilter, **orgBrowserCustomObject, orgBrowserCustomTab, orgBrowserFolderedReport, orgBrowserTextFilterDreamhouse** |
| `salesforcedx-vscode-apex-log` | 8 | executeAnonymous, logRetrieval, apexGenerateClass, apexTestClassCreate, createApexTrigger, autoCollection, traceFlagsCrud, traceFlagExpiry |
| `salesforcedx-vscode-org` | 8 | orgDisplay, aliasList, orgOpen, orgCommands, orgDeleteCommandVisibility, orgLoginAccessToken, **orgPicker, orgPickers** |
| `salesforcedx-vscode-apex` | 4 | apexLsp (go-to-def/autocomplete), apexLspHover, apexLspRestart, apexSnippets |
| `salesforcedx-vscode-lightning` | 4 | auraLspAutocompletion, auraLspGoToDefinition, auraRename, auraTemplates |
| `salesforcedx-vscode-core` | 4 | configList, seededWorkspace, coreOutputChannel, **workspaceContextOrgSwitch** |
| `salesforcedx-vscode-apex-oas` | 3 | ineligibleClass, mixedFrameworksClass, restResourceNoHttpMethod (all pre-LLM eligibility guards) |
| `salesforcedx-vscode-soql` | 2 | soqlRunQuery, soqlQueryPlan |
| `salesforcedx-vscode-visualforce` | 2 | visualforceLsp, visualforceTemplates |
| `salesforcedx-vscode-services` | 1 | retrieveOnLoad (activation + no-op branch) |
| `salesforcedx-vscode-apex-debugger` | 1 | debuggerStop (stop-session command; no DAP) |
| `salesforcedx-vscode-apex-replay-debugger` | 1 | errorPaths (command error-paths; no debug session) |
| `playwright-vscode-ext` | 0 | test library itself — validated by jest + its own `.headless` specs |

The orchestrator auto-discovers every package that declares a `test:container` script, so adding a
suite to a new package wires it in with no orchestrator edit.

### Origin-spec coverage tally

How the container suite maps back to the original desktop/web (`.desktop`/`.headless`/`.spec`) specs
it was ported from. **Origin** counts product specs only — the 10 `playwright-vscode-ext` specs test
the shared test *library* itself, not a product feature, so they're excluded. **Ported** is origin
specs that now have container coverage; the container has 5 more spec *files* than that (91 total)
from container-only splits/additions (`seededWorkspace`, `testExplorerRun`, metadata `deploySource`,
2 org-browser variants).

| Package | Origin | Ported | Not ported |
| --- | --: | --: | --: |
| `salesforcedx-vscode-metadata` | 32 | 22 | 10 |
| `salesforcedx-vscode-apex-testing` | 14 | 11 | 3 |
| `salesforcedx-vscode-lwc` | 13 | 10 | 3 |
| `salesforcedx-vscode-apex-log` | 12 | 8 | 4 |
| `salesforcedx-vscode-org` | 12 | 8 | 4 |
| `salesforcedx-vscode-apex-oas` | 9 | 3 | 6 |
| `salesforcedx-vscode-apex-replay-debugger` | 7 | 1 | 6 |
| `salesforcedx-vscode-org-browser` | 7 | 6 | 1 |
| `salesforcedx-vscode-lightning` | 6 | 4 | 2 |
| `salesforcedx-vscode-apex` | 5 | 4 | 1 |
| `salesforcedx-vscode-services` | 4 | 1 | 3 |
| `salesforcedx-vscode-soql` | 4 | 2 | 2 |
| `salesforcedx-vscode-core` | 3 | 3 | 0 |
| `salesforcedx-vscode-apex-debugger` | 2 | 1 | 1 |
| `salesforcedx-vscode-visualforce` | 2 | 2 | 0 |
| **Total** | **132** | **86 (65%)** | **46** |

The 46 not-ported specs by blocking constraint:

| Blocking constraint | Count |
| --- | --: |
| Different workspace shape (no-folder / empty / multi-package) | 11 |
| Interactive debug session / DAP | 8 |
| Rate-limited A4V/Einstein LLM (apex-oas) | 6 |
| Destructive org lifecycle / second org user | 6 |
| Reads span/telemetry files | 5 |
| Webview-only surface | 2 |
| Slow/mutating positive retrieve | 2 |
| Needs desktop window reload / native file-watch event | 2 |
| Dev/Test-only internal command | 1 |
| Needs a fixture dev-dependency (`sfdx-lwc-jest`) | 1 |
| **Reachable but not yet ported** | **2** |
| **Total** | **46** |

## Not ported (and why)

These specs cannot run in the container and stay desktop/web-only. Grouped by the blocking
constraint:

**Interactive debug session (DAP launch/attach/breakpoints/replay)** — apex-replay-debugger:
`apexReplayDebugger`, `apexReplayDebuggerVariables`, `checkpoints`, `debugAnonymousApex`,
`debugApexTests`, `promptForLogFile` (F5-launches a debug config to reach the log-file quick input);
apex-debugger: `isvDebugBootstrap`; lwc: `lwcDebugTests`.

**Rate-limited A4V/Einstein LLM (OpenAPI generation)** — apex-oas: `composedCaseManager`,
`composedManualMerge`, `composedOverwrite`, `decomposedSimpleAccount`, `contextMenuEditor`,
`contextMenuExplorer`.

**Destructive org lifecycle (web login / delete / logout / list-clean) or a second org USER** —
metadata: `deleteBundleSource`; apex-testing: `clearOnLogout`; apex-log: `traceFlagsForOtherUser`
(needs a second user in the org); org: `orgLoginWeb`, `orgDeleteUsername`, `orgListClean`. These
mutate or destroy org auth on the ONE shared serial session (or need a second user), which the
multi-org capability below deliberately does not provide. (Non-tracking, org-picker, org-switch, and
Dreamhouse-metadata specs that only READ or SWITCH between pre-provisioned orgs ARE now ported — see
"Multi-org container support".)

**Requires a different workspace shape (no-folder / empty / multi-package)** — metadata:
`createProject`, `createProjectEmptyWindow`, `createProjectWithManifest`, `emptyWorkspaceSfdxCommands`,
`manifestCommandVisibility`, `noProjectCommandsHidden`; apex-log: `apexGenerateClassMultiPackageDirs`,
`noOrgVisibility`, `noProjectVisibility`; apex-testing: `noOrgVisibility`, `noProjectVisibility`.

**Reads local span/telemetry files or needs the spans:server** — apex: `apexTelemetrySpans`;
metadata: `cliEnvSpans`; lightning: `telemetryOutput`, `spanRedaction`; org: `telemetryIdentitySeeding`.

**Webview-only surface** — soql: `soql-builder`, `soql-save-query-results` (SOQL Builder + results
webviews).

**Slow/mutating positive retrieve (writes metadata into the shared fixture)** — services:
`retrieveOnLoadMetadata`, `retrieveOnLoadRetry` (the no-op branch is covered by `retrieveOnLoad`).

**Needs a desktop window reload or native file-watch event the web container can't deliver** —
org-browser: `orgBrowser.filterToggle.desktop`; lwc: `lwcLspSfdxProjectWatcher` (mutates
`sfdx-project.json` and asserts the debounced FS-watcher restarts the LWC LSP — code-server doesn't
deliver the cross-extension-host config/FS event at runtime, the same limitation behind the
`test.fixme`'d tracking specs).

**Dev/Test-only internal command absent in the container** — services: `redactingConsoleLogger`. It
drives `sf.internal.testRedactingConsoleLogger`, which core registers only when
`extensionMode === Development || Test`. The container runs swapped-in **packaged** extensions in
Normal mode, so the command doesn't exist.

**Needs a fixture dev-dependency not in the workspace** — lwc: `lwcRunTests` (`@salesforce/sfdx-lwc-jest`).

## Multi-org container support

The container boots ONE org (token injection). To cover specs that need a NON-tracking org, a second
org to pick/switch between, or Dreamhouse custom metadata, the harness now authenticates ADDITIONAL
pre-created orgs into the running container:

- The CI workflow (`codeBuilderE2E.yml`) provisions the extra org(s) per package — a `--no-track-source`
  scratch org (`nonTrackingTestOrg`) and/or a Dreamhouse org (`orgBrowserDreamhouseTestOrg`, cloned +
  deployed + permset) — and passes their aliases via `CB_EXTRA_ORG_ALIASES`.
- The orchestrator (`scripts/codeBuilderLocalE2E.ts`, `authExtraOrgsIntoContainer`) resolves each org's
  access token + instance URL on the host (un-redacted, via `resolveOrgBootEnv`) and runs
  `sf org login access-token` INSIDE the container **as the `codebuilder` user** (the workbench user,
  so `~/.sf` matches) **after the restart** (the boot re-auth would otherwise wipe it). The org
  extension reads the org list fresh on each picker open, so no window reload is needed.
- Specs switch the default org via the shared `switchDefaultOrgViaPicker` helper (a re-driving poll)
  and RESTORE the boot org in a `finally`, so the shared serial session isn't contaminated.

Ported this way: org `orgPicker`/`orgPickers`, core `workspaceContextOrgSwitch`, apex-testing
`orgOnlyClassRetrieve`/`inWorkspaceFilter` (boot org — org-only is presence, not tracking), metadata
`nonTrackingOrgDeployRetrieve(Manifest/Operations)`/`refreshSObjectDefinitions`/`sourceTrackingStatusBar`,
and org-browser `customObject`/`customTab`/`folderedReport`/`textFilterDreamhouse`.

**Documented `test.fixme` (code-server limitation):** metadata `nonTrackingOrgTrackingCommandsHidden`
and `nonTrackingOrgTrackingUIHidden`. The metadata source-tracking status bar re-evaluates only on a
`~/.sf/config.json` file event, which code-server does not deliver cross-extension-host for a RUNTIME
org switch — so the tracking UI doesn't hide after switching to a non-tracking org without a window
reload the web container can't perform. (`sourceTrackingStatusBar` avoids this by testing the boot
org, which is tracking + default from activation.)

## Reachable but not yet ported

Two origin specs land in none of the blocking constraints above — they *can* run in the container and
are simply not ported yet (both added to develop after the initial parity sweep):

- **metadata `analyticsTemplates`** — creates an Analytics/wave sample template via palette + explorer
  context menu and checks the 7 scaffold files appear. Fully local `TemplateService.create` scaffold:
  no org, no CLI plugin, no webview. A straight port on the same pattern as `generateManifest` /
  lightning `auraTemplates` (unique `Date.now()` names to stay clean on the shared fixture).
- **metadata `taggedErrorChannelOutput`** — runs deploy-in-manifest with no manifest and asserts the
  channel output carries the tagged `[ManifestSelectionRequiredError]`. The error fires on the
  manifest-selection guard before any org round-trip; the only desktop-ism is a `createMinimalOrg`
  call to make the command available, which is exactly the boot-org rewire used by the other ported
  org specs.

Neither is in the current stack; they're the next low-risk coverage additions if we want them.

## Adding a container suite to a package

1. `test/playwright/playwright.config.container.ts` → `createContainerConfig({ testDir: './specs/container' })`.
2. `test/playwright/fixtures/containerFixtures.ts` → `export const containerTest = createContainerTest()`.
3. `test/playwright/specs/container/<name>.container.spec.ts` importing `containerTest` and only
   plain-`Page` helpers from `@salesforce/playwright-vscode-ext`. Drive the boot org, harden for the
   shared workbench (unique names, `beforeEach` cleanup), and drop `isDesktop()` gates.
4. Add a `test:container` script + wireit block mirroring the other packages.
5. The orchestrator discovers the suite automatically. Update the tables above.
