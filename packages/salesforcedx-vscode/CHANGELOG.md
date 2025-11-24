# 65.6.0 - November 26, 2025

## Added

#### salesforcedx-vscode-apex-oas

- We adapted the External Service Registration (ESR) generation logic to meet General Availability (GA) requirements. The key change is that for org API version 66.0 and above, the operations section is completely removed from the ESR metadata, rather than being included with `active=false`. ([PR #6664](https://github.com/forcedotcom/salesforcedx-vscode/pull/6664))

## Fixed

#### salesforcedx-vscode-org

- We fixed the ordering of the status bar entries so that the "Open Default Org in Browser" button is returned to its original location next to the org picker. ([PR #6652](https://github.com/forcedotcom/salesforcedx-vscode/pull/6652))
