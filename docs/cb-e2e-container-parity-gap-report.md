# Code Builder E2E — Container Spec Parity Gap Report

**Generated:** 2026-09-09
**Updated:** 2026-09-10 — REVIEW items in categories **A**, **B**, and **C.9** have been addressed. See the status tags in the **Consolidated REVIEW items** section below. All applied fixes were validated **15/15 green** in CB e2e run `34427132932`; C.9 was confirmed **not-workable** (packaging gap) with evidence.
**Branch:** `jh/W-23898517-cb-e2e-verify-gate` (parity work on `jh/W-23898526-cb-e2e-parity`, PR #8102)
**Scope:** Every `*.container.spec.ts` under `packages/*/test/playwright/specs/container/` compared against the origin Playwright spec (`.headless.spec.ts` / `.desktop.spec.ts`) it was ported from.

## What this is

Each Code Builder (CB) container spec is a port of an existing desktop/headless Playwright spec, adapted to run the **desktop extension build inside the Code Builder image**, driven by a Chromium page against code-server (a **web** client), sharing **one persistent workbench + one boot-authed scratch org + one mounted fixture project** across all specs in a package. This report is the parity ledger: for every container spec it enumerates the concrete differences vs its twin and classifies each:

- **`[ENV]`** — a difference forced by the container/web-client/shared-org runtime (legitimate; not a coverage loss).
- **`[INTENTIONAL-GAP]`** — a deliberate coverage reduction where the dropped behavior is still covered by the twin.
- **`[REVIEW]`** — a potential **unintended** gap, silent divergence, or weakened assertion worth a human decision.

Methodology: one read-only review agent per package read both the container spec and its twin(s) in full. No code was changed during the review pass. The fixes recorded under the status tags below were applied afterward (2026-09-10) and CI-validated; the per-package detail sections further down remain the original point-in-time analysis.

## Summary

| Package | Container specs | REVIEW items | Status (updated 2026-09-10) |
|---|---|---|---|
| salesforcedx-vscode-apex | 4 | 3 | 🟡 1 fixed · 1 accepted gap (C.9) · 1 info (D) |
| salesforcedx-vscode-apex-debugger | 1 | 1 | ⏸ not addressed (naming only) |
| salesforcedx-vscode-apex-log | 8 | 2 | ✅ resolved |
| salesforcedx-vscode-apex-oas | 3 | 0 | ✅ clean |
| salesforcedx-vscode-apex-replay-debugger | 1 | 0 | ✅ clean |
| salesforcedx-vscode-apex-testing | 9 | 1 | ✅ resolved |
| salesforcedx-vscode-core | 3 | 0 | ✅ clean |
| salesforcedx-vscode-lightning | 4 | 0 | ✅ clean |
| salesforcedx-vscode-lwc | 10 | 0 | ✅ clean (2 specs expand coverage) |
| salesforcedx-vscode-metadata | 17 | 3 | 🟡 2 fixed · 1 not in scope (C.10) |
| salesforcedx-vscode-org | 6 | 0 | ✅ clean |
| salesforcedx-vscode-org-browser | 4 | 0 | ✅ clean |
| salesforcedx-vscode-services | 1 | 0 | ✅ clean |
| salesforcedx-vscode-soql | 2 | 1 | ✅ resolved |
| salesforcedx-vscode-visualforce | 2 | 1 | ✅ resolved |
| **Total** | **75** | **12** | **8 fixed · 1 not-workable · 3 out of scope** |

**Headline:** 8 of 15 packages were clean 1:1 ports from the start (differences purely `[ENV]`). Of the 12 `[REVIEW]` items, the requested A/B/C.9 set — **8 items** — are now **fixed and CI-validated** (run `34427132932`, 15/15 green); **1** (C.9 apexSnippets) is confirmed **not-workable** (a Code Builder image packaging gap, evidence below); and **3** were outside the requested scope and remain as-is (C.10 packageInstall, D clean-DB branch, E debugger-twin naming). The dominant pattern in the clean packages is that container specs are *stricter* than their twins (they add console/network monitoring the desktop twins often lack).

## Consolidated REVIEW items — resolution status (2026-09-10)

Ordered roughly by coverage impact. Each links to the package section below for `file:line` detail. **Status legend:** ✅ **FIXED** (applied + CI-validated in run `34427132932`) · ⛔ **NOT-WORKABLE** (accepted gap, evidence given) · ⏸ **NOT ADDRESSED** (outside the requested A/B/C.9 scope). Commit SHAs are on `jh/W-23898526-cb-e2e-parity`.

### A. Behavior dropped, not covered elsewhere in the container suite
1. ✅ **FIXED** (`fc4ac6ccb`) — **soql / soqlRunQuery** — ports only the REST "Run Query" code-lens flow; dropped **4 of 5** execution flows: palette current-file, palette selected-text, the **Tooling API** path, and the **ALL ROWS → /queryAll** routing verification. *Resolution:* all 4 flows restored, ported faithfully from the twin; ALL ROWS/Tooling keyed off the `records returned` signal the twin itself relies on (the Node-host HTTP call is invisible to Playwright in both modes).
2. ✅ **FIXED** (`a4c48cc6e`) — **apex-log / executeAnonymous** — collapsed a 5-scenario twin down to **execute-document only**. *Resolution:* selection, compile-error, and diagnostics-cleared scenarios restored (selection via triple-click + `(N selected)` guard; diagnostics via Problems-panel count → fix → re-run).
3. ✅ **FIXED** (`d10adf1b4`) — **apex-testing / testExplorer** — was **discovery-only**; the tree-item **"Run Test" action** and **Test Results "Pass Rate"** panel were uncovered. *Resolution:* added a new sibling spec `testExplorerRun.container.spec.ts` covering both (discovery spec left intact).
4. ✅ **FIXED** (`c0a6e80e5`) — **metadata / generateManifest** — swapped the **editor-context-menu** entry point for the palette. *Resolution:* context-menu entrypoint restored via `executeEditorContextMenuCommand` (the same pattern 3 sibling metadata specs use in-container — the "doesn't surface" claim was disproven).
5. ✅ **FIXED** (`ba3ac8db1`) — **visualforce / visualforceLsp** — dropped the **hover** test (headless:104-149). *Resolution:* hover test restored as a second `test()` block (completion test intact).
6. ✅ **FIXED** (`c0a6e80e5`) — **metadata / sourceDiffMultiple** — dropped the **"first diff opens automatically"** assertion. *Resolution:* restored with a generic `↔` diff-tab match that tolerates shared-workbench state (ENV-justified count genericization kept).

### B. Assertions weakened (still pass, but verify less)
7. ✅ **FIXED** (`a6a952028`) — **apex / apexLspRestart** — the intermediate **"is restarting"** check was a swallowed `.waitFor(...).catch(() => {})`. *Resolution:* replaced with a real fail-fast no-op guard — the freshly-cleared output channel must re-emit `Apex Prelude Service STARTING` (only a real restart prints it, so a no-op leaves the cleared channel empty and the wait throws). The transient "restarting" UI state is genuinely not reliably observable over the browser round-trip; this durable signal is a stronger guard.
8. ✅ **FIXED** (`a4c48cc6e`) — **apex-log / traceFlagsCrud** — swapped the **named** debug-level preset for `selectFirstQuickInputOption` (L156). *Resolution:* named preset selected by accessible name (tolerates keybinding badge) + asserts `"apexCode": "DEBUG"` took effect.

### C. Whole spec disabled (`test.fixme`) → zero container coverage
9. ⛔ **NOT-WORKABLE** (`a6a952028` — fixme retained, evidence documented) — **apex / apexSnippets**. *Investigation:* the `System Debug` snippet ships **only** from the marketplace extension `salesforce.apex-language-server-extension`. No monorepo package contributes an apex snippet, and the Code Builder extension-swap **wipes that extension by publisher glob** (`packages/playwright-vscode-ext/src/codeBuilder/swap.ts:98-105`) then installs only the monorepo-built VSIXes — so the snippet is absent from the image and the picker never opens. This is a genuine **product/packaging gap**, not a test bug. It becomes testable only if (a) the snippet is shipped from a repo-built extension, or (b) the swap preserves/installs that marketplace extension. **→ candidate for a product follow-up ticket.**
10. ⏸ **NOT ADDRESSED** (outside requested scope) — **metadata / packageInstall** — `test.fixme` (on Playwright retries the 04t is already installed, so the install flow short-circuits). Remains a known gap; not in the A/B/C.9 fix set.

> Also `test.fixme` but already documented/accepted from the stabilization work: **apex-testing / apexTestSuiteDelete** (org read-consistency lag; suite *creation* stays covered by `apexTestSuite.container`).

### D. ENV-justified but never exercised in-container (informational)
11. ⏸ **NOT ADDRESSED** (informational; ENV-justified, accepted) — **apex / apexLspRestart** — the **"Clean Apex DB and Restart"** quick-pick branch and its `StandardApexLibrary` disk removal/recreation assertions are dropped from the container matrix (no `workspaceDir` for disk assertions in the browser-driven spec). Covered only by the desktop twin.

### E. Classification/naming (not a coverage gap)
12. ⏸ **NOT ADDRESSED** (naming only) — **apex-debugger / debuggerStop twin** — the origin is named `debuggerStop.headless.spec.ts` but actually runs on a **real desktop Electron fixture** (`debuggerDesktopTest`) against a minimal scratch org — a naming/classification mismatch, not a coverage gap.

---

# Per-package detail

## salesforcedx-vscode-apex

**Summary:** 4 container specs, 4 with twins (all `*.desktop.spec.ts`; no headless twins exist in this package), 3 REVIEW items.

All four container specs port from a `*.desktop.spec.ts` twin (matched by base name). No headless twins exist. The two LSP-query specs (`apexLsp`, `apexLspHover`) are near-verbatim ports with only ENV-driven setup deltas. `apexLspRestart` reduces its matrix and weakens a fail-fast guard. `apexSnippets` is entirely `test.fixme`.

---

### apexLsp.container.spec.ts
Origin twin: `apexLsp.desktop.spec.ts`. Header explicitly names the twin (lines 8-25). Test body (steps, selectors, keyboard flow, assertions) is a near-verbatim copy.

- [ENV] Readiness signal differs: container calls `waitForApexLspReady(page)` (UI-only "Indexing complete" button) vs twin's `waitForApexLspReady(page, workspaceDir)` which also polls the on-disk `.sfdx/tools/<release>/StandardApexLibrary` dir. Container workspace lives inside the image with no `workspaceDir` fixture; documented at container:22-24.
- [ENV] File open uses `openApexFileFromExplorerTree(page, name, ['force-app','main','default','classes'])` (container:59) vs twin's `openFileByName`/`openFileFromExplorerTree(..., ['classes'])` (desktop:36,44). Full path vs short path; functionally equivalent navigation.
- [ENV] Extra "workbench ready" step (container:51-56): `closeWelcomeTabs` + `ensureSecondarySideBarHidden` + screenshot — shared-workbench cleanup not needed in the per-test Electron host.
- [ENV] Explicit `test.setTimeout(6*60*1000)` (container:43) equals the twin's config-supplied 360_000 (desktop:25 comment). Same budget.
- All functional assertions preserved: go-to-definition tab selection (container:99), autocompletion `aria-label /SayHello\(name\)/` (container:117,153), line-7 `ExampleClass.SayHello('Jack');` (container:131), anon-Apex cross-file completion (container:153). No dropped/weakened assertions.
- (Note, not a gap) The twin's "symbol-resolution risk" comment for anon Apex (desktop:124-127) is omitted in the container copy, but the assertion itself is retained.

### apexLspHover.container.spec.ts
Origin twin: `apexLspHover.desktop.spec.ts`. Header names the twin (lines 8-22). Body is a near-verbatim copy.

- [ENV] Readiness signal `waitForApexLspReady(page)` (UI-only) vs twin's disk-polling `waitForApexLspReady(page, workspaceDir)`. Same rationale as above; documented at container:19-21.
- [ENV] `openApexFileFromExplorerTree` with full path (container:50) vs twin's `openFileByName` (desktop:25).
- [ENV] Extra "workbench ready" step + `ensureSecondarySideBarHidden` (container:42-47); explicit `test.setTimeout(3*60*1000)` (container:38).
- Core assertion identical: hover card contains `String ExampleClass.SayHello(String name)` (container:69 == desktop:43). No dropped/weakened assertions.

### apexLspRestart.container.spec.ts
Origin twin: `apexLspRestart.desktop.spec.ts` (+ shared logic in `utils/apexLspUtils.ts`). Header names the twin (lines 8-24).

- [INTENTIONAL-GAP] Matrix reduced from 4 entries to 2: twin runs `{palette,statusBar} × {restart-only, clean-db}` (desktop:27-32); container runs only `{palette,statusBar} × restart-only` (container:134-137). The two `cleanDb: true` variants are dropped, which also drops the "Clean Apex DB and Restart" quick-pick option flow and the `StandardApexLibrary` disk removal/recreation assertions (desktop:46-60). Not portable without a `workspaceDir` in the browser-driven spec; documented at container:14-20. Coverage of the clean-DB path remains only in the desktop twin — the "Clean Apex DB and Restart" UI branch is never exercised in the container.
- [REVIEW] Intermediate "Apex Language Server is restarting" state check is weakened from a fail-fast hard assertion to best-effort. Twin: `await expect(getApexLanguageStatusButton(...restarting...)).toBeVisible({timeout:10_000})` with a comment that it "fails fast if the restart command was ignored ... the next two waits could otherwise spuriously pass against the prior session's state" (apexLspUtils.ts:137-140). Container: same locator but `.waitFor(...).catch(() => {})` (container:122-124) — failure is swallowed. Container mitigates via `clearOutputChannel` + `waitForOutputChannelText(PRELUDE_STARTING)` (container:126), but the twin's explicit fail-fast guard against a no-op restart is gone. Worth a human check that the cleared-channel + PRELUDE_STARTING re-emit is a sufficient substitute.
- [ENV] Restart-only quick-pick selector changed: twin uses `QUICK_INPUT_LIST_ROW` filtered by anchored `hasText: /^Restart Only$/` (apexLspUtils.ts:120-123); container uses `getByRole('option', {name:'Restart Only', exact:true})` (container:100) because the container row renders a trailing keybinding badge that broke the anchored row filter. Documented at container:95-99.
- [ENV] Timeouts extended: quick-pick widget wait 30_000 (container:94) vs twin 10_000 (apexLspUtils.ts:117); option wait 30_000 (container:101). Rationale: browser round-trip + Node host slower than Electron (container:92-93).
- [ENV] Added `beforeEach` cleanup: `closeWelcomeTabs` + `ensureSecondarySideBarHidden` (container:141-142) for the shared workbench.
- (Preserved) Durable assertions kept: PRELUDE_STARTING re-emit (container:126) and `waitForApexLspReady` "Indexing complete" (container:127).

### apexSnippets.container.spec.ts
Origin twin: `apexSnippets.desktop.spec.ts`. Header names the twin (lines 8-22). Body (steps, selectors, snippet assertion) is a near-verbatim copy.

- [REVIEW] Entire test is `test.fixme` (container:69) — disabled, so the container provides ZERO coverage of Apex snippet insertion. Stated reason (container:64-68): the `System Debug` snippet ships from marketplace `salesforce.apex-language-server-extension` (which the twin injects via a `marketplaceExtensions` fixture); its snippet contribution is "not confirmed present/loaded in the swapped Code Builder image," so "Snippets: Insert Snippet" opens no picker (15s `waitFor` timeout). This may indicate the Code Builder image genuinely does not ship the apex.json snippet contribution — a possible product/packaging gap, not just a flaky test. Twin covers the flow; container does not.
- [INTENTIONAL-GAP] Because of the fixme above, the final body assertion `expect(doc).toMatch(/SayHello should greet the name'\);\s*System\.debug\(\)\s*}/)` (container:127) never runs in the container; coverage lives only in the twin (desktop:108).
- [ENV] Setup differs: container uses `containerTest` fixture + `closeWelcomeTabs` + `ensureSecondarySideBarHidden` + `waitForExtensionsActivated` (container:74-82); twin uses `snippetTest` fixture + `waitForVSCodeWorkbench`/`waitForWorkspaceReady` + marketplace-extension install (desktop:55-63). The container relies on the image's pre-installed full Salesforce extension set instead of a marketplace install (documented container:15-17).
- [ENV] `openFileFromExplorerTree(..., ['force-app','main','default','classes'])` (container:87) vs twin's `openFileByName` (desktop:68).

---

### REVIEW items (needs attention)
- **apexLspRestart.container.spec.ts** — intermediate "Apex Language Server is restarting" assertion downgraded from the twin's fail-fast `expect(...).toBeVisible({timeout:10_000})` to a swallowed `.waitFor(...).catch(() => {})` (container:122-124 vs apexLspUtils.ts:137-140). The twin relies on this as a guard against a no-op restart spuriously passing; verify the cleared-channel + PRELUDE_STARTING re-emit is an equivalent guard.
- **apexSnippets.container.spec.ts** — whole spec is `test.fixme` (container:69); the fixme reason states the apex.json `System Debug` snippet contribution is not confirmed present in the Code Builder image (picker never opens). Possible real gap in what the CB image ships, not just a test issue; container has no snippet-insertion coverage at all.
- **apexLspRestart.container.spec.ts** — the "Clean Apex DB and Restart" quick-pick branch and its `StandardApexLibrary` disk removal/recreation are entirely dropped from the container matrix (only exercised in the desktop twin). Legitimately ENV-driven (no `workspaceDir` for disk assertions), but flag that this UI branch is never exercised in the Code Builder runtime.


---

## salesforcedx-vscode-apex-debugger

**Summary:** 1 container spec, 1 with a named twin, 1 REVIEW item (a low-severity twin-naming divergence, not a coverage gap).

### debuggerStop.container.spec.ts

Twin: `debuggerStop.headless.spec.ts` (named as origin in the container header, ADR 0022). Both cover the same command `SFDX: Stop Apex Debugger Session` (`debugger_stop_text`) and assert the "none found" notification (`debugger_stop_none_found_text`). The assertion set is otherwise identical between the two.

- **[ENV]** Fixture swap: container uses `containerTest` (shared persistent workbench + boot-authed scratch org, web client / code-server) — container.spec.ts:35; twin uses `debuggerDesktopTest` (fresh minimal scratch org in a real Electron host) — headless.spec.ts:34. This is the expected container/desktop runtime difference; both provide a real org with no active `ApexDebuggerSession`.
- **[ENV]** Container adds `clearAllNotifications(page)` in the "wait for workbench" step (container.spec.ts:51) that the twin does not (twin ends the step at `waitForWorkspaceReady`, headless.spec.ts:48). Necessary because the container reuses ONE workbench across all specs, so leftover toasts from prior specs must be cleared before the notification assertion.
- **[ENV]** Container omits `waitForVSCodeWorkbench(page)` (present in twin at headless.spec.ts:45). The container fixture already awaits workbench readiness before handing over `page` (documented in container.spec.ts:48-49), so the call is redundant there.
- **[INTENTIONAL-GAP]** Neither spec exercises branch (b) — an ACTIVE `ApexDebuggerSession` detached via the tooling update. Seeding a live ISV-/Debug-Only-licensed session in CI is infeasible; branch (b) is covered by the ConnectionService-seam Jest test `test/jest/commands/debuggerStop.test.ts`. The exclusion is identical in both twins and documented in both headers (container.spec.ts:16-19, headless.spec.ts:14-18). Not a container-specific regression.
- No dropped/weakened assertions: `test.setTimeout(60_000)`, `verifyCommandExists(..., 30_000)`, `waitForNotification(..., { timeout: 15_000 })`, screenshots, and `validateNoCriticalErrors` all match the twin. No `test.fixme`/`test.skip` in the container spec.

Context (not a gap): `isvDebugBootstrap.desktop.spec.ts` is desktop-only with no container twin. A full ISV bootstrap needs a live ISV-licensed subscriber session (`forceide://` URL), which is not automatable in CI; that spec drives only the command-availability + gatherer-cancel path and is guarded by `isDesktop() ? test : test.skip` (isvDebugBootstrap.desktop.spec.ts:34). No container counterpart is expected.

### REVIEW items (needs attention)

- **[REVIEW]** The named twin `debuggerStop.headless.spec.ts` is a "headless"-named file but actually runs on the `debuggerDesktopTest` fixture — a real Electron desktop host against a minimal scratch org (desktopFixtures.ts:15-19), and its own header says "against a real org." Per the naming convention a `*.headless.spec.ts` should be the runtime-agnostic web twin (plain Page / memfs, often no real org). This is a classification/naming mismatch, not a container coverage gap; worth a human confirming whether the twin should be renamed `*.desktop.spec.ts` (or whether a true headless/web twin is intended). Low severity — the container spec's coverage is unaffected.


---

## salesforcedx-vscode-apex-log

8 container specs, all with a matching-named `*.headless.spec.ts` twin (8 twins). 2 REVIEW items.

All container specs share the same structural deltas vs their headless twins, which are ENV and not repeated per-spec unless notable:
- Import `containerTest` from `../../fixtures/containerFixtures` (shared persistent workbench + boot-authed org) instead of `test` from `../fixtures`.
- Replace headless `setupMinimalOrgAndAuth(page)` / `waitForVSCodeWorkbench(page)` in a "setup" step with a "workbench ready" step (fixture already awaited readiness) + `closeWelcomeTabs`.
- Add `beforeEach` (`closeAllEditors` + `clearAllNotifications`) and, for trace-flag specs, an `afterEach` self-clean, because the workbench + org persist across specs. Headless twins get a fresh org/workbench per file.
- Unique `Date.now()`-suffixed names to avoid collisions on the shared workbench (class specs already do this in headless too).
- Extra/renamed screenshots (`*.container.NN-*.png`).

---

### apexGenerateClass.container.spec.ts
Twin: `apexGenerateClass.headless.spec.ts`
- [ENV] Fixture/setup swap + `beforeEach` reset as above (`container` L34-41 vs `headless` L26,34-39).
- Assertions are identical: editor opens by `.cls` URI, tab visible, explorer treeitem, and `public with sharing class <name>` body (`container` L88-100 == `headless` L72-84). No functional gap.

### apexTestClassCreate.container.spec.ts
Twin: `apexTestClassCreate.headless.spec.ts`
- [ENV] Fixture/setup swap + `beforeEach` reset as above.
- Assertions identical: `@isTest` + `private class <name>` body, tab, explorer item (`container` L90-103 == `headless` L74-87). No functional gap.

### autoCollection.container.spec.ts
Twin: `autoCollection.headless.spec.ts`
- [ENV] Fixture swap; headless configures `describe` serial (`headless` L29), container relies on `workers:1` (documented in header).
- [ENV] Container adds `afterEach` deleting the trace flag + restoring poll interval to `30` + closing settings (`container` L51-57); headless has no afterEach (fresh org per file).
- Step-for-step parity otherwise: set poll interval 10, create trace flag (assert "Tracing until"), set poll 0, delete flag. Neither spec asserts a log was actually auto-collected, so no gap introduced. No functional gap.

### createApexTrigger.container.spec.ts
Twin: `createApexTrigger.headless.spec.ts`
- [INTENTIONAL-GAP] Trigger events: headless drives a keystroke multi-select (Arrow/Space sequence) and asserts the exact tuple `trigger <name> on Case (after insert, after update)` (`headless` L74-88, L118). Container accepts the DEFAULT pre-checked selection with a single Enter and asserts only the declaration STRUCTURE — `trigger <name> on Case (`, `)`, `{` (`container` L108-118, L155-161). Confirmed: the twin does assert a specific event tuple; the container deliberately does not, because keystroke counting drops keys under container latency. Documented in-spec (L108-113, L155-157).
- [ENV] Container matches each prompt by its own prompt/placeholder text before typing (`getByText` for the name InputBox, `getByPlaceholder` for the sObject/events/output-dir QuickPicks) with large timeouts (name/sObject up to 90s) to absorb org-describe + browser round-trip latency (`container` L78-125). Headless keys off widget visibility with short 1-10s timeouts.
- [ENV] Editor-open + tab/explorer/meta-xml assertions use generous timeouts (60s/10s) vs the headless 5s/1s/2s/100ms (`container` L130-161 vs `headless` L97-121). Same targets asserted (`.trigger` URI, tab, explorer treeitem, `.trigger-meta.xml` treeitem).
- Note: container asserts `{` (body open) where headless asserts `}` (`container` L161 vs `headless` L121) — both merely prove a body exists; equivalent.

### executeAnonymous.container.spec.ts
Twin: `executeAnonymous.headless.spec.ts`
- [REVIEW] Major scope reduction. Headless "Execute Anonymous Apex: document, selection, script creation, compile error" runs 5 scenarios: execute document, execute SELECTION (`headless` L93-137), execute with COMPILE ERROR + assert error notification (`headless` L139-152), and FIX + re-execute + assert diagnostics cleared via `expectProblemsCountAtLeast` (`headless` L154-172). The container spec ("runs a debug script against the boot org") keeps ONLY execute-document (`container` L83-99). Execute-selection, compile-error notification, and diagnostics-cleared behavior are not verified anywhere in the container suite. The in-spec header justifies proving the org round-trip but does not explain dropping the selection/compile-error/diagnostics paths (contrast createApexTrigger, whose drop is documented). Confirm this narrowing is intended.
- [ENV] Container asserts a unique `DEBUG_MARKER` ('cbE2eAnon…') appears in the Apex Log channel alongside `USER_DEBUG` to prove the real org executed the block (`container` L92-98) — an added, container-appropriate assertion. Headless checks `Execute anonymous succeeded` + `USER_DEBUG` (`headless` L82-83).
- [ENV] Container replaces the template body with `Control+A` + type (`container` L76-79); headless uses `selectAll` + `Delete` + type. Equivalent.
- [ENV] Container has no `beforeEach`/`afterEach` (unlike sibling container specs); it does not reset editors. Low risk since it uses unique names, but noted.

### logRetrieval.container.spec.ts
Twin: `logRetrieval.headless.spec.ts`
- [ENV] Fixture swap + `beforeEach` reset + `afterEach` trace-flag delete (`container` L46-56); headless has none.
- Step-for-step parity: turn on trace flag, generate log via execute-anonymous (`System.debug('logtest')`), Open Log, `logGet` QuickPick, verify `.log` tab opens containing `logtest|USER_DEBUG|DEBUG`, open logs folder / explorer, turn off flag. Same selectors and timeouts. No functional gap.

### traceFlagExpiry.container.spec.ts
Twin: `traceFlagExpiry.headless.spec.ts`
- [ENV] Fixture swap; headless `describe.configure` serial timeout 240s (`headless` L32), container `test.setTimeout(4*60*1000)` = 240s (`container` L66). Container adds `beforeEach`/`afterEach` (delete flag + restore duration to `30`) (`container` L44-57).
- Identical logic and the same 150s expiry poll (`container` L107 == `headless` L75). No functional gap.

### traceFlagsCrud.container.spec.ts
Twin: `traceFlagsCrud.headless.spec.ts`
- [REVIEW] Debug-level preset selection weakened. Headless selects the NAMED preset `selectQuickInputOption(page, 'Yes (Apex=DEBUG, VF=INFO, DB=INFO)', …)` (`headless` L126). Container uses `selectFirstQuickInputOption(page, { optionVisibleTimeout: 10_000 })` (`container` L156), picking whatever is first rather than asserting a specific debug-level config. No in-spec comment explains the change; if option ordering differs, the container could select a different preset than intended. Confirm this is deliberate (e.g., container QuickPick option text/order differs).
- [ENV] Fixture swap + `beforeEach`/`afterEach` self-clean (`container` L69-80).
- Otherwise identical: `findInEditor` / `openTraceFlagsAndExpectContent` helpers, `"traceFlags": {"` content check, `"DEVELOPER_LOG"` + `Remove` code-lens after create, debug-level label appears in virtual doc, cleanup. Same timeouts (240s). 

---

### REVIEW items (needs attention)
- **executeAnonymous.container.spec.ts** — container keeps only execute-document; drops execute-selection, compile-error notification, and diagnostics-cleared (`expectProblemsCountAtLeast`) scenarios present in the headless twin (`headless` L93-172). Drop is undocumented — confirm intended narrowing to the org round-trip.
- **traceFlagsCrud.container.spec.ts** (`container` L156) — debug-level preset selection weakened from the named `'Yes (Apex=DEBUG, VF=INFO, DB=INFO)'` option (`headless` L126) to `selectFirstQuickInputOption`. Confirm the first option is the intended preset in the container UI.


---

## salesforcedx-vscode-apex-oas

**Summary:** 3 container specs, 3 matched headless twins (1:1 by base name, all named in header comments), 0 REVIEW items. All three container specs exercise *pre-LLM* eligibility guards (ineligible class, mixed frameworks, @RestResource-without-@Http). None triggers A4V/LLM generation, so the A4V wait and rate-limit skip machinery used by the generation-path headless specs are intentionally absent. The two apex-oas headless specs that actually generate OAS (`composed*`, `decomposed*`, `contextMenu*`) have **no container twin** — see note at end.

Common pattern (applies to all 3, not repeated per spec):
- `[INTENTIONAL-GAP]` Headless calls `waitForA4VAndOasCommands` (utils/oasHelpers.ts:47 → `waitForExtensionsActivated` + command check); container calls only `verifyCommandExists(create_openapi_doc_class, 120_000)` and does **not** wait for all extensions/A4V. Deliberate and documented in each container header ("we do NOT wait for the A4V/LLM extension and never trigger actual generation") — these guards fail before any LLM call.
- `[INTENTIONAL-GAP]` Notification-visible timeout weakened 180_000ms (headless) → 60_000ms (container). Acceptable because a pre-LLM guard returns synchronously from LSP symbols; not an LLM-latency window. Low risk.
- `[INTENTIONAL-GAP]` Container **adds** coverage absent from headless: `setupConsoleMonitoring`/`setupNetworkMonitoring` + `validateNoCriticalErrors`, plus `saveScreenshot` checkpoints. Strengthened, not weakened.
- `[INTENTIONAL-GAP]` Container uses NLS key `packageNls.create_openapi_doc_class`; headless hardcodes the English string `'SFDX: Create OpenAPI Document from This Class'`. Same command; container is locale-robust.
- Shared-workbench hygiene: mixed/noHttp container specs add `test.beforeEach` (closeAllEditors + clearAllNotifications) for the one persistent workbench; headless twins run isolated so don't need it. Not a coverage gap.

### ineligibleClass.container.spec.ts
Twin: `ineligibleClass.headless.spec.ts`
- `[INTENTIONAL-GAP]` Headless authors `IneligibleApexClass` via `createApexClass` (testData/sampleClassData.ts:39) then `pushSource` to a fresh minimal org (ineligibleClass.headless.spec.ts:30-33). Container instead opens the **seeded fixture** `PagedResult.cls` from the mounted project (ineligibleClass.container.spec.ts:49) and does **no create, no push, no org round-trip** — header (lines 15-17) states eligibility is decided from workspace Apex-LSP symbols so no org is needed. Different class name (`PagedResult` vs `IneligibleApexClass`) but semantically identical (plain public class, no @RestResource/@AuraEnabled) and same error-message regex `.../is not valid for OpenAPI document generation/i`.
- `[INTENTIONAL-GAP]` Container adds `verifyCommandExists(create_openapi_doc_class, 120_000)` as an explicit "command wired / apex-oas active" step (line 55) — headless proves this only implicitly via `waitForA4VAndOasCommands`.
- No dropped assertions; the origin's failure-notification assertion is preserved.

### mixedFrameworksClass.container.spec.ts
Twin: `mixedFrameworksClass.headless.spec.ts`
- `[INTENTIONAL-GAP]` Both create + push a mixed-frameworks class. Container generates a **unique** class name `CbMixedFrameworks${Date.now()}` with inlined content (mixedFrameworksClass.container.spec.ts:42-58) to avoid collisions on the shared persistent org/workbench; headless uses the fixed `MixedFrameworksClass` from `mixedFrameworksClassText` (sampleClassData.ts:57) on its own fresh org. Assertion regex built dynamically from the same class name — equivalent coverage.
- `[INTENTIONAL-GAP]` Container `test.setTimeout(6*60*1000)` vs headless `360_000` (also 6 min) — same budget; per-notification wait weakened as noted in common pattern.
- No dropped assertions.

### restResourceNoHttpMethod.container.spec.ts
Twin: `restResourceNoHttpMethod.headless.spec.ts`
- `[INTENTIONAL-GAP]` Same create+push pattern; container uses unique `CbRestNoHttp${Date.now()}` (restResourceNoHttpMethod.container.spec.ts:43-51) vs headless fixed `RestResourceNoHttpMethod` (sampleClassData.ts:47). Both assert the early Step-2.6 `apex_class_not_valid` guard (`.../is not valid for OpenAPI document generation/i`) fails fast rather than slipping into generation — the origin's distinguishing intent (headless header lines 21-23) is preserved.
- No dropped assertions.

### REVIEW items (needs attention)
none

Additional observation (not a per-spec gap, informational): container coverage exists **only** for the three pre-LLM rejection guards. The actual OAS-generation headless specs — `composedCaseManager`, `composedManualMerge`, `composedOverwrite`, `decomposedSimpleAccount`, `contextMenuEditor`, `contextMenuExplorer` — have **no container twin**. This is consistent with the stated ENV constraint: A4V/LLM generation may be absent or rate-limited in the Code Builder image (the headless generation specs guard on this via `assertGenerationOrSkipOnRateLimit`, oasHelpers.ts:143). Porting them to the container would require the LLM service, so their omission is an `[ENV]`-driven deliberate scope decision, not an accidental gap.


---

## salesforcedx-vscode-apex-replay-debugger

1 container spec, 1 origin twin, 0 REVIEW items. The lone container spec (`errorPaths.container.spec.ts`) is a faithful 1:1 port of `errorPaths.desktop.spec.ts`; all deltas are ENV-driven (shared workbench, boot-authed org, no host filesystem) and the container version actually *adds* console/network error monitoring rather than dropping assertions.

### errorPaths.container.spec.ts

Twin: `errorPaths.desktop.spec.ts` (named in header comment line 9: "Container twin of errorPaths.desktop (ADR 0022)"). No headless twin exists for this package.

All three tests (unsupported-file error, no-checkpoints warning, checkpoint-limit error) match the desktop twin's flow, selectors, command palette invocations, and core assertions (identical error/warning regexes and `NOTIFICATION_LIST_ITEM` locators).

- [ENV] Per-test org setup dropped — desktop calls `setupMinimalOrgAndAuth` in every test (desktop:39, 71, 103); container uses the shared boot/default org and instead resets state in `beforeEach` via `closeWelcomeTabs`/`closeAllEditors`/`clearAllNotifications` (container:48-53). Expected shared-fixture model, same org authority verified.
- [ENV] Test 1 file source changed — desktop writes `unsupported.txt` to `workspaceDir` on the host fs and opens it (desktop:43-47); container has no host fs, so it opens the seeded `README.md` from the mounted project via `openFileFromExplorerTree` (container:68-69). Both are non-Apex files exercising the same "Anonymous Apex files only" error path; assertion identical (container:79-81 vs desktop:57-59).
- [ENV] Test 1 & 2 timeout reduced from `300_000` to `120_000` (container:60, 91 vs desktop:36, 68) — reflects removal of per-test org bootstrap. Test 3 timeout unchanged at `600_000` (container:124 = desktop:96).
- [ENV] Test 3 class names carry a per-run `uid` suffix (`AccountService_${uid}_${i}`, container:132-133) vs static `AccountService1..6` (desktop:100) — prevents collisions in the persistent shared workbench across runs. Strengthens isolation; deploy/toggle/limit-check flow otherwise identical.
- [INTENTIONAL-GAP] Container adds `setupConsoleMonitoring`/`setupNetworkMonitoring` + `validateNoCriticalErrors(test, ...)` to all three tests (container:62-63, 85, 93-94, 106, 126-127, 187); desktop twin has no such monitoring. This is an *added* check, not a gap — container is stricter.
- No `test.fixme` / `test.skip` in either file. No dropped or weakened assertions.

### REVIEW items (needs attention)

none


---

## salesforcedx-vscode-apex-testing

9 container specs, 9 origin twins (all matched 1:1 by base name + header), 1 REVIEW.

Most container ports are faithful; deltas are almost entirely ENV-driven (shared persistent workbench + one boot-authed tracking scratch org + mounted fixture project, so specs reuse seeded classes and add `beforeEach` cleanup instead of `setupNonTrackingOrgAndAuth` + fresh classes; container always deploys explicitly since desktop has no push-or-deploy-on-save). One `test.fixme` (INTENTIONAL-GAP, org read-consistency lag). One genuine gap: the Test Explorer tree-item "Run Test" action path + Test Results panel verification are dropped from `testExplorer.container` and not covered by any other container spec (REVIEW).

### apexTestSuite.container.spec.ts
Twin: `apexTestSuite.headless.spec.ts`
- [ENV] Setup swapped: headless `setupNonTrackingOrgAndAuth` + two fresh `SuiteTestClass1/2` (headless:78-109) → container reuses seeded `PagedResultTest`/`ExampleClassTest`, deploys 4 fixture classes to boot org (container:107-115).
- [ENV] Added `beforeEach` cleanup for the shared persistent workbench (container:83-89); no headless equivalent.
- [ENV] Container restores maximized panel after run-verify step (container:194) — cosmetic, shared-workbench hygiene.
- All assertions preserved: create/verify, edit-add/verify, run + `=== Test Results` + both class names + `Ended SFDX: Run Apex Tests`, tree lazy-load poll (`hasClass1:true, hasClass2:false`), remove/verify, re-run absence check. No drops, no timeout changes.

### apexTestSuiteDelete.container.spec.ts
Twin: `apexTestSuiteDelete.headless.spec.ts`
- [INTENTIONAL-GAP] Whole spec `test.fixme` (container:61); reason at container:56-60 — org read-consistency lag: a just-created `ApexTestSuite` is not returned by the Tooling API `retrieveAllSuites` query within the poll window (3x 120s failures), so the pre-delete baseline can't pass reliably. Suite creation is covered by `apexTestSuite.container`; only the delete-without-refresh nuance is lost.
- [ENV] Delete-confirmation selector/flow changed: headless waits on a native modal (`.monaco-dialog-box`) + `clickModalDialogButton('Delete Source')` (headless:114-119) → container matches a notification toast (`NOTIFICATION_LIST_ITEM` "Deleting source files…") + `getByRole('button',{name:'Delete Source'})` (container:151-156). code-server/web surfaces the confirm as a toast, not a modal.
- [ENV] "verify suite appears in sidebar" hardened into a 120s re-discovery poll (container:112-127) vs headless single `toBeVisible` (headless:79-92) — the same read-consistency lag that motivates the fixme.
- Final delete assertion (`toBeHidden` 60s) identical (container:178-179 / headless:141-142).

### clearApexTestResults.container.spec.ts
Twin: `clearApexTestResults.headless.spec.ts`
- [ENV] Setup swapped: fresh `ClearTestClass` + `setupNonTrackingOrgAndAuth` (headless:41-55) → reuse seeded `PagedResultTest`, deploy to boot org + `beforeEach` cleanup (container:48-75).
- Assertions identical: discover, run-all, clear-results command, refresh, stale autocomplete option `not.toBeVisible` (5s). No drops, no timeout changes.

### codeCoverageColorizer.container.spec.ts
Twin: `codeCoverageColorizer.headless.spec.ts`
- [ENV] Headless runs desktop+web with `isDesktop()`-guarded deploy (headless:86-91); container always deploys via `deployActiveEditor` (container:76-81). Both author unique `ColorizerBranch*` classes and pin `PINNED_THEME`.
- [ENV] Added `beforeEach` cleanup (container:58-64).
- All coverage assertions preserved verbatim: no-missing-coverage gate, `>=1` green (`COVERED_BG_RGBA`) + `>=1` red (`UNCOVERED_BG_RGBA`) overlays, both `=0` after toggle-off. Same 15s poll timeouts. No drops.

### runApexTestsCodeLens.container.spec.ts
Twin: `runApexTestsCodeLens.headless.spec.ts` (desktop-only; `test.skip` in web)
- [ENV] Setup swapped: fresh `CodeLensTestClass` (headless:42-58) → reuse seeded `ExampleClass`/`ExampleClassTest`, deploy to boot org (container:69-75).
- [ENV] Weakened per-method assertion (4 occurrences): headless asserts the dotted `${testClassName}.validateSayHello  Pass` line (headless:80,107,139,168) → container substitutes `Org Wide Coverage` (container:101,132,168,201) with a comment (container:97-100) that the container's Apex Testing channel virtualizes/variably-spaces the per-method line out of the scrolled view. `Outcome Passed` / `Tests Ran 1` / (`Pass Rate 100%`) still assert the run passed, so only per-method attribution is lost — not a run-pass regression.
- All 4 flows preserved: Run All lens, Run Test lens, Re-Run Last Class, Re-Run Last Method. No timeout changes.

### runApexTestsCommandPalette.container.spec.ts
Twin: `runApexTestsCommandPalette.headless.spec.ts`
- [ENV] Setup swapped: fresh `CommandPaletteTestClass1/2` (headless:40-70) → reuse seeded `PagedResultTest`/`ExampleClassTest` (container:43-44,68-76) + `beforeEach` cleanup.
- Assertions identical: run-single (`=== Test Summary`, class name, `Ended`), re-run-last-class, run-all (both class names). No drops, no weakening, no timeout changes. (This twin's per-method assertions were already just the bare class name, so no substitution needed.)

### runApexTestsFailAndFix.container.spec.ts
Twin: `runApexTestsFailAndFix.headless.spec.ts` (desktop-only; `test.skip` in web)
- [ENV] Class names swapped: fixed `AccountService`/`AccountServiceTest` (headless:38-71) → unique `FailFixService${Date.now()}` (container:48-85) so the shared org never collides.
- [ENV] Redeploy simplified: headless branches on `isDesktop()` (deploy vs wait for `Deployed Source`) (headless:155-167) → container always `deployCurrentSourceToOrg` (container:173-177).
- [ENV] Weakened per-method assertion: headless asserts `AccountServiceTest.should_create_account  Pass` (headless:203) → container substitutes `Org Wide Coverage` (container:217) with the same virtualization comment; `Outcome Passed`/`Tests Ran 1`/`Pass Rate 100%` still assert the pass.
- Fail→fix→pass flow, `System.AssertException` + `incorrect ticker symbol: Expected: CRM, Actual: SFDC` failure assertions, success notification + `Open Report` → markdown-preview tab all preserved. No timeout changes.

### staleTestResultsRestoration.container.spec.ts
Twin: `staleTestResultsRestoration.headless.spec.ts`
- [ENV] Setup swapped: `setupNonTrackingOrgAndAuth` (headless:46-64) → author unique `StaleTestClass`, deploy to boot org + `beforeEach` cleanup (container:50-91).
- [ENV] Redeploy simplified: headless `isDesktop()`-guarded deploy (headless:84-86) → container always deploys explicitly (container:108-109).
- Assertions identical: `@stale` filter shows redeployed class (60s `toPass`), run-all clears tag → row hidden (30s `toPass`). No drops.

### testExplorer.container.spec.ts
Twin: `testExplorer.headless.spec.ts`
- [INTENTIONAL-GAP] Scope narrowed to discovery-only: container opens Test Explorer, discovers, asserts seeded `PagedResultTest` visible (container:29-51). Header (container:8-16) states run flows were decomposed into the `runApexTests*.container` specs and discovery isolated as a fast deterministic signal.
- [REVIEW] The headless twin's Test Explorer **tree-item action** run path is dropped and NOT re-covered by any container spec: `clickTreeItemAction(classRow,'Run Test')` (headless:120) and `clickTreeItemAction(methodRow,'Run Test')` (headless:152), plus the Test Results panel / `Pass Rate` verification (headless:83-96,126) and the Explorer-path completion sentinel (headless:129-131). The `runApexTests*.container` specs drive runs via command-palette and code-lens entrypoints only (verified: no `clickTreeItemAction`, `TEST_RESULTS_TAB`, or `CMD_RUN_ALL_TESTS` anywhere under `specs/container/`); `runAllTestsAndWaitForCompletion` uses the `Test: Run All Tests` command, not a tree-item action. Re-run-last-method is covered (codeLens container), but the sidebar tree-item run action and Test Results panel assertions have no container home.
- [ENV] Discovery target is the seeded `PagedResultTest` rather than a fresh `private class` (headless:55 exercises private-class visibility gated on API version, W-23428145); the container relies on the mounted fixture's seeded class, so the private-class-visibility nuance is not re-verified here.

### REVIEW items (needs attention)
- `testExplorer.container.spec.ts`: Test Explorer tree-item "Run Test" action run path (class row + method row), Test Results panel `Pass Rate` verification, and the Explorer-path completion sentinel present in `testExplorer.headless.spec.ts` are not exercised by any container spec — container run coverage goes exclusively through command-palette/code-lens entrypoints. Confirm this UI path is intentionally out of scope for the container suite, or add tree-item-action coverage. (Secondary: the headless private-class-visibility discovery nuance, W-23428145, is not re-verified in the container discovery spec, which uses the seeded public-ish `PagedResultTest`.)


---

## salesforcedx-vscode-core

Summary: 3 container specs, 2 have origin twins (1 container-only), 0 REVIEW items. All gaps are explained ENV differences (container CLI-default org vs workspace `.sf/config.json`, image-dependent redhat-XML state, cold-container startup budgets, fixture-managed workbench readiness).

Container specs live in `packages/salesforcedx-vscode-core/test/playwright/specs/container/`. Twins live one level up in `.../specs/`.

### configList.container.spec.ts
Twin: `configList.headless.spec.ts` (uses `desktopTest` fixture; matched by base name + header comment "Seed spec proving the Code Builder container pipeline").

- [ENV] Drops the `target-org` output assertion the twin makes. Twin asserts both `'target-org'` and `config_list_column_location` (`configList.headless.spec.ts:52-53`); container asserts only `config_list_column_location` (`configList.container.spec.ts:58`). Justified in header comment: container org comes from CLI default (`SF_ACCESS_TOKEN` auth at boot), not a workspace `.sf/config.json`, so no specific target-org value is guaranteed — asserts the config-table header instead.
- [ENV] Timeout widened. `selectOutputChannel` 10s→30s (`:50` vs `configList.container.spec.ts:54`); `waitForOutputChannelText` 5s→30s (`:53` vs `:58`). Comment: first CLI shell-out in a cold container pays sf startup + telemetry init.
- [ENV] Adds `clearAllNotifications` in the wait-for-workbench step (`configList.container.spec.ts:43`), absent in twin. Comment: first container boot stacks telemetry/what's-new toasts over the output toolbar.
- [ENV] Drops `waitForVSCodeWorkbench` + `waitForWorkspaceReady` (twin `:38-39`); containerFixtures already awaits workbench readiness before handing over `page` (`configList.container.spec.ts:38-40`).
- [ENV] Twin sets `test.setTimeout(60_000)` (`configList.headless.spec.ts:30`); container relies on default suite timeout. No assertion impact; the per-step budgets above cover the slow path.
- No dropped/weakened core assertion beyond the org value; no fixme/skip.

### coreOutputChannel.container.spec.ts
Twin: `coreOutputChannel.headless.spec.ts` (uses `desktopTest` fixture; header comment "Container twin of coreOutputChannel.headless").

- [ENV] Assertion weakened from exact message to shared substring: twin asserts `messages.metadata_xml_no_redhat_extension_found` (`coreOutputChannel.headless.spec.ts:47`); container asserts substring `'metadata XML'` (`coreOutputChannel.container.spec.ts:57`). Justified: container runs the FULL installed extension set, so redhat.vscode-xml presence and which `initializeMetadataSupport` branch fires (no-redhat / setup-success / setup-failed / version-regression) is image-dependent; all four branches log a `metadata XML …` line, so the substring still proves `metadataXmlSupport` wrote to the channel. (This is the ENV case called out in the task.)
- [ENV] `selectOutputChannel` timeout 10s→30s (`:44` vs `coreOutputChannel.container.spec.ts:53`) — cold-container startup budget.
- [ENV] Adds `clearAllNotifications` (`coreOutputChannel.container.spec.ts:47`), absent in twin — boot-toast coverage.
- [ENV] Drops `waitForVSCodeWorkbench` + `waitForWorkspaceReady` (twin `:36-38`); fixture handles readiness.
- [ENV] Twin sets `test.setTimeout(60_000)` (`coreOutputChannel.headless.spec.ts:29`); container relies on default.
- Dedupe guard preserved on both: exactly one `'Salesforce CLI'` channel (`coreOutputChannel.container.spec.ts:61-64`, twin `:51-54`). No fixme/skip.

### seededWorkspace.container.spec.ts
Twin: none — container-only spec (confirmed: no `*seeded*` file elsewhere; `openFileFromExplorerTree` used only here in core specs).

- [INTENTIONAL-GAP] No origin twin by design. Verifies container-specific plumbing: the bind-mounted `test/playwright/fixtures/container-workspace` is actually mounted and that `coder.json` points at it, by opening `PagedResult.cls` from the Explorer and asserting `public with sharing class PagedResult` is visible (`seededWorkspace.container.spec.ts:41-44`). Guards against silently running against an empty generated workspace. No headless/desktop equivalent needed.
- No fixme/skip; 15s visibility timeout is local to this assertion.

### REVIEW items (needs attention)
None. All gaps are documented ENV differences or the intentional container-only spec; no dropped assertion is unexplained, and there are no `test.fixme`/`test.skip` in any of the three container specs.


---

## salesforcedx-vscode-lightning

**Summary:** 4 container specs, 4 twins (all `*.desktop.spec.ts`, matched by base name + header comment), 0 REVIEW items. Every container spec preserves all origin assertions; all diffs are container-infrastructure (ENV). No `test.fixme`/`test.skip` anywhere.

### auraLspAutocompletion.container.spec.ts
Twin: `auraLspAutocompletion.desktop.spec.ts` (named in header comment L9-10).
- [ENV] `test.setTimeout(3 * 60 * 1000)` added — container:37; twin has no per-test timeout. Slower container boot/indexing.
- [ENV] Setup uses fixture-provided readiness (`containerFixtures`, no `waitForVSCodeWorkbench`/`waitForWorkspaceReady`) + `clearAllNotifications` — container:45-51 vs twin's explicit `waitForVSCodeWorkbench`/`waitForWorkspaceReady` — twin:38-43. Fixture already awaits workbench readiness.
- [ENV] File opened via `openFileFromExplorerTree(page, 'aura1.cmp', ['force-app','main','default','aura','aura1'])` — container:54 — vs twin `openFileByName(page, 'aura1.cmp')` — twin:46. Shared persistent workbench, no seed step.
- Assertions identical: suggest-widget row visible + `aria-label` /aura:application/ + L2 contains `aura:application` (container:64-77 == twin:57-70). No dropped/weakened assertions.

### auraLspGoToDefinition.container.spec.ts
Twin: `auraLspGoToDefinition.desktop.spec.ts` (named in header comment L10-11).
- [ENV] `test.setTimeout(3 * 60 * 1000)` added — container:44.
- [ENV] Fixture readiness + `clearAllNotifications` — container:48-53 — vs twin explicit waits — twin:43-48.
- [ENV] `openFileFromExplorerTree(...)` — container:57 — vs `openFileByName(...)` — twin:51.
- Assertions identical: cursor placed at Ln 8 Col 15 (container:71), Go to Definition with `preserveSelection:true` (container:82), PRIMARY status bar `Ln 3, Col 27` (container:88), SECONDARY aura1.cmp tab still `aria-selected=true` (container:93). Full parity with twin:65-89.

### auraRename.container.spec.ts
Twin: `auraRename.desktop.spec.ts` (named in header comment L9-10).
- [ENV] `test.setTimeout(3 * 60 * 1000)` added — container:41.
- [ENV] Fixture readiness + `clearAllNotifications` — container:47-53 — vs twin explicit waits — twin:37-42.
- [ENV] describe title `Aura Rename (Code Builder)` — container:39 — vs `Aura Rename (Desktop Only)` — twin:30. Cosmetic.
- Self-seeds via "SFDX: Create Aura Component" with `Date.now()` names in both (container:44-45 == twin:34-35); flow, both renames (explorer context menu + editor context menu), and both `toPass`/`toHaveCount(0)` verifications identical (container:55-116 == twin:44-105). No dropped/weakened assertions.

### auraTemplates.container.spec.ts
Twin: `auraTemplates.desktop.spec.ts` (named in header comment L9-10).
- [ENV] `test.setTimeout(3 * 60 * 1000)` in `beforeEach` — container:41.
- [ENV] Fixture readiness + `clearAllNotifications` in `beforeEach` — container:44-47 — vs twin explicit waits — twin:31-34.
- [ENV] describe title `Aura Templates (Code Builder)` — container:36 — vs `Aura Templates (Desktop Only)` — twin:27. Cosmetic.
- All 4 sub-tests (App/Component/Event/Interface) and their `expectedFiles` lists are byte-for-byte identical (container:73-109 == twin:65-101). No dropped/weakened assertions.
- [note, not a gap] Container captures monitor handles at describe scope (`beforeEach` container:42-43) and validates them in `afterEach` (container:112). The twin re-creates fresh monitors inside `afterEach` (twin:104-105) so its `validateNoCriticalErrors` inspects empty arrays — effectively a no-op. Container is STRONGER, not weaker; flagged only for awareness of the twin's latent bug.

### REVIEW items (needs attention)
none


---

## salesforcedx-vscode-lwc

**Summary:** 10 container specs, all with a headless/desktop twin (10 twin files); 0 REVIEW items. All ports are faithful. Differences are ENV robustness (unique per-run names for the shared persistent workbench, added `setupNetworkMonitoring`/screenshots, disk-reopen polling for the index, top-of-tree scroll for typings) plus two coverage EXPANSIONS: the container runs the JS Go-to-Definition and JS hover tests unconditionally, whereas the web twin `test.skip`s them.

Test-block counts: container = 12 `test()` blocks across 10 files (hover x2, snippets x2, rest x1); twins = 12 blocks across 10 files.

Origin matched by base name; each container header comment names its `*.headless.spec.ts` twin.

### lwcCustomComponentsIndex.container.spec.ts
Twin: `specs/lwcCustomComponentsIndex.headless.spec.ts`
- [ENV] Unique bundle name `idxCmp${Date.now()}` vs fixed `idxCmp` in twin (container:43 vs twin:29) — shared persistent workbench collision avoidance.
- [ENV] Index verified via `assertOpenEditorContainsText(page, posix, openSfdxCustomComponentsJson)` Find-widget search with a reopen hook that reloads the file from disk each poll (container:66-67), vs twin's `.view-lines` `textContent()` `toPass` over posix|winish (twin:42-45). This is the disk-reopen polling robustness noted in the task; large virtualized index file + async LSP rewrite. No coverage loss.
- [ENV] Container asserts only the posix path (Linux container) vs twin's posix||winish (container:66 vs twin:40-44). Correct for the container OS.
- [ENV] Adds network monitoring + screenshots + explicit "workbench ready" step (fixture already awaited readiness).

### lwcGenerateComponent.container.spec.ts
Twin: `specs/lwcGenerateComponent.headless.spec.ts`
- [ENV] Component name `cbLwc${Date.now()}` vs `generateLwcTest${Date.now()}` (container:37 vs twin:30) — cosmetic.
- [ENV] Twin's `waitForWorkspaceReady` replaced by fixture-provided readiness + "workbench ready" step (container:39-44 vs twin:32-38).
- [ENV] Assertion timeouts relaxed (editorTab 5000ms vs 1000ms; treeitems 5000ms vs 2000ms) (container:79,85-91 vs twin:80,98-104) — container/CI latency.
- [INTENTIONAL-GAP] Twin also asserts an explorer folder treeitem whose name equals the component (twin:83-88) and an editor `[data-uri*="${name}.js"]` visible (twin:90-91); container omits both but still verifies the `.js` tab, `import { LightningElement }` content, and the `.html`/`.js-meta.xml`/`__tests__` sibling treeitems (container:78-91). Dropped checks are redundant with retained coverage — no meaningful loss.

### lwcLspAutocompletion.container.spec.ts
Twin: `specs/lwcLspAutocompletion.headless.spec.ts`
- [ENV] Unique `autoComp${Date.now()}` vs fixed `autoComp` (container:41 vs twin:37).
- [ENV] `beforeEach` (workbench/close/disableDeployOnSave/sidebar) inlined into a "workbench ready" step (container:44-50 vs twin:23-28).
- [ENV] Adds network monitoring + screenshots. Assertion flow (type `<lightnin`, expect `lightning-accordion` suggestion, insert, save, editor contains text) is identical. No coverage loss.

### lwcLspGoToDefinitionHtml.container.spec.ts
Twin: `specs/lwcLspGoToDefinitionHtml.headless.spec.ts`
- [ENV] Unique `gtdHtmlComp${Date.now()}` vs fixed `gtdHtmlComp` (container:42 vs twin) — prefix still triggers the greeting/{greeting} seed.
- [ENV] Adds network monitoring + screenshots + "workbench ready" step. Cursor placement (line 2 col 10), `goToDefinition`, and JS-editor-or-tab assertion (15s) are identical. No coverage loss.

### lwcLspGoToDefinitionJs.container.spec.ts
Twin: `specs/lwcLspGoToDefinitionJs.headless.spec.ts`
- [INTENTIONAL-GAP / EXPANSION] Twin `test.skip(!isDesktop(), ...)` — skipped on VS Code for Web because TS/JS navigation to typings on a virtual FS is unreliable (twin:38). Container runs UNCONDITIONALLY because the Code Builder image runs the desktop LWC LSP (container header:8-15). Container covers MORE than the web twin here.
- [ENV] Unique `gtdJsComp${Date.now()}` vs fixed `gtdJsComp`. Adds network monitoring + screenshots. Hover-to-warm-TS then cmd+click flow and the byUri/byDeclaration/peek assertion (30s) are identical. No coverage loss.

### lwcLspHover.container.spec.ts
Twin: `specs/lwcLspHover.headless.spec.ts`
- [INTENTIONAL-GAP / EXPANSION] Twin JS-hover test is `test.skip(!isDesktop(), ...)` (twin:90) — unstable on web. Container runs BOTH the HTML-hover and JS-hover tests unconditionally (container:30,99), so it covers more than the web twin.
- [ENV] Unique `hoverHtmlComp${Date.now()}` / `hoverJsComp${Date.now()}` vs fixed names. Adds network monitoring + screenshots + "workbench ready" step. The cold-LSP re-hover poll (Escape + pointer move + hover, 45s `toPass`) and hover-card assertions (`View in Component Library` / `LightningElement`) are identical in both. No coverage loss.

### lwcLspIndexing.container.spec.ts
Twin: `specs/lwcLspIndexing.headless.spec.ts`
- [ENV] Unique `indexComp${Date.now()}` vs fixed `indexComp`. Adds network monitoring + screenshots + "workbench ready" step. Create -> open HTML -> `waitForLwcLspReady` flow identical. No coverage loss.

### lwcLspSfdxTypings.container.spec.ts
Twin: `specs/lwcLspSfdxTypings.headless.spec.ts`
- [ENV] Unique `typingsProbe${Date.now()}` vs fixed `typingsProbe`. Adds network monitoring + screenshots + "workbench ready" step.
- [ENV] Both call the shared `assertLwcSfdxTypingsGenerated(page)` helper (container:54, twin:35); the top-of-tree scroll robustness noted in the task lives in `utils/lwcUtils.ts`, not the spec. Identical assertion surface. No coverage loss.

### lwcRename.container.spec.ts
Twin: `specs/lwcRename.headless.spec.ts`
- [ENV] Twin's `waitForWorkspaceReady` replaced by fixture readiness + "workbench ready" step (container:42-47 vs twin:34-39). Adds network monitoring (twin already had it) — actually both already monitor network.
- [ENV] Screenshot names differ (`lwcRename.container.0X-*` vs `rename.*`). Both cover: seed via SFDX create, explorer-context-menu rename + tree verify (new visible / old count 0, 20s polls), then editor-context-menu rename + verify. Flow is identical. No coverage loss.

### lwcSnippets.container.spec.ts
Twin: `specs/lwcSnippets.headless.spec.ts`
- [ENV] Twin gates file-open on `isDesktop()` (Quick Open on desktop, Explorer tree on web) and seeds `snippetsE2E` on desktop; container drops `isDesktop()` entirely and always seeds via SFDX command + opens through the Explorer tree (container:47-50, header:15-18 vs twin:41-48,75,90-95). Correct — the container Page is browser-flavored.
- [ENV] Unique `snippetsHtml${Date.now()}` / `snippetsJs${Date.now()}` vs twin's `snippets{Html,Js}${workerIndex}${Date.now()}` (no workerIndex — single sequential workbench).
- [ENV] `collapseEditorWhitespace` uses a literal NBSP char in `replaceAll(' ', ' ')` (container:53) vs the explicit `' '` escape in the twin (twin:52). Functionally equivalent NBSP normalization; cosmetic.
- Both tests assert the same snippet bodies (`<lightning-button` + `variant="base"` + `label="Button Label"` + `onclick={handleClick}` + `></lightning-button>`; and `this.dispatchEvent(new CustomEvent("event-name"));`). No coverage loss.

### REVIEW items (needs attention)
none


---

## salesforcedx-vscode-metadata

17 container specs, all with origin twins (16 distinct `*.headless.spec.ts` files — `deploySource.container` shares `deploySourcePath.headless` as its origin); 3 REVIEW items.

Cross-cutting pattern (applies to nearly every spec, all **[ENV]**): container specs drop the per-test `createMinimalOrg()` + `upsertScratchOrgAuthFieldsToSettings()` setup (the `containerFixtures` boot-auths one shared tracking org), add a `beforeEach` `closeAllEditors`/`clearAllNotifications` to reset the shared persistent workbench, use unique class/manifest names to avoid collisions, and drop `SourceTrackingStatusBarPage.waitForCounts({local:…})` assertions because source-tracking counts are non-deterministic on the shared org/workbench. Deploy/retrieve completion is keyed off durable output-channel lines instead of the transient progress toast. These are noted per-spec only where they materially weaken coverage.

### deleteSource.container.spec.ts
Twin: `deleteSource.headless.spec.ts`
- [ENV] Drops `waitForCounts({local:1})` after create and `{local:0}` after deploy (headless:73,91); container asserts pre-deploy via `'Deployed Source'` output line instead of the deploy toast (container:79).
- [ENV] Adds editor-focus wait + `verifyCommandExists(deploy_this_source_text)` before deploying, to let `sf:in_package_directories` context keys settle (container:67-70).
- Core delete flow fully preserved: modal confirmation, `'Deleting'`/`'Deleted Source'` output, file leaves explorer (container:99-118 vs headless:116-142).

### deployManifest.container.spec.ts
Twin: `deployManifest.headless.spec.ts`
- Entry-point parity intact: editor context menu + explorer file context menu (container:104,119; headless:97,148).
- [ENV] Generates manifest from seeded `PagedResult.cls` with unique name vs. a freshly created class (container:83-102).
- [ENV] Drops the class edit + `waitForCounts` (local +1 → baseline) that the twin performs between deploys (headless:98-102,145,152-159,183); container just deploys the manifest, keeping only the post-deploy error-notification check (`assertNoPostDeployError`, container:63-74,115,131).
- [REVIEW-adjacent/ENV] Uses plain `deploy_in_manifest_text` (no ignore-conflicts); on the shared tracking org with pre-existing `PagedResult` conflicts this could surface conflict handling unlike the ignore-conflicts push used by `projectDeployStart.container`. Not an assertion gap; noted for consistency.

### deployOnSave.container.spec.ts
Twin: `deployOnSave.headless.spec.ts`
- [ENV] Sets `push-or-deploy-on-save.ignoreConflictsOnPush=true` in addition to `.enabled` (container:83-88) — tracking org always conflict-checks and shared `PagedResult.cls` has pre-existing remote changes. Intentional/documented.
- [ENV] Correctly does NOT set legacy `useMetadataExtensionCommands` (dead, uncontributed setting); rationale documented (container:63-82). Twin also does not set it.
- [ENV] Drops the twin's `'Deploy on save service initialized'` output assertion (headless:53-56): service inits at activation, long before this spec runs on the shared workbench, so the line is not reliably present. The authoritative signal (save → progress notification → `'Deployed Source'`) is preserved (container:117-125).
- [ENV] Selects + clears the quiet 'Salesforce Metadata' channel before editing so the assertion reflects this save (container:110-112).

### deploySource.container.spec.ts
Twin: `deploySourcePath.headless.spec.ts` (shared origin; no `deploySource.headless` exists)
- [ENV] Container-only single-entry variant: deploys the unmodified fixture `PagedResult.cls` via command palette and asserts `'Deployed Source'` + no error notification (container:73-97).
- [ENV] Drops all `waitForCounts` and the throwaway-class-per-entry-point flow of the origin; a subset of the origin's coverage (one palette deploy vs. three entry points).

### deploySourcePath.container.spec.ts
Twin: `deploySourcePath.headless.spec.ts`
- Entry-point parity intact: editor context menu, explorer file, explorer directory (container:74,89,104; headless:64,103,178).
- [ENV] Deploys unmodified fixture `PagedResult.cls` 3× rather than creating + editing a class before each entry (headless:65-80,113-135,188-195); drops all `waitForCounts({local:1}/{local:0})` — the verification that a real local change was reconciled is lost (inherent to shared org). Keeps progress-notification-disappears + `assertNoDeployError` per entry.

### deploySourcePathCommandPalette.container.spec.ts
Twin: `deploySourcePathCommandPalette.headless.spec.ts`
- [ENV] Opens fixture `ExampleClass.cls` and palette-deploys unmodified vs. twin creating a class + `waitForCounts({local:1})`→`{local:0}` (headless:64-83). Container keeps progress notification + no-error check (container:64-83).

### editorWatcher.container.spec.ts
Twin: `editorWatcher.headless.spec.ts`
- Full assertion parity: 4 context-gated commands present when fixture `PagedResult.cls` is active, absent when `sfdx-project.json` is active (container:72-94; headless:67-92).
- [ENV] Uses seeded `PagedResult.cls` instead of a created class; adds a status-bar-visible readiness gate (container:60-62).

### generateManifest.container.spec.ts
Twin: `generateManifest.headless.spec.ts`
- **[REVIEW]** Entry-point divergence: the twin's step 1 uses the **editor context menu** (`executeEditorContextMenuCommand`, headless:60); the container replaces it with the **command palette** (container:60-69), citing "the container editor context menu does not reliably surface the SFDX contributions." Net result: the editor-context-menu entry point for Generate Manifest is not verified in the container — yet `deployManifest.container` and `retrieveInManifest.container` successfully drive the editor context menu (`executeEditorContextMenuCommand`) in the same image. Confirm whether this entry point genuinely fails for Generate Manifest or whether the palette substitution is masking a real gating bug. (container:66-69)
- [ENV] Explorer-folder entry point preserved (container:89); unique manifest names per run (container:50-51).

### packageInstall.container.spec.ts
Twin: `packageInstall.headless.spec.ts`
- **[REVIEW]** `test.fixme` — entire spec disabled, so package install has **zero container coverage** while the twin runs fully (container:52). Reason (documented, container:47-51): nondeterministic on the shared persistent boot org — first attempt installs the 04t (up to 10 min); on Playwright retries the package is already installed, the install-key/"wait for completion?" quick-input flow short-circuits, and the poll-prompt `waitFor` (container:77) times out. Deterministic re-run would need an uninstall-first step. Track for a clean-slate solution.

### projectDeployStart.container.spec.ts
Twin: `projectDeployStart.headless.spec.ts`
- [INTENTIONAL-GAP][ENV] Exercises `project_deploy_start_ignore_conflicts_default_org_text` (container:86) vs. the twin's plain `project_deploy_start_default_org_text` (headless:77) — shared tracking org would otherwise stall on the conflict-resolution prompt. Consequence: the plain push command is not exercised in the container; the ignore-conflicts variant is.
- [ENV] Disables deploy-on-save then edits fixture `PagedResult.cls` to create the change (container:61-76). Both assert `'Starting metadata deployment'` + `'Deployed Source'` — parity.

### projectInfo.container.spec.ts
Twin: `projectInfo.headless.spec.ts`
- [INTENTIONAL-GAP → coverage gain] Twin is desktop-gated (`isDesktop() ? test : test.skip`, headless:28) so it is skipped in web; the container removes the gate and runs the desktop build + sf CLI against the boot org (container:41). Container ADDS coverage the web twin skips.
- [ENV] Adds `Control+End` scroll to render the virtualized `## Environment` section before asserting (container:91-92). Section assertions otherwise identical (`# Project Info`, `## Metadata`, `## Environment`).

### retrieveInManifest.container.spec.ts
Twin: `retrieveInManifest.headless.spec.ts`
- Entry-point parity: editor context menu + explorer file (container:102,117; headless:116,137). Both deploy the class first, then assert `'Retrieving'` + `'Retrieved Source'`.
- [ENV] Generates a unique-named manifest from seeded `PagedResult.cls` vs. default `package.xml` from a created class; asserts deploy via output line rather than the deploy toast (container:79-82).

### retrieveSourcePath.container.spec.ts
Twin: `retrieveSourcePath.headless.spec.ts`
- [ENV] Deploys unmodified fixture `PagedResult.cls` then retrieves via explorer context menu (container:59-91). Twin creates a class, deploys, then edits it ("remote change simulation") before retrieving and tracks `waitForCounts` (headless:61-85).
- [ENV] Drops the local-edit-before-retrieve step + count checks; the retrieve command path (`'Retrieving'`/`'Retrieved Source'`) is asserted in both. Neither asserts post-retrieve file content.

### retrieveStaleApiVersion.container.spec.ts
Twin: `retrieveStaleApiVersion.headless.spec.ts`
- Core cache-invalidation assertion fully preserved: warm manifest = `<version>63.0</version>`, edit `sfdx-project.json` → 62.0, fresh manifest = `<version>62.0</version>` (container:150,166; headless:137,156).
- [ENV] Adds a `finally` block restoring `sfdx-project.json` to baseline `64.0` so the shared workbench is left as found (container:171-174), plus unique manifest names and a `'SFDX: Create Apex Class'` readiness gate (container:132).

### sourceDiff.container.spec.ts
Twin: `sourceDiff.headless.spec.ts`
- Full assertion parity via shared `verifyDiffCompleted`: `'Retrieving 1 component for diff...'`, negative checks (no "0 components"/"No components"/"No matching files"), `'Diff completed for 1 file'`, and the `remote//…↔local//…` diff tab (container:45-69; headless:40-71). Both entry points (palette + explorer) preserved.
- [ENV] Drops `waitForCounts({local:1})` after each edit (headless:101,116,130,153). Uses throwaway class in both.

### sourceDiffMultiple.container.spec.ts
Twin: `sourceDiffMultiple.headless.spec.ts`
- **[REVIEW]** Two assertions weakened: (1) counts genericized — `'Retrieving'` + `'Diff completed for'` (container:97-98) vs. the twin's exact `'Retrieving 2 components for diff...'` + `'Diff completed for 4 files'` (headless:97-98) — justified [ENV] because the shared folder may hold other changed classes; but (2) the container also **drops the "first diff opens automatically" assertion** entirely — the twin asserts `diff.waitForTab(classNameA)` auto-opens (headless:102-105), which is the headline behavior of the spec. The container only verifies the conflict tree contains both classes and that clicking `classNameB` opens its tab (container:102-112). Confirm the auto-open-first-diff behavior is intentionally unverifiable on the shared workbench (nondeterministic first file) rather than silently lost.
- [ENV] Uses relative tree-contains-both assertions; two throwaway classes in both.

### viewChangesCommands.container.spec.ts
Twin: `viewChangesCommands.headless.spec.ts`
- Full assertion parity across all three commands: All Changes shows both section titles; Local shows local `(` section and NOT remote; Remote shows remote `(` section and NOT local (container:62-108; headless:47-111).
- [ENV] Adds a status-bar-visible readiness gate (container:57-58); structural (no absolute counts) in both.

### REVIEW items (needs attention)
1. **generateManifest.container.spec.ts:66-69** — editor-context-menu entry point replaced by command palette (claimed unreliable), leaving that entry point unverified even though `deployManifest.container` and `retrieveInManifest.container` drive the editor context menu in the same image. Verify it is a genuine limitation, not a masked gating bug.
2. **packageInstall.container.spec.ts:52** — `test.fixme`; package install has no container coverage. Documented nondeterminism on the shared boot org (already-installed 04t short-circuits the poll flow on retries). Needs a clean-slate/uninstall-first approach.
3. **sourceDiffMultiple.container.spec.ts:102-112** — drops the twin's "first diff opens automatically" (`waitForTab(classNameA)`) assertion (headless:102-105) in addition to the count genericization. Confirm the auto-open behavior is intentionally unverifiable on the shared workbench, not accidentally lost.


---

## salesforcedx-vscode-org

6 container specs, 6 desktop twins (1:1 by base name), 0 REVIEW items. The one alias-assertion drop is documented and INTENTIONAL; all other diffs are ENV (shared-boot-org vs per-test-created-org plumbing plus container-only monitoring/screenshots). No `test.fixme`/`test.skip`, no timeout weakening (all specs keep `test.setTimeout(120_000)`), no selector/flow regressions.

### aliasList.container.spec.ts
Twin: `aliasList.desktop.spec.ts`
- [INTENTIONAL-GAP] Desktop asserts 4 strings in the output channel — `Alias`, `Username`, `MINIMAL_ORG_ALIAS`, and the resolved `username` (aliasList.desktop.spec.ts:52-55). Container asserts only the two column headers `Alias` and `Username` and DROPS both the alias-row (`MINIMAL_ORG_ALIAS`) and `username` assertions (aliasList.container.spec.ts:74-75). Reason is documented in the header (lines 15-19): the container boots via injected `SF_ACCESS_TOKEN`+`INSTANCE_URL` and its `sfdx-org-auth.sh` logs the org in as default but registers no host `minimalTestOrg` alias, so `sf alias list` renders only the header row. This is the flagged alias-drop; documented and unavoidable in-container, so INTENTIONAL-GAP (weakens the round-trip proof from "specific alias/username renders" to "header renders" only).
- [ENV] No org creation: desktop calls `createMinimalOrg()` + `sf org display --json` to resolve the username (aliasList.desktop.spec.ts:32-40); container reuses the shared boot org (no setup).
- [ENV] Container adds console/network monitoring + `validateNoCriticalErrors`, screenshots, `ensureOutputPanelOpen`, `selectOutputChannel` timeout arg, and a `beforeEach` state reset (closeAllEditors/clearAllNotifications) for the shared persistent workbench (aliasList.container.spec.ts:44-47,51-52,69-71,79).

### orgCommands.container.spec.ts
Twin: `orgCommands.desktop.spec.ts`
- [ENV] Full assertion parity: both verify the same 3 palette commands present — `org_login_web_authorize_org_text`, `org_login_web_authorize_dev_hub_text`, `config_set_org_text` (container 49-57; desktop 24-33). No dropped/added/weakened assertions.
- [ENV] Container uses `containerTest` fixture (shared workbench) vs desktop `orgDesktopTest`; adds console/network monitoring, screenshot, and `beforeEach` reset. Org-free on both sides.

### orgDeleteCommandVisibility.container.spec.ts
Twin: `orgDeleteCommandVisibility.desktop.spec.ts`
- [ENV] Assertion parity: both gate on `org_login_web_authorize_org_text` then assert `org_delete_default_text` is visible; both are visibility-only and neither runs the command (container 54-61; desktop 34-41). The negative/hidden case is deferred to the `updateContext` jest test in both (container header 14-15; desktop 20-22).
- [ENV] No org creation: desktop `createMinimalOrg()` + `upsertScratchOrgAuthFieldsToSettings` (desktop 26-32); container relies on the scratch boot org already being the default (`isScratch === true` sets `sf:default_org_deletable`). Container adds monitoring/screenshot/beforeEach.

### orgDisplay.container.spec.ts
Twin: `orgDisplay.desktop.spec.ts`
- [ENV] Assertion parity: both run `org_display_default_text` and assert the `Connected Status` output-channel row (container 64,72; desktop 45,53). Same end-to-end proof (CLI round-trip + JSON decode + table render).
- [ENV] No org creation: desktop `createMinimalOrg()` (desktop 32-38); container uses boot default org. Container adds the activation-command gate (`org_login_web_authorize_org_text`, line 59-61 — also present in desktop 41-43), monitoring, screenshots, `ensureOutputPanelOpen`, and beforeEach reset.

### orgLoginAccessToken.container.spec.ts
Twin: `orgLoginAccessToken.desktop.spec.ts`
- [ENV] Assertion parity: both run `org_login_access_token_text`, assert the instance-URL quick-input is visible (30s), press Esc, assert the widget is hidden (10s) and that zero error notifications appear (container 64-76; desktop 41-52). Identical selectors, timeouts, and cancel-flow. Neither completes a real login (success path covered by jest per both headers).
- [ENV] Setup differs: desktop `setupMinimalOrgAndAuth(page)` (desktop 30-33); container uses the shared boot org + open sfdx-project fixture (satisfies `sf:project_opened`). Container adds monitoring/screenshot/beforeEach.

### orgOpen.container.spec.ts
Twin: `orgOpen.desktop.spec.ts`
- [ENV] Assertion parity: both run `org_open_default_scratch_org_text` and assert the `with the following URL:` fragment in the output channel (container 64,73; desktop 45,52). Desktop actually opens a real browser via openExternal but asserts only via the output channel per the WI; container suppresses the browser and surfaces `org_open_container_mode_message_text` — same asserted fragment, so the stdout-parse proof is preserved.
- [ENV] No org creation: desktop `createMinimalOrg()` + `upsertScratchOrgAuthFieldsToSettings` (desktop 31-37); container uses boot default org. Container adds monitoring/screenshots/`ensureOutputPanelOpen`/beforeEach.

### REVIEW items (needs attention)
none


---

## salesforcedx-vscode-org-browser

4 container specs, 3 origin twins (1 container-only smoke), 0 REVIEW items. Parity is strong: the toggle/text-filter/describe container specs are near line-for-line ports of their headless/scratch twins, with divergences all tracing to the shared-boot-org / code-server-web environment (ENV) or explicitly documented Dreamhouse-metadata omissions (INTENTIONAL-GAP).

### orgBrowser.container.spec.ts
Twin: no direct origin twin (container-only smoke test). Conceptually overlaps `orgBrowser.describe.scratch.spec.ts` and complements the retrieval headless specs (`orgBrowser.customObject/customTab/folderedReport.headless.spec.ts`).

- [INTENTIONAL-GAP] Container-only org-light smoke: asserts `openOrgBrowser()` loads the live describe (≥5 types) and a universal type `ApexClass` resolves at tree root (role `treeitem`, `aria-level=1`). No origin twin verifies exactly this; it is the "does the browser boot & describe in the CB image" half. `orgBrowser.container.spec.ts:41-50`.
- [INTENTIONAL-GAP] Retrieval behavior verified by the web twins (`orgBrowser.customObject/customTab/folderedReport.headless.spec.ts`) is deliberately NOT ported to the container — spec runs against the minimal boot org and writes nothing into the shared fixture. Documented in header. `orgBrowser.container.spec.ts:8-15`.
- [ENV] Uses `containerTest` fixture (shared persistent workbench + boot-authed org) instead of `createDreamhouseOrg`/`upsertScratchOrgAuthFieldsToSettings`; adds `setupConsoleMonitoring`/`setupNetworkMonitoring` + `validateNoCriticalErrors`. `orgBrowser.container.spec.ts:31-52`.
- [ENV] `test.setTimeout(3*60*1000)` (3 min) vs no analogous per-test override; unique to this smoke. `orgBrowser.container.spec.ts:30`.

### orgBrowser.describe.container.spec.ts
Twin: `orgBrowser.describe.scratch.spec.ts`.

- [ENV] Assertions are IDENTICAL to origin: validates CustomObject, StaticResource, and CustomTab UI (hover, visible, role `treeitem`, `aria-level=1`, toolbar `Refresh Type` + `Retrieve Metadata` buttons). No dropped/weakened assertions. `orgBrowser.describe.container.spec.ts:50-69` vs `orgBrowser.describe.scratch.spec.ts:32-51`.
- [ENV] Setup swaps Dreamhouse org creation for the shared boot org; adds `beforeEach` reset (closeWelcomeTabs, hide secondary sidebar, closeAllEditors, clearAllNotifications, `normalizeOrgBrowserFilters`) to cope with the persistent workbench. `orgBrowser.describe.container.spec.ts:33-39`.
- [ENV] Adds console/network monitoring + `validateNoCriticalErrors`; origin has none. `orgBrowser.describe.container.spec.ts:42-43,71`.
- [ENV] No file-level `test.setTimeout`; origin sets `10*60*1000`. Container relies on config default (workers=1). `orgBrowser.describe.scratch.spec.ts:18`.

### orgBrowser.filterToggle.container.spec.ts
Twins: `orgBrowser.filterToggle.headless.spec.ts` (primary) + `orgBrowser.filterToggle.desktop.spec.ts` (desktop-only, intentionally not ported).

- [ENV] All 6 active headless tests are ported 1:1 with matching assertions (toolbar button visibility, icon swap, org-toggle-before-expand, both-toggles-independent incl. `waitForRootTypeCount(0)` empty-tree, orgOnly mode, legacy viewMode migration). No assertions dropped/weakened. `orgBrowser.filterToggle.container.spec.ts:42-231` vs `orgBrowser.filterToggle.headless.spec.ts:29-199`.
- [INTENTIONAL-GAP] `localOnly mode (showOrg OFF)` is `test.skip` in BOTH files — matched skip. Origin reason: e2e workspace's force-app created empty, no local overlap (`orgBrowser.filterToggle.headless.spec.ts:148-153`). Container reason: container workspace local shape isn't a stable contract (`orgBrowser.filterToggle.container.spec.ts:181-184`).
- [INTENTIONAL-GAP] Desktop twin's `filter state persists across reload` is NOT ported: `Developer: Reload Window` triggers a full web reload that re-fetches bundles in code-server (flaky, unrelated to persistence). Documented in header. `orgBrowser.filterToggle.container.spec.ts:14-16`; origin `orgBrowser.filterToggle.desktop.spec.ts:30-60`.
- [ENV] Adds `beforeEach` filter-state normalization + console/network monitoring + `validateNoCriticalErrors`; setup swaps Dreamhouse for boot org. `orgBrowser.filterToggle.container.spec.ts:34-40`.

### orgBrowser.textFilter.container.spec.ts
Twin: `orgBrowser.textFilter.headless.spec.ts`.

- [INTENTIONAL-GAP] Origin has 10 tests; container has 8. Two Dreamhouse-`Broker__c`-specific subtests are omitted (not present, not `test.skip`): `Type:component filters expanded children` (`CustomObject:Broker__c`) and `combined wildcard *Object:*Broker* works`. The boot org lacks `Broker__c`. Documented in header + trailing SKIP note. `orgBrowser.textFilter.container.spec.ts:11-14,205-209`; origin subtests `orgBrowser.textFilter.headless.spec.ts:60-79,181-195`.
- [ENV] The 8 ported tests keep identical assertions (filled-icon swap, exact type narrows to 1 with `^ApexClass`, unresolved empties tree, Escape cancels, clear-and-Enter restores count, composes-with-toggle, `Apex*` wildcard narrows + all-visible-`^Apex`, `ApexClass:*Test*` component wildcard all-`Test`). `orgBrowser.textFilter.container.spec.ts:40-203` vs origin `29-179`.
- [ENV] Component-level `ApexClass:*Test*` test relies on container workspace seeding local `…Test.cls` ApexClass components for a non-empty case; origin relies on Dreamhouse Apex. Behavior asserted is the same (level-2 children all match `/Test/i`). Also covers the Type:component filtering concept lost with the dropped `CustomObject:Broker__c` subtest. `orgBrowser.textFilter.container.spec.ts:185-200`.
- [ENV] Adds `beforeEach` normalization + console/network monitoring + `validateNoCriticalErrors`; boot org instead of Dreamhouse; no file-level `test.setTimeout` (origin `600_000`). `orgBrowser.textFilter.container.spec.ts:32-38`; origin `orgBrowser.textFilter.headless.spec.ts:19`.

### REVIEW items (needs attention)
None. Every divergence is either an environment adaptation (shared boot org / code-server web / persistent workbench) or an explicitly documented, Dreamhouse-metadata-dependent omission with a rationale in the spec header. No silently dropped or weakened assertions, and no unexplained fixme/skip.


---

## salesforcedx-vscode-services

1 container spec, 3 headless twins (one family: `retrieveOnLoad*`), 0 REVIEW items.

### retrieveOnLoad.container.spec.ts

Twins: `retrieveOnLoadEmpty.headless.spec.ts` (direct twin — the no-op/skip branch), plus the positive-retrieve family `retrieveOnLoadMetadata.headless.spec.ts` and `retrieveOnLoadRetry.headless.spec.ts`. The container header (lines 8-18) explicitly names `retrieveOnLoad*.headless.spec.ts` as the web twins and scopes the container spec to the activation + no-op branch only.

Diffs vs the closest twin (`retrieveOnLoadEmpty.headless.spec.ts`):

- [ENV] No org auth setup. Empty twin creates a scratch org and writes its auth into settings (`createMinimalOrg` + `upsertScratchOrgAuthFieldsToSettings`, retrieveOnLoadEmpty.headless.spec.ts:36-37). Container spec omits both and relies on the shared boot-authed org + mounted fixture provided by `containerFixtures` (retrieveOnLoad.container.spec.ts:33,40-44).
- [ENV] Workbench readiness moved out of `beforeEach`. Twin calls `waitForVSCodeWorkbench` in `test.beforeEach` (retrieveOnLoadEmpty.headless.spec.ts:25-29); container relies on the fixture having already awaited readiness and only runs `closeWelcomeTabs` + `ensureSecondarySideBarHidden` in a step (retrieveOnLoad.container.spec.ts:40-44).
- [ENV] Timeout reduced 5m -> 3m (retrieveOnLoadEmpty.headless.spec.ts:32 vs retrieveOnLoad.container.spec.ts:36); no org creation in the container path, so the shorter budget is expected.
- [INTENTIONAL-GAP] Added network monitoring + `validateNoCriticalErrors(..., networkErrors)` (retrieveOnLoad.container.spec.ts:38,58). This is a strengthening, not a weakening — the Empty twin monitors console only (retrieveOnLoadEmpty.headless.spec.ts:33,51).
- Parity kept: activation proven via `SERVICES_CHANNEL_NAME` appearing in the output channel (retrieveOnLoad.container.spec.ts:46-51 ≈ retrieveOnLoadEmpty.headless.spec.ts:40-45), and the core no-op assertion `outputChannelContains('Retrieving metadata on load') === false` is identical (retrieveOnLoad.container.spec.ts:53-56 vs retrieveOnLoadEmpty.headless.spec.ts:47-48).

Diffs vs the positive-retrieve twins (`retrieveOnLoadMetadata`, `retrieveOnLoadRetry`):

- [INTENTIONAL-GAP] Entire positive-retrieve path dropped: no `upsertRetrieveOnLoadSetting`, no `'Retrieving metadata on load'` / `'Retrieve on load completed'` / `'files retrieved successfully'` assertions, no retrieved-file tab checks (retrieveOnLoadMetadata.headless.spec.ts:44,51-53,57-58,61-73; retrieveOnLoadRetry.headless.spec.ts:42,50-53,57-58). Container header (retrieveOnLoad.container.spec.ts:14-17) documents why: the positive path is org/network-bound and in a container would require a window reload plus writing retrieved metadata into the shared mounted fixture, which could leak into other packages' specs. Left to web/desktop suites by design.
- [INTENTIONAL-GAP] Retry-specific assertion (`'Project resolution failed' === false`, retrieveOnLoadRetry.headless.spec.ts:52-53) not ported — it only makes sense once a retrieve is actually triggered, which the container spec intentionally avoids.

No `test.fixme` / `test.skip` in any of these specs.

### REVIEW items (needs attention)

none. The dropped positive-retrieve coverage is explicitly justified in the container spec header as environment/isolation-driven (org/network-bound, shared mounted fixture leak risk) and remains covered by the web/desktop twins; the no-op + activation branch is faithfully ported and even hardened with network monitoring.


---

## salesforcedx-vscode-soql

Summary: 2 container specs, 2 origin twins, 1 REVIEW item. `soqlQueryPlan.container.spec.ts` is a faithful port (all 3 sub-flows preserved). `soqlRunQuery.container.spec.ts` keeps only 1 of the origin's 5 execution flows — dropping command-palette current-file/selected-text, Tooling API, and the ALL ROWS → /queryAll routing verification.

### soqlQueryPlan.container.spec.ts
Twin: `packages/salesforcedx-vscode-soql/test/playwright/specs/soql-query-plan.spec.ts`

- [ENV] Setup swapped from `setupMinimalOrgAndAuth` + `waitForExtensionsActivated` to the shared `containerTest` fixture (boot-authed org, persistent workbench). soqlQueryPlan.container.spec.ts:39,51-54,61-65 vs soql-query-plan.spec.ts:44-50
- [ENV] Adds `test.beforeEach` reset (`closeAllEditors` + `clearAllNotifications`) because the workbench is shared across specs. soqlQueryPlan.container.spec.ts:51-54
- [ENV] Filename made unique per run (`CbSoqlPlan${Date.now()}`) vs fixed `MySoqlQueryPlanFile`, to avoid collisions in the shared/persistent workbench. soqlQueryPlan.container.spec.ts:45 vs soql-query-plan.spec.ts:33
- [ENV] `verifyCommandExists` given a 120_000ms timeout (extension activation slower in-image) vs default. soqlQueryPlan.container.spec.ts:64 vs soql-query-plan.spec.ts:49
- [ENV] Fewer intermediate screenshots (debug artifacts only); no assertion impact. All three sub-flows and their `PLAN_COMPLETE_TEXT` waits are preserved verbatim.
- No dropped/weakened assertions. All 3 flows (Get Query Plan code lens, current-file via palette, selected-text via palette) present with identical `waitForOutputChannelText(PLAN_COMPLETE_TEXT)` checks and identical selection-sanity check. Same `SOQL_QUERY` (LIMIT 10). No fixme/skip.

### soqlRunQuery.container.spec.ts
Twin: `packages/salesforcedx-vscode-soql/test/playwright/specs/soql-run-query.spec.ts`

- [ENV] Setup swapped to the `containerTest` fixture (boot-authed org) from `setupMinimalOrgAndAuth` + `waitForExtensionsActivated`. soqlRunQuery.container.spec.ts:35,50-54 vs soql-run-query.spec.ts:44-50
- [ENV] Filename unique per run (`CbSoql${Date.now()}`) vs fixed `MySoqlRunQueryFile`. soqlRunQuery.container.spec.ts:40 vs soql-run-query.spec.ts:34
- [ENV] `verifyCommandExists` 120_000ms timeout vs default. soqlRunQuery.container.spec.ts:53
- [ENV] Query narrowed to `LIMIT 5` vs origin `LIMIT 10`; still only asserts `records returned`, so no behavioral difference. soqlRunQuery.container.spec.ts:41 vs soql-run-query.spec.ts:35
- [REVIEW] Only the "Run Query" code lens (REST API) flow is ported. The origin's 4 additional execution flows are absent with no explanation in the header comment (which only says it "proves a query actually executes against the org"):
  - Dropped: run query on **current file via command palette** (`data_query_document_text`). soql-run-query.spec.ts:100-117
  - Dropped: run query on **selected text via command palette** (`data_query_selection_text`). soql-run-query.spec.ts:119-161
  - Dropped: **Tooling API** run path (`selectQuickInputOption(/^Tooling API/)` against `ApexClass`) — the only coverage that the Tooling-vs-REST branch works. soql-run-query.spec.ts:163-197
  - Dropped: **ALL ROWS → /queryAll routing** verification (query ending in `ALL ROWS` must be stripped and routed via scanAll; "records returned" is the durable cross-mode signal). soql-run-query.spec.ts:199-234
- [REVIEW] Asymmetry vs sibling: the query-plan container spec preserved all 3 of its origin's sub-flows, but this run-query container spec collapsed 5 origin flows into 1. If dropping the palette/Tooling/ALL-ROWS flows is intentional (e.g. deemed redundant with the REST code-lens path or covered by the web twin), that rationale is not documented; if unintentional it is a real coverage regression. Confirm intent. soqlRunQuery.container.spec.ts:45,75-91
- No fixme/skip in either spec.

### REVIEW items (needs attention)
- `soqlRunQuery.container.spec.ts` ports only the REST code-lens flow and drops 4 of the origin's 5 execution flows: command-palette current-file (soql-run-query.spec.ts:100-117), command-palette selected-text (:119-161), Tooling API path (:163-197), and ALL ROWS → /queryAll routing (:199-234). The Tooling API and ALL ROWS cases each verify distinct backend routing behavior that nothing else in the container suite exercises. No header comment explains the omission, and the sibling query-plan container spec kept full parity. Verify whether this narrowing is intentional.


---

## salesforcedx-vscode-visualforce

Summary: 2 container specs, 2 headless twins (both matched by base name + header comment), 1 REVIEW item — the container LSP spec ports only the completion test and silently drops the hover test that its headless twin covers.

### visualforceLsp.container.spec.ts

Twin: `visualforceLsp.headless.spec.ts` (named in header comment lines 9-13 and matched by base name).

- The headless twin has **two** tests: `provides autocompletion for apex tags in .page files` (headless:61) and `provides hover for mixed-case apex tags in .page files` (headless:104). The container spec ports only the completion test (`autocompletes apex tags in a .page file`, container:50). [REVIEW] the hover test is dropped with no note explaining why — see container:50-99 (single test only).
- Completion test is a faithful port: identical `seedAndOpenPage` helper (container:38-48 vs headless:34-49), identical trigger (`<apex:pageM` + Control+Space, container:71-73 vs headless:74-76), identical `apex:pageMessage` suggestion assertion (container:79-83 vs headless:83-86), identical accept/save/dirty check and editor-buffer assertion. No weakened assertions in the ported test. [INTENTIONAL-GAP] container:87-96 merges the twin's separate "accept" (headless:90-95) and "assert inserted tag" (headless:97-101) steps into one step — same assertions, cosmetic only.
- Same test timeout `3 * 60 * 1000` (container:51 vs headless:62). No timeout weakening.
- `validateNoCriticalErrors` runs inline at end of the single test (container:98) instead of the twin's `afterEach` (headless:154-158) — equivalent monitoring, driven by the container fixture's single-test model. [ENV]
- Workbench readiness handled by the container fixture + explicit `closeWelcomeTabs`/`ensureSecondarySideBarHidden` step (container:58-63) vs the twin's `beforeEach` with `waitForVSCodeWorkbench`/`waitForWorkspaceReady` (headless:52-59). [ENV]
- Header note (container:11-13): self-seeds a throwaway `.page`, no org / no committed fixture — org-free by design. [ENV]
- No `test.fixme` / `test.skip` in either file. The headless twin carries a `// TODO` about Go to Definition being unimplemented in the VF language server (headless:151-152) — a documented pre-existing gap, not a dropped test; correctly absent from the container spec too.

### visualforceTemplates.container.spec.ts

Twin: `visualforceTemplates.headless.spec.ts` (named in header comment lines 9-15 and matched by base name).

- Full parity: both specs have the same two tests — Create Visualforce Page (container:72 vs headless:74) and Create Visualforce Component (container:90 vs headless:79). No dropped/added tests.
- Identical `createVisualforceTemplate` helper: command-palette → name → output-dir flow (container:44-53 vs headless:46-57), same editor-opens assertion (container:57-58 vs headless:59-60), same "both files land in explorer" `Promise.all` assertion over `.<ext>` and `.<ext>-meta.xml` (container:60-67 vs headless:62-69). No weakened assertions.
- Container adds explicit `test.setTimeout(3 * 60 * 1000)` per test (container:73, 91); the twin sets no per-test timeout. This is a raised/added guardrail, not a weakening. [ENV]
- Workbench readiness as a per-test step (container:78-83, 96-101) vs the twin's `beforeEach` (headless:33-40); `validateNoCriticalErrors` inline per test (container:87, 105) vs twin `afterEach` (headless:84-88). Equivalent, driven by the container single-test/shared-workspace model. [ENV]
- Header note (container:10-14): org-free — commands only scaffold local files, no scratch org / committed fixture needed. [ENV]
- No `test.fixme` / `test.skip` in either file.

### REVIEW items (needs attention)

- `visualforceLsp.container.spec.ts`: the container spec ports only 1 of the 2 headless LSP tests. The hover test (`provides hover for mixed-case apex tags in .page files`, `visualforceLsp.headless.spec.ts:104-149`) has no container counterpart and no note stating the omission is intentional. The container header scopes the spec to proving the LSP "starts and answers," which the completion test satisfies, so this may be a deliberate smoke-test scoping — but it is undocumented, so confirm whether container hover coverage was intentionally excluded or should be added.


---

