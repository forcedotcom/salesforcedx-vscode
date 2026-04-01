# 66.4.4 - April 2, 2026

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

- We moved the following commands to the **Apex Log** extension:
  1. SFDX: Create Apex Class
  2. SFDX: Create Apex Unit Test Class
  3. SFDX: Create Apex Trigger
     ([PR #7028](https://github.com/forcedotcom/salesforcedx-vscode/pull/7028))

#### salesforcedx-vscode-expanded

- We added the **Salesforce Live Preview** (salesforce.salesforcedx-vscode-ui-preview) extension to the Salesforce Extension Pack (Expanded), enabling developers to preview Lightning Web Components directly in VS Code with live updates on save. ([PR #7058](https://github.com/forcedotcom/salesforcedx-vscode/pull/7058))

- We added the **GraphQL Syntax Highlighting** (GraphQL.vscode-graphql-syntax) extension to the Salesforce Extension Pack (Expanded) to provide syntax highlighting for GraphQL files. ([PR #7114](https://github.com/forcedotcom/salesforcedx-vscode/pull/7114))

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

- We fixed a bug where source path-based deploy/retrieve ignored the `sourceApiVersion` set in sfdx-project.json. ([PR #7106](https://github.com/forcedotcom/salesforcedx-vscode/pull/7106), [PR #7116](https://github.com/forcedotcom/salesforcedx-vscode/pull/7116))

- We fixed a bug where `_` in Apex test method names were incorrectly rendered as `\_`. ([PR #7091](https://github.com/forcedotcom/salesforcedx-vscode/pull/7091), [ISSUE #7075](https://github.com/forcedotcom/salesforcedx-vscode/issues/7075))

- We fixed a bug where the `.sfdx` folder could be created outside a Salesforce project during extension startup. ([PR #7095](https://github.com/forcedotcom/salesforcedx-vscode/pull/7095))

- The CLI Integration extension now sets `"xml.server.vmargs": "-Xmx1024M"` in the User settings.json if the value is absent or smaller, preventing Out of Memory errors when loading metadata XML hover documentation. ([PR #7115](https://github.com/forcedotcom/salesforcedx-vscode/pull/7115))

#### salesforcedx-vscode-apex

- We fixed a bug where `.soql` files were detected as language Apex instead of SOQL on Windows. ([PR #7117](https://github.com/forcedotcom/salesforcedx-vscode/pull/7117))

- We reverted the defensive Apex Language Server shutdown handling that was causing slowdowns when reloading, closing, or switching VS Code workspaces. ([PR #7119](https://github.com/forcedotcom/salesforcedx-vscode/pull/7119))

#### salesforcedx-vscode-org

- The soon-to-expire scratch orgs list in the Output tab now shows each org's alias and username. ([PR #7118](https://github.com/forcedotcom/salesforcedx-vscode/pull/7118))
