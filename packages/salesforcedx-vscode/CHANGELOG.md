# 64.12.0 - September 3, 2025

## Added

#### salesforcedx-vscode-core

- We refactored the org cleanup logic to ensure expired or deleted orgs are properly removed. The update also adds clearer user feedback through detailed messages and a table view of the remaining orgs. ([PR #6500](https://github.com/forcedotcom/salesforcedx-vscode/pull/6500))

- We improved the bundling of our extensions to reduce the extensions size. ([PR #6490](https://github.com/forcedotcom/salesforcedx-vscode/pull/6490))

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue where org aliases that contain dashes couldn't be set as default orgs. ([PR #6521](https://github.com/forcedotcom/salesforcedx-vscode/pull/6521))

- We fixed an issue where deploy and retrieve were failing when the `Enable Source Tracking For Deploy And Retrieve` setting was enabled for non-source-tracked orgs. ([PR #6507](https://github.com/forcedotcom/salesforcedx-vscode/pull/6507))
