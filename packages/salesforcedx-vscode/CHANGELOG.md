# 65.17.2 - February 12, 2026

## Added

#### salesforcedx-vscode-core

- Write about Metadata operations on the web here.  ([PR #6662](https://github.com/forcedotcom/salesforcedx-vscode/pull/6662))
- We made some changes under the hood. ([PR #6841](https://github.com/forcedotcom/salesforcedx-vscode/pull/6841))

## Fixed

#### salesforcedx-lwc-language-server

- Resolved an issue where the Aura Language Server repeatedly opened and modified customlabels.d.ts in the editor, causing flickering and preventing the file from being closed. The language server no longer forces files open during startup. Thank you [Justin Lyon](https://github.com/justin-lyon) for creating this [issue](https://github.com/forcedotcom/salesforcedx-vscode/issues/6827). ([PR #6832](https://github.com/forcedotcom/salesforcedx-vscode/pull/6832))

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-apex-replay-debugger

#### salesforcedx-vscode-apex-testing

- Running All Tests from the Test Controller now works reliably in large orgs, test results are correctly cleared when switching orgs, and users receive clearer feedback when running empty Apex Test Suites. We also fixed Apex test discovery pagination issues and significantly improved Test Explorer performance when loading large numbers of tests, making the experience faster, more responsive, and easier to trust. A new filter tag, `@sf.apex.testController:in-workspace`, has also been added to make it easy to show only Apex tests that exist in the current project. ([PR #6842](https://github.com/forcedotcom/salesforcedx-vscode/pull/6842))

#### salesforcedx-vscode-core

- We resolved a regression where the default org was not correctly shown in the org picker when only the CLI Integration and Org Management extensions were installed. The org picker now immediately reflects the default org defined in `sfdx-config.json`, without requiring users to manually save the file. ([PR #6837](https://github.com/forcedotcom/salesforcedx-vscode/pull/6837))

#### salesforcedx-vscode-lightning

- We made some changes under the hood. ([PR #6840](https://github.com/forcedotcom/salesforcedx-vscode/pull/6840))

