# 64.5.1 - July 18, 2025

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6400](https://github.com/forcedotcom/salesforcedx-vscode/pull/6400), [PR #6395](https://github.com/forcedotcom/salesforcedx-vscode/pull/6395))

## Fixed

#### salesforcedx-vscode-apex

- We fixed a bug that was causing Apex test diagnostics to appear under an "unknown" label in the Problems Tab. ([PR #6405](https://github.com/forcedotcom/salesforcedx-vscode/pull/6405))

#### salesforcedx-vscode-core

- We fixed a bug where unsaved manifests were being created when the **SFDX: Generate Manifest File** command is escaped. ([PR #6391](https://github.com/forcedotcom/salesforcedx-vscode/pull/6391))

- We made an improvement to the user experience in the org browser.  Users no longer need to click the **SFDX: Refresh Types** button every time they switch between orgs; the metadata types for the new org are now populated automatically. ([PR #6401](https://github.com/forcedotcom/salesforcedx-vscode/pull/6401))

- We improved the **SFDX: Turn On Apex Debug Logs for Replay Debugger** command so it doesn't call the `sf data:create:record` CLI command under the hood.  With that change comes a huge performance improvement - now the command completes in about 1/3 of the original runtime! ([PR #6386](https://github.com/forcedotcom/salesforcedx-vscode/pull/6386))
