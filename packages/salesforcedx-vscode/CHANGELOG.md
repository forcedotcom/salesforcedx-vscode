# 67.6.0 - July 22, 2026

## Added

#### salesforcedx-vscode-apex

- We added a new **SFDX: Edit Apex Test Suite** command. A single multi-select picker shows all your test classes with the current suite members pre-checked, so you can add and remove tests in one step. ([PR #7672](https://github.com/forcedotcom/salesforcedx-vscode/pull/7672))

#### salesforcedx-vscode-org-browser

- The Org Browser now has independent **show local** and **show org** toolbar toggles for filtering metadata types, plus a text filter in the type/component quick pick. ([PR #7679](https://github.com/forcedotcom/salesforcedx-vscode/pull/7679))

## Fixed

#### salesforcedx-vscode-apex-testing

- We fixed a bug where discovering Apex tests failed with a 400 error against orgs on API version 68.0 or later. ([PR #7805](https://github.com/forcedotcom/salesforcedx-vscode/pull/7805))

#### salesforcedx-vscode-org

- We fixed a bug where the background "orgs expiring soon" check could steal focus and dismiss an open quick pick, such as the org picker. The warning now offers a **Show Output** button instead of revealing the panel unbidden. ([PR #7749](https://github.com/forcedotcom/salesforcedx-vscode/pull/7749))

#### salesforcedx-vscode-services

- We fixed the **Salesforce Extensions** services package failing to publish on Open VSX, which had left it stuck at an older version. ([PR #7756](https://github.com/forcedotcom/salesforcedx-vscode/pull/7756))

#### salesforcedx-vscode-visualforce

- We fixed a bug where hovering over mixed-case Visualforce tags such as `apex:pageBlock` and `apex:outputField` showed no hover information. ([PR #7781](https://github.com/forcedotcom/salesforcedx-vscode/pull/7781))

## Under the Hood

- We made some under the hood changes. ([PR #7777](https://github.com/forcedotcom/salesforcedx-vscode/pull/7777), [PR #7806](https://github.com/forcedotcom/salesforcedx-vscode/pull/7806), [PR #7778](https://github.com/forcedotcom/salesforcedx-vscode/pull/7778), [PR #7753](https://github.com/forcedotcom/salesforcedx-vscode/pull/7753), [PR #7746](https://github.com/forcedotcom/salesforcedx-vscode/pull/7746))
