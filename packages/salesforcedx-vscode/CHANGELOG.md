# 65.9.1 - December 19, 2025

## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue where code coverage highlights were not applied when navigating between Apex files. Coverage decorations now appear automatically when switching files, as long as Highlight Apex Code Coverage is enabled. ([PR #6721](https://github.com/forcedotcom/salesforcedx-vscode/pull/6721))

#### salesforcedx-vscode-apex-testing

- We fixed an issue where the test panel did not automatically populate local Apex tests when opened. The test view now refreshes on activation and provides clearer feedback when the Apex Language Server is not ready, improving reliability and overall usability. ([PR #6722](https://github.com/forcedotcom/salesforcedx-vscode/pull/6722))

#### salesforcedx-vscode-org

- We fixed an issue where org state was not refreshed after login, logout, or delete operations. You no longer need to reload the VS Code window after authorizing a Dev Hub before creating a scratch org- the extension now immediately reflects the latest org information. ([PR #6720](https://github.com/forcedotcom/salesforcedx-vscode/pull/6720))

#### salesforcedx-utils-vscode

- We made some changes under the hood. ([PR #6712](https://github.com/forcedotcom/salesforcedx-vscode/pull/6712))
