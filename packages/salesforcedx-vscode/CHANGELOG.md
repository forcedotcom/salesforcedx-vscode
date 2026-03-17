# 66.2.1 - March 19, 2026

## Added

#### salesforcedx-vscode-apex-testing

- **SFDX: Create Apex Test Suite** and **SFDX: Run Apex Tests** commands now list the tests in the org and not those in the workspace. ([PR #6980](https://github.com/forcedotcom/salesforcedx-vscode/pull/6980))

#### salesforcedx-apex-log

- You the **SFDX: Change Trace Flag Debug Level** command to modify the LogLevel on `TraceFlag` for yourself or another user ([PR #6987](https://github.com/forcedotcom/salesforcedx-vscode/pull/6987))

#### salesforcedx-vscode-services

#### salesforcedx-vscode-soql

- We added a new **SFDX: Create SOQL Query** command that allows users to create a SOQL query, and open it directly in the text editor view. ([PR #6996](https://github.com/forcedotcom/salesforcedx-vscode/pull/6996))

- We updated the **SFDX: Create Query in SOQL Builder** command to prompt for a filename before creating the file, instead of defaulting to an unsaved `untitled.soql` file. This aligns the experience with other create commands and removes the need to save manually.([PR #6981](https://github.com/forcedotcom/salesforcedx-vscode/pull/6981))

- We made some changes under the hood. ([PR #6965](https://github.com/forcedotcom/salesforcedx-vscode/pull/6965))

## Fixed

#### salesforcedx-vscode-soql

- We fixed a bug in the display of the SOQL query execution results table that was causing columns in the Output tab to be displayed out of order when the first entries had null value. ([PR #6995](https://github.com/forcedotcom/salesforcedx-vscode/pull/6995))

- When executing a SOQL query, the row count is now shown at the bottom of the Output Tab instead of at the top. Thank you [@cnaccio](https://github.com/cnaccio) for pointing it out. ([PR #6975](https://github.com/forcedotcom/salesforcedx-vscode/pull/6975))
