# LWC Test Code-Lens Coexistence + Terminal Suppression — Design (W-23094301 follow-on)

**Context:** Follow-on to routing LWC test entry points through the native Test Controller. Manual testing surfaced two issues: (1) with `firsttris.vscode-jest-runner` installed, our LWC code lenses are suppressed entirely, so Jest-Runner users never get our native-feedback code lens; (2) controller-driven runs show a redundant jest terminal alongside the Test Results tab.

**Goal:** Make our LWC code lenses always visible and identifiable, with a one-time heads-up when Jest Runner is also installed; stop showing the redundant jest terminal on controller runs (results already flow to Test Results).

**Status:** Part A (Code-lens coexistence) implemented in commit d9c7c5206. Part B (terminal suppression) implemented in commits 379161eda (initial) and f33fac77b (refinement).

## Constraints

- **Web/browser extension host compatible.** No `child_process` (Code Builder Web). Runs MUST stay on the `vscode.Task` mechanism.
- `taskService.createTask` is shared by the WATCH path (`testRunner.ts:167`, deferred work) and the CONTROLLER RUN path (`lwcTestController.ts:469`). Terminal changes MUST NOT alter watch behavior.
- New user-facing strings require entries in BOTH `src/messages/i18n.ts` and `src/messages/i18n.ja.ts`.
- `globalState` is web-safe and already reachable: `registerLwcTestCodeLensProvider(extensionContext)` receives `ExtensionContext`.

## Part A — Code-lens coexistence

Files: `src/testSupport/codeLens/provideLwcTestCodeLens.ts`, `src/testSupport/codeLens/lwcTestCodeLensProvider.ts`, `src/messages/i18n.ts`, `src/messages/i18n.ja.ts`, a new constant in `src/testSupport/types/constants.ts`.

1. **Remove the deferral.** Delete `isJestRunnerExtensionPresent()` and the early `return []` in `provideLwcTestCodeLens` (lines 76-79). Our lenses always render.
2. **Relabel** the four code-lens titles with a `(LWC)` suffix (both i18n files):
   - `run_test_title`: `Run Test (LWC)`
   - `debug_test_title`: `Debug Test (LWC)`
   - `run_all_tests_title`: `Run All Tests (LWC)`
   - `debug_all_tests_title`: `Debug All Tests (LWC)`
   - Code-lens `command` ids unchanged (`sf.lightning.lwc.test.case.run` / `.case.debug`).
3. **One-time notification.** When `provideCodeLenses` produces lenses for an LWC test file AND `extensions.getExtension('firsttris.vscode-jest-runner')?.isActive` AND a `globalState` flag is unset:
   - `vscode.window.showInformationMessage(<message>, <"Don't show again">)`.
   - On the action, set the globalState flag (key constant, e.g. `LWC_JEST_RUNNER_DUPLICATE_LENS_NOTICE_DISMISSED`).
   - Fires at most once per machine; triggered lazily on first qualifying `provideCodeLenses` (not at activation).
   - The provider receives/stashes `ExtensionContext` (passed via `registerLwcTestCodeLensProvider`). New i18n string for the message text. Show the notification non-blocking (fire-and-forget; do not await it inside `provideCodeLenses`, which must return synchronously/promptly).

## Part B — Suppress the redundant run terminal

Files: `src/testSupport/testRunner/taskService.ts`, `src/testSupport/testExplorer/lwcTestController.ts`.

- Keep the `vscode.Task` (writes the JSON result file the controller reads). Hide its terminal.
- Add an OPTIONAL presentation parameter to `taskService.createTask` (default preserves current behavior, so the WATCH caller is unaffected). The controller run path passes a "hidden terminal" presentation.
- First attempt: presentation with `reveal: Never` (already), `panel: TaskPanelKind.Dedicated`, `echo: false`, `focus: false`, `showReuseMessage: false`, `clear: true`.
- Contingency if VS Code still surfaces a visible terminal: use a `CustomExecution` with a no-output pseudoterminal (still task-based, web-safe). Document if used.

## Testing

- Unit (jest): deferral removed (lenses always returned even when jest-runner "active"); labels carry `(LWC)`; notification fires once then is suppressed by globalState (mock `extensions.getExtension`, `vscode.window.showInformationMessage`, `globalState.get/update`); `createTask` honors the presentation override and the watch caller's default is unchanged.
- Manual (EDH, Jest Runner ENABLED): both lens sets visible, ours labeled `(LWC)`, one-time popup appears then never again after dismiss. Manual (run): Test Results populates; no redundant visible terminal.

## Out of scope

Watch mode behavior and its terminal; any change to Jest Runner; the watch -> Continuous Run migration (separate follow-up WI).

## Implementation Notes (Part A)

**Commit:** d9c7c5206464f59fb278569e6594afdb3d018704

**Changes made:**

1. **Removed Jest Runner deferral logic** (`provideLwcTestCodeLens.ts`)
   - Deleted `isJestRunnerExtensionPresent()` function
   - Removed early `return []` check
   - LWC code lenses now always render regardless of Jest Runner presence

2. **Added (LWC) suffix to code lens titles** (`i18n.ts`, `i18n.ja.ts`)
   - `run_test_title`: "Run Test (LWC)"
   - `debug_test_title`: "Debug Test (LWC)"
   - `run_all_tests_title`: "Run All Tests (LWC)"
   - `debug_all_tests_title`: "Debug All Tests (LWC)"

3. **Implemented one-time Jest Runner notification** (`lwcTestCodeLensProvider.ts`)
   - Added `maybeNotifyJestRunnerDuplicate()` method to provider class
   - Checks for active Jest Runner extension (`firsttris.vscode-jest-runner`)
   - Uses globalState flag `LWC_JEST_RUNNER_DUPLICATE_LENS_NOTICE_DISMISSED` (added to `constants.ts`)
   - Tracks session state with `notifiedThisSession` flag to prevent multiple notifications
   - Shows non-blocking information message with "Don't show again" button
   - New i18n strings: `jest_runner_duplicate_codelens_message`, `jest_runner_dont_show_again_button`

4. **Test coverage**
   - New test file: `lwcTestCodeLensProvider.test.ts` with comprehensive tests for notification logic
   - Updated `provideLwcTestCodeLens.test.ts` to verify lenses always returned
   - Fixed VS Code mocks in `setup-jest.ts` and `vscode.js` to support testing

**Behavior:** Users with both extensions installed now see both sets of code lenses, with ours labeled "(LWC)" for clarity. A one-time notification explains the duplication and highlights that the (LWC) lenses integrate with Test Explorer.

## Implementation Notes (Part B)

**Commits:** 379161eda (initial), f33fac77b (refinement)

**Initial approach (379161eda):** Added optional `presentationOverride` parameter to `taskService.createTask` for callers to customize terminal presentation.

**Refined approach (f33fac77b):** Reverted to simpler design using default shared panels.

**Changes made:**

1. **`taskService.createTask` defaults** (`taskService.ts`)
   - Removed `presentationOverride` parameter
   - Default presentation: `Shared` panel (reused across runs, not spawned per-run), `reveal: Never`, `echo: false`, `focus: false`, `clear: true`, `showReuseMessage: false`

2. **Controller-driven run path** (`lwcTestController.ts`)
   - In `executeOne` method (non-debug branch), removed custom presentation override
   - Uses default presentation from `createTask` — terminal hidden yet shared, avoiding redundant terminals spawned per run
   - Real feedback surface is Test Results tab

3. **Test coverage** (`taskService.test.ts`)
   - Single test verifies default presentation includes hidden shared panel

**Behavior:** Controller-driven test runs reuse a single shared terminal (hidden from user) across multiple runs, eliminating redundant terminals. Test output flows to JSON result file, which the controller reads and populates into Test Results tab. Watch mode unaffected.
