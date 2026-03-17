# 66.2.1 - March 19, 2026

## Added

#### salesforcedx-vscode-services

- Setup vscode-languageclient/browser ([PR #6965](https://github.com/forcedotcom/salesforcedx-vscode/pull/6965))

#### salesforcedx-vscode-apex-testing

- **SFDX: Create Apex Test Suite** and **SFDX: Run Apex Tests** command now list the tests in the org and not those in the workspace. ([PR #6980](https://github.com/forcedotcom/salesforcedx-vscode/pull/6980))

#### salesforcedx-apex-log

- Modify the LogLevel on a TraceFlag for yourself or another user ([PR #6987](https://github.com/forcedotcom/salesforcedx-vscode/pull/6987))

#### salesforcedx-vscode-soql

- New command "SFDX: Create SOQL Query" ([PR #6996](https://github.com/forcedotcom/salesforcedx-vscode/pull/6996))

- We updated the **SFDX: Create Query in SOQL Builder** command to ask for the filename before creating instead of defaulting to the unsaved file **untitled.soql**, which users have to save manually. This makes the command consistent with all the other create commands. ([PR #6981](https://github.com/forcedotcom/salesforcedx-vscode/pull/6981))

- We made some changes under the hood. ([PR #6965](https://github.com/forcedotcom/salesforcedx-vscode/pull/6965))

## Fixed

#### salesforcedx-vscode-soql

- Preserve SELECT column order in SOQL query output when fields have null values ([PR #6995](https://github.com/forcedotcom/salesforcedx-vscode/pull/6995))

- When executing a SOQL query, the row count is now shown at the bottom of the Output Tab instead of at the top. Thank you [@cnaccio](https://github.com/cnaccio) for pointing it out. ([PR #6975](https://github.com/forcedotcom/salesforcedx-vscode/pull/6975))
