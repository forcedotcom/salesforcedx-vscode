# 66.1.1 - March 12, 2026

## Added

#### salesforcedx-vscode-core

- We added a progress indicator to SFDX:Refresh SObjects command & refactored it to use shared services, improving performance and consistency. ([PR #6925](https://github.com/forcedotcom/salesforcedx-vscode/pull/6925))

#### salesforcedx-vscode-org

- Verification code now appear when authorizing an org or Dev Hub in the Agentforce Vibes IDE. ([PR #6945](https://github.com/forcedotcom/salesforcedx-vscode/pull/6945))

## Fixed

#### docs

- We made some changes under the hood. ([PR #6963](https://github.com/forcedotcom/salesforcedx-vscode/pull/6963))

#### salesforcedx-lwc-language-server
#### salesforcedx-vscode-apex-testing
#### salesforcedx-vscode-org-browser
#### salesforcedx-vscode-services

- Fixed issues with Apex Testing in web-based VS Code environments (such as vscode.dev) and improved file discovery for more reliable test execution across web and desktop. ([PR #6930](https://github.com/forcedotcom/salesforcedx-vscode/pull/6930))

#### salesforcedx-vscode-core

- We fixed a missing label error that was appearing when running **SFDX: Create Lightning Web Component**. ([PR #6948](https://github.com/forcedotcom/salesforcedx-vscode/pull/6948))

#### salesforcedx-vscode-lightning
#### salesforcedx-vscode-lwc
#### salesforcedx-lightning-lsp-common

- We fixed a behavior where files written to by language server were opened in the user's IDE ([PR #6946](https://github.com/forcedotcom/salesforcedx-vscode/pull/6946))

