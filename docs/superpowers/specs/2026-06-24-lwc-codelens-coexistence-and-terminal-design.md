# LWC Test Code-Lens Coexistence + Terminal Suppression — Design (W-23094301 follow-on)

**Context:** Follow-on to routing LWC test entry points through the native Test Controller. Manual testing surfaced two issues: (1) with `firsttris.vscode-jest-runner` installed, our LWC code lenses are suppressed entirely, so Jest-Runner users never get our native-feedback code lens; (2) controller-driven runs show a redundant jest terminal alongside the Test Results tab.

**Goal:** Make our LWC code lenses always visible and identifiable, with a one-time heads-up when Jest Runner is also installed; stop showing the redundant jest terminal on controller runs (results already flow to Test Results).

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
