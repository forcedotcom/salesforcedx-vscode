# 67.3.0 - July 1, 2026

## Added

#### salesforcedx-apex-replay-debugger

- The **Variables** panel now sorts variables alphabetically. ([PR #7559](https://github.com/forcedotcom/salesforcedx-vscode/pull/7559), [DISCUSSION #5457](https://github.com/forcedotcom/salesforcedx-vscode/discussions/5457))

#### salesforcedx-vscode-lwc

- LWC Jest run and debug entry points (command palette, editor-title buttons, code lens) now route through VS Code's native **Test Controller**, giving you real-time feedback — progress spinners and results in the **Test Results** panel. ([PR #7577](https://github.com/forcedotcom/salesforcedx-vscode/pull/7577))

#### salesforcedx-vscode-org

- Canceling **SFDX: Delete Default Org** now terminates the underlying process immediately. ([PR #7524](https://github.com/forcedotcom/salesforcedx-vscode/pull/7524))

#### salesforcedx-vscode-soql

- The **SOQL Query Builder** now supports the `ALL ROWS` clause, letting you include deleted and archived records in query results. ([PR #7560](https://github.com/forcedotcom/salesforcedx-vscode/pull/7560))

## Fixed

#### salesforcedx-apex-debugger

- We fixed a bug where parent-relationship and child-subquery SObject fields showed `[object Object]` in the interactive debugger **Variables** panel. ([PR #7519](https://github.com/forcedotcom/salesforcedx-vscode/pull/7519), [ISSUE #4065](https://github.com/forcedotcom/salesforcedx-vscode/issues/4065))

#### salesforcedx-apex-replay-debugger

- We fixed a bug where nested related-object variables (parent SObject relationships, multi-level hierarchies, child subqueries) showed `[object Object]` instead of expanding in the **Variables** panel. ([PR #7517](https://github.com/forcedotcom/salesforcedx-vscode/pull/7517), [ISSUE #4065](https://github.com/forcedotcom/salesforcedx-vscode/issues/4065))

#### salesforcedx-vscode-apex-log

- We fixed a bug where the **Trace Flags** view failed entirely when a trace flag referenced a deleted debug level; the view now renders and surfaces the unresolvable flag gracefully. ([PR #7531](https://github.com/forcedotcom/salesforcedx-vscode/pull/7531), [ISSUE #7528](https://github.com/forcedotcom/salesforcedx-vscode/issues/7528))

- **SFDX: Remove Debug Level** now shows a quick pick when run from the command palette, letting you choose which debug level to remove instead of silently doing nothing. ([PR #7562](https://github.com/forcedotcom/salesforcedx-vscode/pull/7562))

- **SFDX: Remove Trace Flag** now shows a quick pick when run from the command palette, letting you choose which trace flag to remove instead of silently doing nothing. ([PR #7537](https://github.com/forcedotcom/salesforcedx-vscode/pull/7537))

- We fixed a bug where the trace flag status bar icon reflected trace flags created for other users; it now only tracks the current user's active trace flag. ([PR #7534](https://github.com/forcedotcom/salesforcedx-vscode/pull/7534))

- The trace flag status bar icon now clears automatically when the active trace flag expires, without requiring a manual toggle or reload. ([PR #7520](https://github.com/forcedotcom/salesforcedx-vscode/pull/7520), [ISSUE #1417](https://github.com/forcedotcom/salesforcedx-vscode/issues/1417))

#### salesforcedx-vscode-lwc

- We fixed a bug where LWC tests disappeared from the test explorer when the **@in-workspace** filter was active. ([PR #7529](https://github.com/forcedotcom/salesforcedx-vscode/pull/7529), [ISSUE #7350](https://github.com/forcedotcom/salesforcedx-vscode/issues/7350))

#### salesforcedx-vscode-metadata

- Deploy and retrieve commands now pick up changes to `sourceApiVersion` in `sfdx-project.json` mid-session, without requiring a reload. ([PR #7521](https://github.com/forcedotcom/salesforcedx-vscode/pull/7521), [ISSUE #5313](https://github.com/forcedotcom/salesforcedx-vscode/issues/5313))
