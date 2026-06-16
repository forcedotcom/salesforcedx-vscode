# 67.1.0 - June 18, 2026

## Added

#### salesforcedx-vscode-apex

- We updated the Apex Language Server with Summer '26 (API version 262) language definitions and refreshed standard Apex library. ([PR #7435](https://github.com/forcedotcom/salesforcedx-vscode/pull/7435))

#### salesforcedx-vscode-org

- The **SFDX: Delete Default Org** command is now hidden when your default org is a production org or Dev Hub (only scratch orgs and sandboxes can be deleted). ([PR #7433](https://github.com/forcedotcom/salesforcedx-vscode/pull/7433))

## Fixed

#### salesforcedx-vscode-org

- We fixed a bug where the Apex test view didn't refresh immediately after changing the default org. ([PR #7448](https://github.com/forcedotcom/salesforcedx-vscode/pull/7448))

## Under the Hood

- We made some under the hood changes. ([PR #7418](https://github.com/forcedotcom/salesforcedx-vscode/pull/7418), [PR #7351](https://github.com/forcedotcom/salesforcedx-vscode/pull/7351))

# 66.15.0 - June 11, 2026

## Added

#### salesforcedx-vscode-services

- We added a `SalesforceProject` Effect service with API caching. ([PR #7432](https://github.com/forcedotcom/salesforcedx-vscode/pull/7432))

#### salesforcedx-vscode-core

- The **Org Picker** now shows scratch org aliases after the username, when present. ([PR #7404](https://github.com/forcedotcom/salesforcedx-vscode/pull/7404))

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue where the status-bar Org Picker showed a stale list of orgs after deleting an org outside VS Code. The Org Picker now lists only orgs currently found by the Salesforce CLI. ([PR #7432](https://github.com/forcedotcom/salesforcedx-vscode/pull/7432))

- We fixed a bug where the **SFDX: Create Project** command failed on Windows when the target folder path contained a trailing backslash. ([PR #7431](https://github.com/forcedotcom/salesforcedx-vscode/pull/7431))

## Under the Hood

- We made some under the hood changes. ([PR #7365](https://github.com/forcedotcom/salesforcedx-vscode/pull/7365), [PR #7366](https://github.com/forcedotcom/salesforcedx-vscode/pull/7366), [PR #7423](https://github.com/forcedotcom/salesforcedx-vscode/pull/7423))

