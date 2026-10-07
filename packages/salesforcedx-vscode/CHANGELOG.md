# 67.27.6 - October 14, 2026

## Added

#### salesforcedx-vscode-lightning

- We added support for custom templates in **SFDX: Create Aura Component**, **SFDX: Create Aura App**, **SFDX: Create Aura Event**, and **SFDX: Create Aura Interface**. ([PR #8311](https://github.com/forcedotcom/salesforcedx-vscode/pull/8311))

#### salesforcedx-vscode-lwc

- We added support for custom templates in **SFDX: Create Lightning Web Component**, including up-to-date built-in templates and honoring `defaultLwcLanguage` in `sfdx-project.json`. ([PR #8289](https://github.com/forcedotcom/salesforcedx-vscode/pull/8289))

#### salesforcedx-vscode-visualforce

- We added support for custom templates in **SFDX: Create Visualforce Component** and **SFDX: Create Visualforce Page**. ([PR #8323](https://github.com/forcedotcom/salesforcedx-vscode/pull/8323))

## Fixed

#### salesforcedx-vscode-apex-testing

- We fixed a bug where success toasts with action buttons blocked the caller until the toast was dismissed. Apex test runs in the Testing sidebar now finish and clear the spinner without waiting for **Open Report**. ([PR #8370](https://github.com/forcedotcom/salesforcedx-vscode/pull/8370))

#### salesforcedx-vscode-metadata

- We fixed a bug where right-clicking in the Output panel offered **SFDX: Generate Manifest File** and related source commands that then failed. Those commands now appear only on filesystem files and folders. ([PR #8344](https://github.com/forcedotcom/salesforcedx-vscode/pull/8344))

#### salesforcedx-vscode-soql

- We fixed a bug where **SOQL Builder** **Run Query** failures only appeared in the Output channel and were easy to miss. Failures now also show an error toast. ([PR #8305](https://github.com/forcedotcom/salesforcedx-vscode/pull/8305))

## Under the Hood

- We made some under the hood changes. ([PR #8046](https://github.com/forcedotcom/salesforcedx-vscode/pull/8046), [PR #8139](https://github.com/forcedotcom/salesforcedx-vscode/pull/8139), [PR #8047](https://github.com/forcedotcom/salesforcedx-vscode/pull/8047))
