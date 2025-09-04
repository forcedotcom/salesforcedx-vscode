# 64.12.0 - September 3, 2025

## Added

#### salesforcedx-vscode-core

- We introduced significant improvements to the org cleanup and display functionality in the CLI Integration extension. The main changes involve refactoring the org list clean command to more accurately identify and remove expired or deleted orgs, improving the precision of expiration checks by using timestamps, and enhancing the user feedback with detailed messages and a table display of remaining orgs. ([PR #6500](https://github.com/forcedotcom/salesforcedx-vscode/pull/6500))

- We improved the bundling of our extensions to reduce the extensions size. ([PR #6490](https://github.com/forcedotcom/salesforcedx-vscode/pull/6490))

## Fixed

#### salesforcedx-vscode-core

- We fixed a bug where org aliases that contain dashes were not handled correctly by the parsing logic. ([PR #6521](https://github.com/forcedotcom/salesforcedx-vscode/pull/6521))

- We updated the logic for enabling source tracking during deploy and retrieve operations, making the behavior more consistent and improving performance control. Now, source tracking is only used for source-tracked orgs when the relevant setting is enabled, and is never used for non-source-tracked orgs regardless of the setting. ([PR #6507](https://github.com/forcedotcom/salesforcedx-vscode/pull/6507))
