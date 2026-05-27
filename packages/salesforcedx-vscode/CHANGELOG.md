# 66.13.0 - May 27, 2026

## Added

#### salesforcedx-vscode-apex-testing

- The Apex Test Explorer now performs an incremental update when you deploy a class instead of clearing the entire test tree. Only the deployed class is refreshed at method granularity, and existing results are preserved and marked stale so you don't lose context from your last run. ([PR #7300](https://github.com/forcedotcom/salesforcedx-vscode/pull/7300))

- We added a new setting, **Restore Previous Results**, that restores your Apex test results when you reload the workspace (results from the last 24 hours, marked stale). Use the **Don't Restore Again** action to disable it for a workspace. ([PR #7300](https://github.com/forcedotcom/salesforcedx-vscode/pull/7300))

## Fixed

#### salesforcedx-vscode-apex-log

- When you click the **Create trace flag for current user** code lens, you can now choose a debug level from a dropdown instead of being defaulted to `ReplayDebuggerLevels`. ([PR #7330](https://github.com/forcedotcom/salesforcedx-vscode/pull/7330), [ISSUE #7262](https://github.com/forcedotcom/salesforcedx-vscode/issues/7262))

## Under the Hood

- We made some under the hood changes. ([PR #7343](https://github.com/forcedotcom/salesforcedx-vscode/pull/7343))
