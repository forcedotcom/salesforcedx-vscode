# 65.15.1 - January 28, 2026

## Added

#### salesforcedx-vscode-apex-testing
#### salesforcedx-vscode-services

-   We modernized the Apex testing extension to improve modularity and prepare it for browser-based (web) environments. This update removes legacy dependencies, streamlines configuration and activation behavior, and introduces a new setting to control retrieval of Apex test code coverage results. These changes improve maintainability today and enable broader platform support going forward. ([PR #6774](https://github.com/forcedotcom/salesforcedx-vscode/pull/6774))


## Fixed

#### salesforcedx-aura-language-server

- We added a preventative check so the server doesn’t log errors before it’s ready to process requests. ([PR #6786](https://github.com/forcedotcom/salesforcedx-vscode/pull/6786))

#### salesforcedx-vscode-apex-testing

- We fixed an issue where the `test-run-concise` option displayed both passing and failing test results instead of only failures. ([PR #6794](https://github.com/forcedotcom/salesforcedx-vscode/pull/6794))

#### salesforcedx-vscode-core

- We fixed a reauthorization issue that would leave users stuck after an org session timed out. Required extensions now activate automatically, and clicking Login correctly opens the reauthorization flow in a new tab. ([PR #6797](https://github.com/forcedotcom/salesforcedx-vscode/pull/6797))

- We fixed an issue where `SFDX: Delete This from Project and Org` incorrectly reported project-wide conflicts. The command now properly isolates conflict detection to the specific file being deleted. Thank you [Nicky Torstensson](https://github.com/nickytorstensson) for submitting this issue. ([PR #6798](https://github.com/forcedotcom/salesforcedx-vscode/pull/6798))

#### salesforcedx-vscode-org

- We fixed a regression where leaving the org alias input blank during authorization resulted in an empty alias instead of defaulting to `vscodeOrg`. ([PR #6780](https://github.com/forcedotcom/salesforcedx-vscode/pull/6780))

#### salesforcedx-vscode-services

- We removed the hardcoded theme, ensuring the UI now adapts correctly to user-selected and system themes. ([PR #6776](https://github.com/forcedotcom/salesforcedx-vscode/pull/6776))

