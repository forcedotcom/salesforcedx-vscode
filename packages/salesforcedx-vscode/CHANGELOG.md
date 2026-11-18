# 68.14.1 - November 25, 2026

## Added

#### salesforcedx-vscode-metadata

- We added the **Vue Internal App** template to **SFDX: Create Project**. The command now loads project templates from `@salesforce/templates`, so new templates appear without a hard-coded list update. ([PR #8561](https://github.com/forcedotcom/salesforcedx-vscode/pull/8561))

## Changed

#### salesforcedx-vscode-services

- We improved **Org Browser** remote tracking so large orgs compare and refresh much faster. ([PR #8628](https://github.com/forcedotcom/salesforcedx-vscode/pull/8628))

## Fixed

#### salesforcedx-vscode-services

- We fixed a bug where **Org Browser** skipped Classic email folders when discovering email templates. ([PR #8623](https://github.com/forcedotcom/salesforcedx-vscode/pull/8623))

- We fixed a bug where refreshed authentication tokens could be lost after the computer resumed from sleep. ([PR #8637](https://github.com/forcedotcom/salesforcedx-vscode/pull/8637), [ISSUE #8439](https://github.com/forcedotcom/salesforcedx-vscode/issues/8439))

- We fixed web filesystem file discovery and event buffering, restoring custom LWC component indexing, autocomplete, and hover and preventing file events from being lost during persistence. ([PR #8637](https://github.com/forcedotcom/salesforcedx-vscode/pull/8637))

## Under the Hood

- We made some under the hood changes. ([PR #8537](https://github.com/forcedotcom/salesforcedx-vscode/pull/8537), [PR #8541](https://github.com/forcedotcom/salesforcedx-vscode/pull/8541), [PR #8591](https://github.com/forcedotcom/salesforcedx-vscode/pull/8591), [PR #8592](https://github.com/forcedotcom/salesforcedx-vscode/pull/8592), [PR #8624](https://github.com/forcedotcom/salesforcedx-vscode/pull/8624))
