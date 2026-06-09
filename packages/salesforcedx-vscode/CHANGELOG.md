# 66.15.0 - June 10, 2026

## Added

#### salesforcedx-vscode-metadata

- We rewrote the **SFDX: Install Package** command to use the Tooling API directly, so it now works in Web Console without the Salesforce CLI. The command also shows cancellable progress while the install request is polling. ([PR #7369](https://github.com/forcedotcom/salesforcedx-vscode/pull/7369))

## Changed

#### salesforcedx-vscode-lwc

- You can now rename a Lightning Web Component in Web Console. ([PR #7371](https://github.com/forcedotcom/salesforcedx-vscode/pull/7371))

## Fixed

#### salesforcedx-vscode-apex-log

- We reduced the number of API calls used to query information related to trace flags. ([PR #7391](https://github.com/forcedotcom/salesforcedx-vscode/pull/7391))

#### salesforcedx-vscode-lwc

- You can create a Lightning Web Component from the Explorer context menu, not only the Command Palette. Thanks to [@vsdragon626](https://github.com/vsdragon626) for the contribution! ([PR #7392](https://github.com/forcedotcom/salesforcedx-vscode/pull/7392))
