# 64.3.0 - July 2, 2025

## Fixed

#### salesforcedx-vscode-apex

- Allow retries upon connection timeouts when running apex tests ([PR #6384](https://github.com/forcedotcom/salesforcedx-vscode/pull/6384))

- Add strategy to telemetry ([PR #6374](https://github.com/forcedotcom/salesforcedx-vscode/pull/6374))

#### salesforcedx-vscode-apex-replay-debugger

- Allow retries upon connection timeouts when running apex tests ([PR #6384](https://github.com/forcedotcom/salesforcedx-vscode/pull/6384))

# 64.2.1 - June 25, 2025

## Added

#### salesforcedx-sobjects-faux-generator
#### salesforcedx-utils-vscode
#### salesforcedx-vscode-apex
#### salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #6322](https://github.com/forcedotcom/salesforcedx-vscode/pull/6322), [PR #6331](https://github.com/forcedotcom/salesforcedx-vscode/pull/6331))


## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue with the Apex Language Server that caused database corruption. ([PR #6371](https://github.com/forcedotcom/salesforcedx-vscode/pull/6371))

#### salesforcedx-vscode-core

- We fixed an issue where refreshing of SObjects definition wouldn't stop when no default org was set. ([PR #6367](https://github.com/forcedotcom/salesforcedx-vscode/pull/6367))

- We added a helpful 'No components retrieved' message in the Output Tab when a manifest that contains no valid components is retrieved. You're welcome! ([PR #6357](https://github.com/forcedotcom/salesforcedx-vscode/pull/6357))
