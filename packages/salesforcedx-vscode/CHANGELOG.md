# 67.7.1 - July 29, 2026

## Added

#### salesforcedx-vscode-core

- We added support for Japanese localization. If your VS Code display language is set to Japanese, you'll now see Japanese translations in the Salesforce extensions. ([PR #7803](https://github.com/forcedotcom/salesforcedx-vscode/pull/7803))

#### salesforcedx-vscode-metadata

- When you run **SFDX: Create Project**, you can now select **Angular** as a framework option for Experience Cloud sites. ([PR #7864](https://github.com/forcedotcom/salesforcedx-vscode/pull/7864))

## Fixed

#### salesforcedx-vscode-apex-debugger

- We fixed a bug where **SFDX: Stop Apex Debugger Session** showed a "No target org configured" error instead of stopping the current ISV Debugger session. ([PR #7815](https://github.com/forcedotcom/salesforcedx-vscode/pull/7815))

#### salesforcedx-vscode-apex-testing

- When you delete an Apex test suite with **SFDX: Delete Apex Test Suite**, the suite now correctly disappears from the **Testing** sidebar. ([PR #7661](https://github.com/forcedotcom/salesforcedx-vscode/pull/7661))

- We fixed a bug in **SFDX: Edit Apex Test Suite** where test classes with namespaces weren't being correctly selected when editing an existing suite. ([PR #7831](https://github.com/forcedotcom/salesforcedx-vscode/pull/7831))

#### salesforcedx-vscode-lwc

- When Jest fails to run tests due to module resolution errors or syntax errors, the **Test Results** panel now displays the actual error message instead of "test case did not report any output". ([PR #7845](https://github.com/forcedotcom/salesforcedx-vscode/pull/7845), [ISSUE #7788](https://github.com/forcedotcom/salesforcedx-vscode/issues/7788))

#### salesforcedx-vscode-org

- You can now use hyphens in org aliases when authorizing orgs or creating scratch orgs (for example, `my-scratch-org`). ([PR #7866](https://github.com/forcedotcom/salesforcedx-vscode/pull/7866), [ISSUE #7794](https://github.com/forcedotcom/salesforcedx-vscode/issues/7794))

## Under the Hood

- We made some under the hood changes. ([PR #7659](https://github.com/forcedotcom/salesforcedx-vscode/pull/7659), [PR #7797](https://github.com/forcedotcom/salesforcedx-vscode/pull/7797), [PR #7810](https://github.com/forcedotcom/salesforcedx-vscode/pull/7810), [PR #7822](https://github.com/forcedotcom/salesforcedx-vscode/pull/7822), [PR #7856](https://github.com/forcedotcom/salesforcedx-vscode/pull/7856), [PR #7862](https://github.com/forcedotcom/salesforcedx-vscode/pull/7862), [PR #7876](https://github.com/forcedotcom/salesforcedx-vscode/pull/7876), [PR #7883](https://github.com/forcedotcom/salesforcedx-vscode/pull/7883), [PR #7893](https://github.com/forcedotcom/salesforcedx-vscode/pull/7893), [PR #7898](https://github.com/forcedotcom/salesforcedx-vscode/pull/7898))

