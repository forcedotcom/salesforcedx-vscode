# 67.13.3 - August 20, 2026

## Added

#### salesforcedx-vscode-apex

- **SFDX: Create Apex Class** and **SFDX: Create Apex Trigger** now support custom templates. The template list for **SFDX: Create Apex Class** is now populated dynamically, **SFDX: Create Apex Trigger** prompts you for the sObject and trigger events up front, and the separate **SFDX: Create Apex Unit Test Class** command has been folded into **SFDX: Create Apex Class**. ([PR #7960](https://github.com/forcedotcom/salesforcedx-vscode/pull/7960))

## Fixed

#### salesforcedx-vscode-apex

- We fixed a bug where opening a `.cls` file in a non-Salesforce workspace could start the Apex language server and create `.sfdx/tools/*` files. The Apex language server now starts only in Salesforce projects. ([PR #7976](https://github.com/forcedotcom/salesforcedx-vscode/pull/7976), [ISSUE #7886](https://github.com/forcedotcom/salesforcedx-vscode/issues/7886))

#### salesforcedx-vscode-apex-testing

- We fixed a bug where opening a local Apex class or method from the **Apex Test Explorer** failed in Web Console. Apex Testing now preserves the workspace URI scheme (such as `memfs:`), so navigation works in the browser. ([PR #7999](https://github.com/forcedotcom/salesforcedx-vscode/pull/7999))

#### salesforcedx-vscode-core

- We fixed a bug where `xml.preferences.showSchemaDocumentationType` was rewritten to `none` in your workspace settings on every activation, suppressing hover documentation in all XML files. We now respect an existing value, and added the **salesforcedx-vscode-core.metadata.doNotSuppressRedhatSchemaDocumentation** setting (default `false`) to always leave the preference untouched. ([PR #7983](https://github.com/forcedotcom/salesforcedx-vscode/pull/7983), [ISSUE #7967](https://github.com/forcedotcom/salesforcedx-vscode/issues/7967))

#### salesforcedx-vscode-org-browser

- We fixed a bug where the Org Browser's **Retrieve Metadata**, **Org Browser: Refresh Type**, and **Org Browser: Collapse All** commands appeared in the command palette even outside a Salesforce project. ([PR #7987](https://github.com/forcedotcom/salesforcedx-vscode/pull/7987))

- We fixed a bug where the **Org Browser** showed no values for the **StandardValueSet** metadata type. It now populates the list from `@salesforce/source-deploy-retrieve` instead of querying the org. ([PR #8006](https://github.com/forcedotcom/salesforcedx-vscode/pull/8006))

#### salesforcedx-vscode-services

- We stopped scaffolding `.prettierrc` and `.prettierignore` into new Web Console projects, since Prettier isn't bundled with Web Console. Desktop project generation is unaffected. ([PR #8013](https://github.com/forcedotcom/salesforcedx-vscode/pull/8013))

## Under the Hood

- We made some under the hood changes. ([PR #7975](https://github.com/forcedotcom/salesforcedx-vscode/pull/7975), [PR #7981](https://github.com/forcedotcom/salesforcedx-vscode/pull/7981), [PR #8012](https://github.com/forcedotcom/salesforcedx-vscode/pull/8012))
