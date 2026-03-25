# 66.3.1 - March 27, 2026

## Added

#### salesforcedx-vscode-core

- Apex class creation now includes template selection, so developers can choose a starter pattern at creation time instead of manually editing generated files after creation. ([PR #7023](https://github.com/forcedotcom/salesforcedx-vscode/pull/7023))

- Added support for creating agent project templates to streamline Agentforce project setup and reduce manual project scaffolding steps. ([PR #7027](https://github.com/forcedotcom/salesforcedx-vscode/pull/7027))

#### salesforcedx-vscode-soql

- Query Plan is now available in the SOQL extension text editor view, making it easier to inspect query cost and optimize performance without leaving the editor. ([PR #7013](https://github.com/forcedotcom/salesforcedx-vscode/pull/7013))

## Fixed

#### salesforcedx-vscode

#### salesforcedx-vscode-expanded

- Added the Agentforce DX extension to both the Salesforce Extension Pack and the Salesforce Extension Pack (Expanded) so Agentforce capabilities are available as part of the packaged experience. ([PR #7003](https://github.com/forcedotcom/salesforcedx-vscode/pull/7003))

#### salesforcedx-vscode-apex

- Added defensive Apex Language Server shutdown handling to prevent orphaned background processes during extension restart or deactivation. ([PR #7031](https://github.com/forcedotcom/salesforcedx-vscode/pull/7031))

#### salesforcedx-vscode-apex-testing

- Added a guided VS Code walkthrough for Apex Test Explorer to help new users discover and use core testing workflows faster W-21655739 ([PR #7017](https://github.com/forcedotcom/salesforcedx-vscode/pull/7017))

- Fixed Apex testing extension test suite membership for duplicate class names to avoid ambiguous class resolution. ([PR #7016](https://github.com/forcedotcom/salesforcedx-vscode/pull/7016))

- Improved Apex testing extension error messaging with clearer guidance to help users diagnose and recover from common failures. ([PR #7005](https://github.com/forcedotcom/salesforcedx-vscode/pull/7005))

#### salesforcedx-vscode-core

- Added a quick pick option for agent project templates so template choice is surfaced directly in the command flow. ([PR #7045](https://github.com/forcedotcom/salesforcedx-vscode/pull/7045))

- Fixed issues in org logout, alias management, and org picker interactions to improve org lifecycle reliability and day-to-day UX. ([PR #6992](https://github.com/forcedotcom/salesforcedx-vscode/pull/6992))

- Made changes under the hood to catch up with the latest SDR library changes for compatibility and stability improvements. ([PR #7020](https://github.com/forcedotcom/salesforcedx-vscode/pull/7020))

#### salesforcedx-vscode-metadata

- Updated command visibility so LWC commands are not shown when no Salesforce project is open, reducing confusion and invalid command execution paths. ([PR #7024](https://github.com/forcedotcom/salesforcedx-vscode/pull/7024))

#### salesforcedx-vscode-org

- Added clearer org auth guidance for port `1717` scenarios to help users recover from local auth flow issues more quickly. ([PR #7066](https://github.com/forcedotcom/salesforcedx-vscode/pull/7066))
