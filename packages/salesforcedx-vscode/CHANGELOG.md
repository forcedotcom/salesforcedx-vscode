# 64.12.0 - September 3, 2025

## Added

#### salesforcedx-vscode-core

- We introduced significant improvements to the org cleanup and display functionality in the CLI Integration extension. The main changes involve refactoring the org list clean command to fix a bug to actually remove expired or deleted orgs while providing user feedback with detailed messages and a table display of remaining orgs. ([PR #6500](https://github.com/forcedotcom/salesforcedx-vscode/pull/6500))

- We improved the bundling of our extensions to reduce the extensions size. ([PR #6490](https://github.com/forcedotcom/salesforcedx-vscode/pull/6490))

## Fixed

#### salesforcedx-vscode-core

- We fixed a bug where org aliases that contain dashes could not be set as default orgs. ([PR #6521](https://github.com/forcedotcom/salesforcedx-vscode/pull/6521))

- We fixed a bug where deploy and retrieve was failing when enable source tracking for deploy and retrieve setting was enabled for non source tracked orgs. ([PR #6507](https://github.com/forcedotcom/salesforcedx-vscode/pull/6507))
