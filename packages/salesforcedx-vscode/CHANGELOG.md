# 65.12.1 - January 9, 2026

## Added

#### salesforcedx-aura-language-server
#### salesforcedx-lightning-lsp-common
#### salesforcedx-lwc-language-server

- We refactored the Lightning language server into the monorepo to improve long-term maintainability. 
- We removed `node:fs` and direct file system calls from the lightning-language-server in favor of asynchronously loading filesystem data into the server. ([PR #6620](https://github.com/forcedotcom/salesforcedx-vscode/pull/6620), ([PR #6658](https://github.com/forcedotcom/salesforcedx-vscode/pull/6658)), ([PR #6666](https://github.com/forcedotcom/salesforcedx-vscode/pull/6666)), ([PR #6711](https://github.com/forcedotcom/salesforcedx-vscode/pull/6711))
- We added UX popups and hover text to clearly communicate the delayed server start. ([PR #6723](https://github.com/forcedotcom/salesforcedx-vscode/pull/6723))

#### salesforcedx-vscode-apex-testing

- We introduced a new Apex test controller, including a redesigned Test Explorer UI, updated configuration settings, and improved test suite discovery and management. ([PR #6704](https://github.com/forcedotcom/salesforcedx-vscode/pull/6704))

#### salesforcedx-vscode-core

- We now scrape Metadata API Developer Guide metadata types to power metadata XML hover documentation. This runs weekly using Playwright and a GitHub Actions workflow. ([PR #6675](https://github.com/forcedotcom/salesforcedx-vscode/pull/6675))

- We moved the stop debugger and bootstrap commands into the Apex Debugger extension. ([PR #6727](https://github.com/forcedotcom/salesforcedx-vscode/pull/6727))

- We moved `SFDX: Execute SOQL Query…` and `SFDX: Execute SOQL Query with Currently Selected Text` from the CLI Integration extension to the SOQL extension. ([PR #6747](https://github.com/forcedotcom/salesforcedx-vscode/pull/6747))


