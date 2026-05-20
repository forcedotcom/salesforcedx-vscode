# 66.12.3 - May 22, 2026

## Added

#### salesforcedx-vscode-metadata

- You can now disable automatic source tracking conflict detection via the **Source Tracking: Disable Conflict Detection** setting for improved startup performance. ([PR #7323](https://github.com/forcedotcom/salesforcedx-vscode/pull/7323))

## Fixed

#### salesforcedx-vscode-apex

- We fixed an unhandled "Channel has been closed" exception that could occur during Apex Language Server restart. ([PR #7314](https://github.com/forcedotcom/salesforcedx-vscode/pull/7314))

#### salesforcedx-vscode-org

- We fixed an issue where the source tracking status bar didn't refresh after switching orgs via the org picker. ([PR #7328](https://github.com/forcedotcom/salesforcedx-vscode/pull/7328))

## Under the Hood

- We made some under the hood changes. ([PR #7293](https://github.com/forcedotcom/salesforcedx-vscode/pull/7293), [PR #7299](https://github.com/forcedotcom/salesforcedx-vscode/pull/7299), [PR #7322](https://github.com/forcedotcom/salesforcedx-vscode/pull/7322), [PR #7325](https://github.com/forcedotcom/salesforcedx-vscode/pull/7325), [PR #7331](https://github.com/forcedotcom/salesforcedx-vscode/pull/7331), [PR #7336](https://github.com/forcedotcom/salesforcedx-vscode/pull/7336))
