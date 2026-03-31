# 66.4.2 - April 2, 2026

## Added

#### salesforcedx-aura-language-server

#### salesforcedx-lightning-lsp-common

#### salesforcedx-lwc-language-server

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We replaced LWC and Aura server-ready popup notifications with a shared custom ready notification and in-editor language status items. ([PR #7054](https://github.com/forcedotcom/salesforcedx-vscode/pull/7054))

#### salesforcedx-vscode-core

- We added `defaultLwcLanguage` as a valid key to the sfdx-project.json schema. ([PR #7109](https://github.com/forcedotcom/salesforcedx-vscode/pull/7109))

- We renamed `WebApplication` to `UiBundle` for the **React External App** and **React Internal App** templates in **SFDX: Create Project**. ([PR #7100](https://github.com/forcedotcom/salesforcedx-vscode/pull/7100))

#### salesforcedx-vscode-expanded

- We added the **Salesforce Live Preview** extension to the Salesforce Extension Pack (Expanded), enabling developers to preview Lightning Web Components directly in VS Code with live updates on save. ([PR #7058](https://github.com/forcedotcom/salesforcedx-vscode/pull/7058))

#### salesforcedx-vscode-soql

- We added a "Run Query" code lens in `.soql` files and a new command **SFDX: Execute SOQL Query with Current File** in the command palette; the previous **SFDX: Execute SOQL Query...** command has been removed. ([PR #7089](https://github.com/forcedotcom/salesforcedx-vscode/pull/7089))

- We added a "Get Query Plan" button to the SOQL Builder UI. ([PR #7094](https://github.com/forcedotcom/salesforcedx-vscode/pull/7094))

## Fixed

#### salesforcedx-lightning-lsp-common

- We fixed a bug where `jsconfig.json` files were repeatedly modified with duplicate lines on VS Code startup. ([PR #7087](https://github.com/forcedotcom/salesforcedx-vscode/pull/7087), [ISSUE #7084](https://github.com/forcedotcom/salesforcedx-vscode/issues/7084))

#### salesforcedx-aura-language-server

#### salesforcedx-lwc-language-server

#### salesforcedx-vscode-lwc

- We fixed a bug where changes to `CustomLabels.labels-meta.xml` were not reflected in `.sfdx/typings/lwc/customlabels.d.ts`. ([PR #7065](https://github.com/forcedotcom/salesforcedx-vscode/pull/7065))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #7107](https://github.com/forcedotcom/salesforcedx-vscode/pull/7107))

- We fixed a bug where source path-based deploy/retrieve ignored the `sourceApiVersion` set in sfdx-project.json. ([PR #7106](https://github.com/forcedotcom/salesforcedx-vscode/pull/7106))

- We fixed a bug where `_` in Apex test method names were incorrectly rendered as `\_`. ([PR #7091](https://github.com/forcedotcom/salesforcedx-vscode/pull/7091), [ISSUE #7075](https://github.com/forcedotcom/salesforcedx-vscode/issues/7075))

- We fixed a bug where the `.sfdx` folder could be created outside a Salesforce project during extension startup. ([PR #7095](https://github.com/forcedotcom/salesforcedx-vscode/pull/7095))
