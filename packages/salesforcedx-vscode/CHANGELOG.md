# 50.5.0 - November 11, 2020

## Fixed

#### salesforcedx-vscode-core

- Show debug log list in descending order by date for `SFDX: Get Apex Debug Logs` ([PR #2713](https://github.com/forcedotcom/salesforcedx-vscode/pull/2713), [Issue #2698](https://github.com/forcedotcom/salesforcedx-vscode/issues/2698))

- Set required version of VS Code to 1.46.0 or higher ([PR #2719](https://github.com/forcedotcom/salesforcedx-vscode/pull/2719))

# 50.4.0 - November 5, 2020

## Fixed

#### salesforcedx-vscode-core

- Allow retrieving multiple components as part of [Performance Enhancements](https://developer.salesforce.com/tools/vscode/en/user-guide/perf-enhancements) ([PR #2682](https://github.com/forcedotcom/salesforcedx-vscode/pull/2682))

#### salesforcedx-vscode-lwc

- Remove suggestions after every `{` character ([PR #2688](https://github.com/forcedotcom/salesforcedx-vscode/pull/2688), [Issue #2681](https://github.com/forcedotcom/salesforcedx-vscode/issues/2681))

# 50.3.0 - October 28, 2020

## Added

#### salesforcedx-vscode-core

- New force:apex:log:list command implementation, used as part of `SFDX: Get Apex Debug Logs ...` ([PR #2644](https://github.com/forcedotcom/salesforcedx-vscode/pull/2644))

## Fixed

#### docs

- Fix broken links to [Java Setup](https://developer.salesforce.com/tools/vscode/en/getting-started/java-setup) article ([PR #2677](https://github.com/forcedotcom/salesforcedx-vscode/pull/2677))

#### salesforcedx-vscode-core

- Clear deploy and Anonymous Apex diagnostics from Problems panel ([PR #2671](https://github.com/forcedotcom/salesforcedx-vscode/pull/2671), [PR #2673](https://github.com/forcedotcom/salesforcedx-vscode/pull/2673), [Issue #2608](https://github.com/forcedotcom/salesforcedx-vscode/issues/2608))

# 50.2.0 - October 22, 2020

## Fixed

#### docs

- Re-organize Get Started section ([PR #2626](https://github.com/forcedotcom/salesforcedx-vscode/pull/2626))

#### salesforcedx-vscode-apex

- Improve @AuraEnabled apex snippet for better error handling. ([PR #2640](https://github.com/forcedotcom/salesforcedx-vscode/pull/2640)) - Contribution by [@PawelWozniak](https://github.com/PawelWozniak)

#### salesforcedx-vscode-core

- Org Browser retrieve & open handling types with xml only files ([PR #2635](https://github.com/forcedotcom/salesforcedx-vscode/pull/2635))

- Fixed Org Browser retrieve ([PR #2639](https://github.com/forcedotcom/salesforcedx-vscode/pull/2639), [Issue #2634](https://github.com/forcedotcom/salesforcedx-vscode/issues/2634))

#### salesforcedx-vscode-lwc

- LWC Language Server correctly handles empty custom label files ([PR #2637](https://github.com/forcedotcom/salesforcedx-vscode/pull/2637), [Issue #2575](https://github.com/forcedotcom/salesforcedx-vscode/issues/2575))

# 50.1.0 - October 14, 2020

## Added

#### salesforcedx-vscode-core

- Added `Retrieve and Open Source` feature for Org Browser ([PR #2573](https://github.com/forcedotcom/salesforcedx-vscode/pull/2573))

## Fixed

#### salesforcedx-vscode-core

- Updated to latest versions of Aura and LWC language servers for auto-complete fixes ([PR# 2607](https://github.com/forcedotcom/salesforcedx-vscode/pull/2607), [Issue #2322](https://github.com/forcedotcom/salesforcedx-vscode/issues/2322), [Issue #2584](https://github.com/forcedotcom/salesforcedx-vscode/issues/2584))

#### docs

- Updated [Recommended Extensions](https://developer.salesforce.com/tools/vscode/en/getting-started/recommended-extensions) for Salesforce development ([PR #2619](https://github.com/forcedotcom/salesforcedx-vscode/pull/2619))

- Added `Retrieve and Open Source` step for [Org Browser](https://developer.salesforce.com/tools/vscode/en/user-guide/org-browser) ([PR# 2591](https://github.com/forcedotcom/salesforcedx-vscode/pull/2591))
