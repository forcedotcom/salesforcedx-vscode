# 65.3.1 - November 6, 2025

## Added

#### salesforcedx-vscode
#### salesforcedx-vscode-apex
#### salesforcedx-vscode-apex-oas
#### salesforcedx-vscode-automation-tests
#### salesforcedx-vscode-expanded

- We’ve launched a brand-new VS Code extension, salesforcedx-vscode-apex-oas, bringing OpenAPI Specification (OAS) generation and validation to `Apex REST` and `@AuraEnabled` classes. This release includes full packaging, configuration, and workspace integration for easier development and debugging—plus supporting refactors and improved dependency management to keep things running smoothly. ([PR #6601](https://github.com/forcedotcom/salesforcedx-vscode/pull/6601))

#### salesforcedx-vscode-core

- We added an experimental, web- and desktop-compatible Org Browser (behind a new config flag, default false). This update also ships the new Services extension for runtime use by other extensions. ([PR #6613](https://github.com/forcedotcom/salesforcedx-vscode/pull/6613))


## Fixed

#### salesforcedx-vscode-lwc

- We added CodeLens support for describe blocks in LWC tests. The CodeLens appears only when the Jest Runner extension isn’t installed or active, preventing duplicate test run options. ([PR #6594](https://github.com/forcedotcom/salesforcedx-vscode/pull/6594))

#### salesforcedx-vscode-apex
#### salesforcedx-vscode-core
#### salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #6626](https://github.com/forcedotcom/salesforcedx-vscode/pull/6626)),([PR #6610](https://github.com/forcedotcom/salesforcedx-vscode/pull/6610)), ([PR #6619](https://github.com/forcedotcom/salesforcedx-vscode/pull/6619)),([PR #6625](https://github.com/forcedotcom/salesforcedx-vscode/pull/6625))



