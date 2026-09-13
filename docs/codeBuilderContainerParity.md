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

## Coverage summary — 108 specs across 15 packages

Includes multi-org / Dreamhouse ports (see "Multi-org container support" below): 13 previously
org-blocked specs now run by authing extra orgs + switching default with save/restore; 2 ported but
`test.fixme` for code-server limits. Includes the 6 apex-replay **interactive-debug** specs — a live
DAP replay session driven through code-server. Includes the **reachable-with-work** ports run via
orchestrator re-seed phases that boot a different workspace shape at a phase boundary (verify-gate
re-run after each restart): **no-project** (phase 2), **no-folder** (phase 3), **multi-package** (phase
4), and **no-org** (phase 5, an org-less container boot). All verified green.

Count is container spec **files**: 106 active + 2 `test.fixme`.

| Package | Specs | Container specs |
| --- | --: | --- |
| `salesforcedx-vscode-metadata` | 29 | deploy (Source/Path/Palette/Manifest/OnSave), retrieve (Source/Manifest/StaleApiVersion), deleteSource, sourceDiff(+Multiple), viewChangesCommands, generateManifest, editorWatcher, projectDeployStart, projectInfo, packageInstall, nonTrackingOrgDeployRetrieve(Manifest/Operations), refreshSObjectDefinitions, sourceTrackingStatusBar, manifestCommandVisibility, noProjectCommandsHidden, **analyticsTemplates, taggedErrorChannelOutput, emptyWorkspaceSfdxCommands (no-project + no-folder)** + nonTrackingOrgTracking(Commands/UI)Hidden (`fixme`) |
| `salesforcedx-vscode-lwc` | 10 | generateComponent, rename, snippets, customComponentsIndex + LSP (autocomplete, goToDefinition Html/Js, hover, indexing, sfdxTypings) |
| `salesforcedx-vscode-apex-testing` | 14 | testExplorer(+Run), runApexTests (CodeLens/CommandPalette/FailAndFix), apexTestSuite(+Delete), clearApexTestResults, codeCoverageColorizer, staleTestResultsRestoration, orgOnlyClassRetrieve, inWorkspaceFilter, **noProjectVisibility, noOrgVisibility** |
| `salesforcedx-vscode-org-browser` | 8 | orgBrowser (types), orgBrowser.describe, orgBrowser.filterToggle, orgBrowser.textFilter, **orgBrowserCustomObject, orgBrowserCustomTab, orgBrowserFolderedReport, orgBrowserTextFilterDreamhouse** |
| `salesforcedx-vscode-apex-log` | 11 | executeAnonymous, logRetrieval, apexGenerateClass, apexTestClassCreate, createApexTrigger, autoCollection, traceFlagsCrud, traceFlagExpiry, **noProjectVisibility, apexGenerateClassMultiPackageDirs, noOrgVisibility** |
| `salesforcedx-vscode-org` | 8 | orgDisplay, aliasList, orgOpen, orgCommands, orgDeleteCommandVisibility, orgLoginAccessToken, **orgPicker, orgPickers** |
| `salesforcedx-vscode-apex` | 4 | apexLsp (go-to-def/autocomplete), apexLspHover, apexLspRestart, apexSnippets |
| `salesforcedx-vscode-lightning` | 4 | auraLspAutocompletion, auraLspGoToDefinition, auraRename, auraTemplates |
| `salesforcedx-vscode-core` | 4 | configList, seededWorkspace, coreOutputChannel, **workspaceContextOrgSwitch** |
| `salesforcedx-vscode-apex-oas` | 3 | ineligibleClass, mixedFrameworksClass, restResourceNoHttpMethod (all pre-LLM eligibility guards) |
| `salesforcedx-vscode-soql` | 2 | soqlRunQuery, soqlQueryPlan |
| `salesforcedx-vscode-visualforce` | 2 | visualforceLsp, visualforceTemplates |
| `salesforcedx-vscode-services` | 1 | retrieveOnLoad (activation + no-op branch) |
| `salesforcedx-vscode-apex-debugger` | 1 | debuggerStop (stop-session command; no DAP) |
| `salesforcedx-vscode-apex-replay-debugger` | 7 | errorPaths + **apexReplayDebugger, apexReplayDebuggerVariables, checkpoints, debugAnonymousApex, debugApexTests, promptForLogFile** (live DAP replay session in code-server) |
| `playwright-vscode-ext` | 0 | test library itself — validated by jest + its own `.headless` specs |

The orchestrator auto-discovers every package that declares a `test:container` script, so adding a
suite to a new package wires it in with no orchestrator edit.

### Origin-spec coverage tally

How the container suite maps back to the original desktop/web (`.desktop`/`.headless`/`.spec`) specs
it was ported from. **Origin** counts product specs only — the 10 `playwright-vscode-ext` specs test
the shared test *library* itself, not a product feature, so they're excluded. **Ported** is origin
specs that now have container coverage; the container has 5 more spec *files* than that (99 total)
from container-only splits/additions (`seededWorkspace`, `testExplorerRun`, metadata `deploySource`,
2 org-browser variants).

| Package | Origin | Ported | Not ported |
| --- | --: | --: | --: |
| `salesforcedx-vscode-metadata` | 32 | 27 | 5 |
| `salesforcedx-vscode-apex-testing` | 14 | 13 | 1 |
| `salesforcedx-vscode-lwc` | 13 | 10 | 3 |
| `salesforcedx-vscode-apex-log` | 12 | 11 | 1 |
| `salesforcedx-vscode-org` | 12 | 8 | 4 |
| `salesforcedx-vscode-apex-oas` | 9 | 3 | 6 |
| `salesforcedx-vscode-apex-replay-debugger` | 7 | 7 | 0 |
| `salesforcedx-vscode-org-browser` | 7 | 6 | 1 |
| `salesforcedx-vscode-lightning` | 6 | 4 | 2 |
| `salesforcedx-vscode-apex` | 5 | 4 | 1 |
| `salesforcedx-vscode-services` | 4 | 1 | 3 |
| `salesforcedx-vscode-soql` | 4 | 2 | 2 |
| `salesforcedx-vscode-core` | 3 | 3 | 0 |
| `salesforcedx-vscode-apex-debugger` | 2 | 1 | 1 |
| `salesforcedx-vscode-visualforce` | 2 | 2 | 0 |
| **Total** | **132** | **102 (77%)** | **30** |

The 30 not-ported specs by blocking constraint — **all now hard-blocked** (every reachable-with-work
spec has been ported):

| Blocking constraint | Count |
| --- | --: |
| Rate-limited A4V/Einstein LLM (apex-oas) | 6 |
| Destructive org lifecycle / second org user | 6 |
| Reads span/telemetry files | 5 |
| Different workspace shape — create-project on disk (host-fs + `openFolder`) | 3 |
| Interactive debug session / DAP — hard-blocked (`isvDebugBootstrap` live org session, `lwcDebugTests` jest dep + debug) | 2 |
| Webview-only surface | 2 |
| Slow/mutating positive retrieve | 2 |
| Reload-flakiness in web / native file-watch event not delivered | 2 |
| Dev/Test-only internal command | 1 |
| Needs a fixture dev-dependency (`sfdx-lwc-jest`) | 1 |
| **Total** | **30** |

All 30 remaining specs are hard-blocked by the container model (below). The reachable-with-work set —
the 2 metadata "reachable" specs, the no-project / no-folder visibility specs, the multi-package spec,
and the no-org-boot specs — has all been ported via the re-seed phases and verified green. The only
workspace-shape specs still out are the three `createProject*` (scaffold on disk + `openFolder`), which
remain hard-blocked.

## Not ported (and why)

These specs cannot run in the container and stay desktop/web-only. Grouped by the blocking
constraint:

**Interactive debug session — hard-blocked** — apex-debugger: `isvDebugBootstrap` (needs a live
org-side `ApexDebuggerSession` behind an ISV/Debug-Only license, uncreatable in CI); lwc:
`lwcDebugTests` (js-debug + jest, needs `@salesforce/sfdx-lwc-jest` baked into the fixture). The 6
apex-replay debug specs (`apexReplayDebugger`, `apexReplayDebuggerVariables`, `checkpoints`,
`debugAnonymousApex`, `debugApexTests`, `promptForLogFile`) are now **ported and green** — see the
apex-replay-debugger row above and "Debug / DAP portability assessment".

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

**Requires a different workspace shape — create-project on disk (hard-blocked)** — metadata:
`createProject`, `createProjectEmptyWindow`, `createProjectWithManifest`. These scaffold a new project
to disk and end with `vscode.openFolder`; they assert files via host `node:fs` (the container FS isn't
visible unless under the bind mount) and re-navigate the workbench, so they stay desktop-only. Every
other workspace-shape spec is now ported via the re-seed phases: `manifestCommandVisibility`,
`noProjectCommandsHidden`, `emptyWorkspaceSfdxCommands` (no-project + no-folder), apex-log/apex-testing
`noProjectVisibility` and `noOrgVisibility`, and apex-log `apexGenerateClassMultiPackageDirs` — see
"Workspace-shape portability assessment" below.

**Reads local span/telemetry files or needs the spans:server** — apex: `apexTelemetrySpans`;
metadata: `cliEnvSpans`; lightning: `telemetryOutput`, `spanRedaction`; org: `telemetryIdentitySeeding`.

**Webview-only surface** — soql: `soql-builder`, `soql-save-query-results` (SOQL Builder + results
webviews).

**Slow/mutating positive retrieve (writes metadata into the shared fixture)** — services:
`retrieveOnLoadMetadata`, `retrieveOnLoadRetry` (the no-op branch is covered by `retrieveOnLoad`).

**Reload-flakiness in web, or a native file-watch event the container can't deliver** — org-browser:
`orgBrowser.filterToggle.desktop`; lwc: `lwcLspSfdxProjectWatcher`. `reloadWindow` (`Developer: Reload
Window`) *does* work in code-server — the block is narrower: `filterToggle` verifies state persistence
*across a reload*, and in the web/dev harness a reload is a full page reload that re-fetches extension
bundles from the dev web server (a flakiness source unrelated to the assertion), so the desktop twin
covers it more reliably. `lwcLspSfdxProjectWatcher` mutates `sfdx-project.json` and asserts the
debounced FS-watcher restarts the LWC LSP — that relies on a cross-extension-host config/FS **event**
code-server doesn't deliver at runtime (the real limitation behind the `test.fixme`'d tracking specs),
which a reload would mask rather than test.

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
org switch — so the tracking UI doesn't hide after switching to a non-tracking org. A window reload
*would* refresh it (reload works in code-server), but that would mask the real gap — the metadata
extension is a separate host and should observe the switch without a reload — so these are `fixme`'d
pending a product fix rather than papered over. (`sourceTrackingStatusBar` avoids this by testing the
boot org, which is tracking + default from activation.)

## Reachable but not yet ported

None — both formerly-reachable specs are now ported and green:

- **metadata `analyticsTemplates`** — Analytics/wave sample template via palette + explorer context menu
  (local `TemplateService.create` scaffold, no org); on the standard fixture + boot org.
- **metadata `taggedErrorChannelOutput`** — deploy-in-manifest with no manifest asserts the tagged
  `[ManifestSelectionRequiredError]` on the channel; rewired off `createMinimalOrg` to the boot org.

With these done, **every reachable-with-work spec has been ported** — the 30 remaining not-ported specs
are all hard-blocked by the container model.

## Debug / DAP portability assessment

**Status: DONE for the 6 apex-replay specs — ported and verified green.** A feasibility review found
7 of the 8 reachable and 1 permanently blocked; the gating unknown (can a live DAP session render
through code-server?) was retired by a spike, and the 6 apex-replay specs now pass green both in
isolation on a cold Apex LS and in the full serial suite. `isvDebugBootstrap` stays hard-blocked (live
org-side session); `lwcDebugTests` needs the jest dep baked in. Notable fixes to reach green: replaced
a context-sensitive "Indexing complete" gate with the test-class Run/Debug CodeLens gate, inlined
`@IsTest` annotations (a completion-accept was swallowing the newline and merging the annotation into
the class decl), a robust `activateEditorTab` helper (Quick Open intermittently returned an unclickable
grouped row — the dominant flake), an LS-readiness retry on Update Checkpoints, and an
`expandAllVariableScopes` rewrite (the empty Global scope never expands). The per-spec table and
work-items below are retained for history.

**Why it isn't already done:** the two shipped container debug twins
(`apex-replay-debugger/.../container/errorPaths` and `apex-debugger/.../container/debuggerStop`) were
*deliberately* scoped to the command/notification paths that launch **no** debug session — because the
container fixture exposes only a `page` (no host-filesystem handle to the workspace) and the shared
serial workbench makes a running debug session hazardous. Nobody has yet driven a **live DAP session**
through code-server over the browser.

**Adapters:** apex-replay is a bundled **local Node** adapter (`type:"apex-replay"`, replays a log
file, no org streaming) — it runs in the container's server-side Node extension host exactly as on
desktop, nothing web-guards it. lwc debug uses VS Code's built-in **js-debug** node adapter. The
interactive/ISV apex debugger (`type:"apex"`) needs a **live org-side `ApexDebuggerSession`** behind an
ISV/Debug-Only license — not creatable against a CI scratch org.

**Debug UI driving:** all existing debug driving is client-agnostic Monaco DOM (`.debug-toolbar`,
`.debug-variables`, `.debug-call-stack`, `.repl`, gutter glyphs) + F5/F9 + palette — none of it is
Electron-specific, so it *should* work against code-server. There are currently **no shared debug-view
helpers** in `playwright-vscode-ext`; specs hand-roll it plus a local `continueDebugSession`.

| Spec | Adapter / flow | Verdict |
| --- | --- | --- |
| `apexReplayDebugger` | local Node replay; launch + continue | reachable (gated on spike) |
| `apexReplayDebuggerVariables` | local Node replay; breakpoint + VARIABLES tree — full debug UI | reachable (highest value) |
| `checkpoints` | local Node replay + org checkpoint upload | reachable |
| `debugAnonymousApex` | local Node replay; debug codelens/selection | reachable |
| `debugApexTests` | local Node replay; Test Explorer "Debug Test" | reachable |
| `promptForLogFile` | F5 to reach log-file quick input | reachable (needs seeded `launch.json`) |
| `lwcDebugTests` | js-debug + jest `--inspect-brk` | reachable (needs `sfdx-lwc-jest` baked into fixture + result-verify rework) |
| `isvDebugBootstrap` | live ISV org-side debug session | **blocked** (only its command-availability/cancel slice ports) |

**What it would take (ranked):**

1. **Spike (HARD, do first):** launch the apex-replay Node adapter in the running container and confirm
   `.debug-toolbar` + `.debug-variables` render and F5-continue works over the browser. The port's
   viability hinges on this — there is zero precedent of a live DAP session in code-server.
2. **(MEDIUM)** Add reusable debug-view helpers to `playwright-vscode-ext` (continue/step/toggle-
   breakpoint/read-variables/end-session) with a hazard-safe `afterEach` session-teardown guard.
3. **(MEDIUM)** Seed an inert `launch.json` into the fixture (for `promptForLogFile`) and add
   `beforeEach` breakpoint/checkpoint reset + running-session guard for the shared workbench.
4. **(MEDIUM)** Give container specs a host-readable handle to the mounted fixture, or convert
   fs-polling assertions (`promptForLogFile`, `lwcDebugTests`) to UI-state assertions.
5. **(MEDIUM–HARD)** Bake `@salesforce/sfdx-lwc-jest` + an LWC-with-test into the container fixture/image
   for `lwcDebugTests`.
6. **(MEDIUM, gated on 1)** Port the 6 replay/LWC specs — swap fixture to `containerTest`, drop per-test
   org setup for the boot org (as `errorPaths.container` already does).
7. **BLOCKED:** `isvDebugBootstrap` real bootstrap — org-side `ApexDebuggerSession` unavailable in CI.

## Workspace-shape portability assessment

The 9 remaining "different workspace shape" specs are blocked by harness constraints. Every shape change
must occur at a **phase boundary** (re-seed `coder.json` + `restart()` at suite transitions), never
mid-suite—mutating the shared serial session corrupts the workbench for downstream specs. This is a
shared-session integrity cost, not a code-server limit; `restart()` at phase boundaries works fully.

| Spec(s) | Shape needed | Verdict |
| --- | --- | --- |
| metadata `manifestCommandVisibility` | standard project + org (= current fixture) | **DONE** — ported; writes `*Package.xml`/`.xml` into bind-mounted fixture via `CB_FIXTURE_HOST_DIR` env; runs against ambient boot org in phase 1 |
| metadata `noProjectCommandsHidden` | folder, no `sfdx-project.json` | **DONE** — ported; orchestrator re-seeds `coder.json` to non-project mount + `restart()`s in phase 2, re-runs verify gate, then runs `test:container:noproject`. Re-seed spike: **PASS** ✓ |
| apex-log/apex-testing `noProjectVisibility`, metadata `emptyWorkspaceSfdxCommands` | folder open, no `sfdx-project.json` / no folder open | **DONE** — ported; org-agnostic palette-visibility checks via phase 2 (`test:container:noproject`) + a new phase 3 (`test:container:nofolder`) for the no-folder case |
| apex-log `apexGenerateClassMultiPackageDirs` | multi-`packageDirectories` project | **DONE** — ported via a new phase 4 + a separate `container-multipackage` mount (2 `packageDirectories`, each with a `classes` dir); shared fixture left single-package |
| apex-log/apex-testing `noOrgVisibility` | DX project, **no org** | **DONE** — ported via a new phase 5: `bootEnv` made optional, org-less container boot (tears down + fresh `run()` without org env, since `restart()` reuses baked env), re-gates cleanly; default org-boot unchanged |
| metadata `createProject`, `createProjectEmptyWindow`, `createProjectWithManifest` | scaffold new project on disk | **BLOCKED** — container FS invisible outside bind mounts; `vscode.openFolder` (harder than reload, re-navigates workbench); low value-to-cost |

**Phased re-seed infrastructure:** after the standard org-authed suites (phase 1), the orchestrator
runs a sequence of shape-change phases, each re-seeding `coder.json` to a different mounted workspace,
`restart()`ing (or, for no-org, tearing down + a fresh org-less `run()` since `restart()` reuses the
baked env), re-running the verify gate, then running that shape's auto-discovered suite:
- **Phase 2 — no-project** (`container-noproject` fixture, `test:container:noproject`)
- **Phase 3 — no-folder** (`coder.json` with no `folder` key, `test:container:nofolder`)
- **Phase 4 — multi-package** (`container-multipackage` fixture with 2 `packageDirectories`, `test:container:multipackage`)
- **Phase 5 — no-org** (`bootEnv` optional → org-less boot on the standard DX fixture, `test:container:noorg`)

New env vars: `CB_FIXTURE_HOST_DIR` (host path of the DX fixture bind mount, for specs writing files),
`CB_GREP` (grep passed via env, not CLI arg, to preserve shell quoting through wireit/npm). Plumbing:
`discoverPackagesWithScript()` generalized for any script name; extra bind mounts in the container
config; `RunSpec.bootEnv` optional (default org-boot argv byte-identical when present).

## Adding a container suite to a package

**Phase 1 (standard DX-project fixture):**

1. `test/playwright/playwright.config.container.ts` → `createContainerConfig({ testDir: './specs/container' })`.
2. `test/playwright/fixtures/containerFixtures.ts` → `export const containerTest = createContainerTest()`.
3. `test/playwright/specs/container/<name>.container.spec.ts` importing `containerTest` and only
   plain-`Page` helpers from `@salesforce/playwright-vscode-ext`. Drive the boot org, harden for shared
   workbench (unique names, `beforeEach` cleanup), drop `isDesktop()` gates.
4. Add `test:container` script + wireit block (mirrors other packages; accept `CODE_BUILDER_URL` env,
   forward `CB_GREP` to Playwright).
5. Orchestrator auto-discovers. Update coverage tables.

**Phase 2 (no-project workspace shape):**

For specs requiring a no-project folder (project-gated commands must be hidden):

1. `test/playwright/playwright.config.container.noproject.ts` → `createContainerConfig({ testDir: './specs/container-noproject' })`.
2. `test/playwright/specs/container-noproject/<name>.container.spec.ts` — same patterns as phase 1.
3. Add `test:container:noproject` script + wireit block (same env vars as `test:container`).
4. Orchestrator auto-discovers `test:container:noproject` scripts; runs phase 2 after phase 1. Specs
   run against the mounted non-project folder after re-seed + `restart()`.
