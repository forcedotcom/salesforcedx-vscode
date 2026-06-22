# 67.2.0 - June 24, 2026

## Added

#### salesforcedx-vscode

- We added **Agentforce Vibes Autocomplete** (salesforce.agentforce-vibes-autocomplete) to both the standard and Expanded Salesforce Extension Packs, so you can install it from either pack. ([PR #7499](https://github.com/forcedotcom/salesforcedx-vscode/pull/7499))

#### salesforcedx-vscode-apex-oas

- We added a new **Enable REST OAS Gen** setting (`salesforcedx-vscode-apex-oas.enableRestOASGen`, off by default) and decoupled REST OpenAPI document generation from the Agentforce for Developers extension. Generation now shows a progress notification and clearer error messages. ([PR #7465](https://github.com/forcedotcom/salesforcedx-vscode/pull/7465))

## Fixed

#### salesforcedx-vscode-apex

- We fixed a bug where the extension could freeze VS Code for 20-30 seconds at startup on Windows while checking for orphaned language server processes. ([PR #7508](https://github.com/forcedotcom/salesforcedx-vscode/pull/7508), [ISSUE #7461](https://github.com/forcedotcom/salesforcedx-vscode/issues/7461))

#### salesforcedx-vscode-services

- We fixed a bug where Web Console showed **Untitled (Workspace)** instead of the project name, and we made creating a project in the web significantly faster. ([PR #7484](https://github.com/forcedotcom/salesforcedx-vscode/pull/7484))

## Under the Hood

- We made some changes under the hood. ([PR #7463](https://github.com/forcedotcom/salesforcedx-vscode/pull/7463), [PR #7487](https://github.com/forcedotcom/salesforcedx-vscode/pull/7487), [PR #7489](https://github.com/forcedotcom/salesforcedx-vscode/pull/7489))

