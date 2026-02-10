# 65.17.2 - February 12, 2026

## Added

#### docs

- Metadata operations on the web W-20175985 ([PR #6662](https://github.com/forcedotcom/salesforcedx-vscode/pull/6662))

#### salesforcedx-vscode-core

- Remove taskView W-21197769 ([PR #6841](https://github.com/forcedotcom/salesforcedx-vscode/pull/6841))

- Metadata operations on the web W-20175985 ([PR #6662](https://github.com/forcedotcom/salesforcedx-vscode/pull/6662))

## Fixed

#### salesforcedx-lwc-language-server

- W-21180077 -  prevent typing files from being overwritten multiple times by language server ([PR #6832](https://github.com/forcedotcom/salesforcedx-vscode/pull/6832))

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-apex-replay-debugger

#### salesforcedx-vscode-apex-testing

- Running All Tests from the Test Controller now works reliably in large orgs, test results are correctly cleared when switching orgs, and users receive clearer feedback when running empty Apex Test Suites. We also fixed Apex test discovery pagination issues and significantly improved Test Explorer performance when loading large numbers of tests, making the experience faster, more responsive, and easier to trust. A new filter tag, `@sf.apex.testController:in-workspace`, has also been added to make it easy to show only Apex tests that exist in the current project. ([PR #6842](https://github.com/forcedotcom/salesforcedx-vscode/pull/6842))

#### salesforcedx-vscode-core

- [W-21190281]  CLI Integration extension initializes default org after activation ([PR #6837](https://github.com/forcedotcom/salesforcedx-vscode/pull/6837))

#### salesforcedx-vscode-lightning

- Use node fs instead of cp ([PR #6840](https://github.com/forcedotcom/salesforcedx-vscode/pull/6840))

