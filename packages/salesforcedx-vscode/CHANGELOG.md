# 65.12.1 - January 9, 2026

## Added

#### salesforcedx-aura-language-server
#### salesforcedx-lightning-lsp-common
#### salesforcedx-lwc-language-server

- Refactored lightning-language-server over to the mono repo for maintainability. Removed node:fs and direct fs calls from lightning-language-server in favor of async loading of file system data to server. ([PR #6620](https://github.com/forcedotcom/salesforcedx-vscode/pull/6620), ([PR #6658](https://github.com/forcedotcom/salesforcedx-vscode/pull/6658)), ([PR #6666](https://github.com/forcedotcom/salesforcedx-vscode/pull/6666)), ([PR #6711](https://github.com/forcedotcom/salesforcedx-vscode/pull/6711))
- Added user experience popups and hover documentation to communnicate the delayed start. ([PR #6723](https://github.com/forcedotcom/salesforcedx-vscode/pull/6723))

#### salesforcedx-vscode-apex-testing

- New apex test controller: a new Test Explorer UI, updating configuration settings, and improving test suite management and discovery. ([PR #6704](https://github.com/forcedotcom/salesforcedx-vscode/pull/6704))

#### salesforcedx-vscode-core

- Scrape Metadata API Developer Guide metadata types for metadata XML hover documentation using Playwright + GHA workflow to do this once per week ([PR #6675](https://github.com/forcedotcom/salesforcedx-vscode/pull/6675))

- Move stop debugger and bootstrap cmd to the apex debugger extension ([PR #6727](https://github.com/forcedotcom/salesforcedx-vscode/pull/6727))

- [W-20777516] refactor: move SFDX: Execute SOQL Query... and SFDX: Execute SOQL Query with Currently Selected Text from CLI Integration extension to SOQL extension ([PR #6747](https://github.com/forcedotcom/salesforcedx-vscode/pull/6747))


