# 68.3.1 - October 21, 2026

## Fixed

#### salesforcedx-vscode-apex-testing

- We fixed a bug where the **Debug** run profile for Apex tests appeared in VS Code on the web even though debugging is not supported there. ([PR #8437](https://github.com/forcedotcom/salesforcedx-vscode/pull/8437))

#### salesforcedx-vscode-org-browser

- We fixed a bug where plain-text search in **Org Browser** missed partial metadata type and component names. Typing `broker` now matches names like `Broker__c` without regex. ([PR #8365](https://github.com/forcedotcom/salesforcedx-vscode/pull/8365), [DISCUSSION #5376](https://github.com/forcedotcom/salesforcedx-vscode/discussions/5376))

#### salesforcedx-vscode-soql

- We fixed a bug where **SFDX: Execute SOQL Query with Currently Selected Text** and **SFDX: Get SOQL Query Plan with Currently Selected Text** appeared in non-Apex files. They now only appear in `.cls`, `.apex`, and `.trigger` files. ([PR #8426](https://github.com/forcedotcom/salesforcedx-vscode/pull/8426))

## Under the Hood

- We made some under the hood changes. ([PR #8419](https://github.com/forcedotcom/salesforcedx-vscode/pull/8419))
