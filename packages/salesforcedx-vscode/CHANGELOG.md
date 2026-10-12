# 68.1.1 - October 19, 2026

## Fixed

#### salesforcedx-vscode-apex

- We fixed a bug where Apex problems from the language server did not show **Apex Language Server** as the Source in the Problems panel. ([PR #8418](https://github.com/forcedotcom/salesforcedx-vscode/pull/8418))

## Changed

#### salesforcedx-vscode-core

- The **Command Palette** no longer includes **SFDX: Open Documentation** (`sf.open.documentation`). ([PR #8382](https://github.com/forcedotcom/salesforcedx-vscode/pull/8382))

#### salesforcedx-vscode-services

- The **Web Console** now uses host-provided session identity and org metadata from `salesforce-web-console.sessionContext` for authentication. ([PR #8395](https://github.com/forcedotcom/salesforcedx-vscode/pull/8395))
