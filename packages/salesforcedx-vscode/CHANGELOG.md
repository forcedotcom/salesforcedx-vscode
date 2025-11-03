# 65.3.0 - November 5, 2025

This release streamlines OAS command management by moving all OAS functionality into a dedicated extension, impacting several packages for improved maintainability and clarity. A variety of bug fixes deliver smoother developer experiences, including improved syntax highlighting for Apex and SOQL, metadata file correction, and smarter LWC test code lenses that adapt to your setup.

## Added

#### salesforcedx-vscode

- [W-19477474]  move OAS commands to its own extension ([PR #6601](https://github.com/forcedotcom/salesforcedx-vscode/pull/6601))

#### salesforcedx-vscode-apex

- [W-19477474]  move OAS commands to its own extension ([PR #6601](https://github.com/forcedotcom/salesforcedx-vscode/pull/6601))

#### salesforcedx-vscode-apex-oas

- [W-19477474]  move OAS commands to its own extension ([PR #6601](https://github.com/forcedotcom/salesforcedx-vscode/pull/6601))

#### salesforcedx-vscode-automation-tests

- [W-19477474]  move OAS commands to its own extension ([PR #6601](https://github.com/forcedotcom/salesforcedx-vscode/pull/6601))

#### salesforcedx-vscode-core

- Web-compatible org browser W-19881349 ([PR #6613](https://github.com/forcedotcom/salesforcedx-vscode/pull/6613))

#### salesforcedx-vscode-expanded

- [W-19477474]  move OAS commands to its own extension ([PR #6601](https://github.com/forcedotcom/salesforcedx-vscode/pull/6601))

## Fixed

#### salesforcedx-vscode-apex

- [@W-20049217@] bump tm-language for grammar improvement ([PR #6610](https://github.com/forcedotcom/salesforcedx-vscode/pull/6610))

#### salesforcedx-vscode-core

- * adding missing closing tag in salesforce_metadata_api_clean.xsd ([PR #6625](https://github.com/forcedotcom/salesforcedx-vscode/pull/6625))

#### salesforcedx-vscode-lwc

- [W-15666391]  LWC tests code lens are present for describe blocks + only appear if Jest Runner extension is not present ([PR #6594](https://github.com/forcedotcom/salesforcedx-vscode/pull/6594))

#### salesforcedx-vscode-soql

- [@W-20049217@] bump tm-language for grammar improvement ([PR #6610](https://github.com/forcedotcom/salesforcedx-vscode/pull/6610))
