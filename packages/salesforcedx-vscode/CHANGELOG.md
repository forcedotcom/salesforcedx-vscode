# 50.14.0 - January 21, 2021

## Fixed

#### salesforcedx-vscode-apex

- Fix issue with recognizing the default org when running tests at the start of a session ([PR #2868](https://github.com/forcedotcom/salesforcedx-vscode/pull/2868))

# 50.13.0 - January 13, 2021

## Added

#### salesforcedx-vscode-apex

- Added debug button to test sidebar to automatically run Apex Replay Debugger after test run ([PR #2804](https://github.com/forcedotcom/salesforcedx-vscode/pull/2804))

#### salesforcedx-vscode-core

- Run Apex tests using the Apex library ([PR #2828](https://github.com/forcedotcom/salesforcedx-vscode/pull/2828))

## Fixed

#### docs

- Remove manual listing of palette commands ([PR #2848](https://github.com/forcedotcom/salesforcedx-vscode/pull/2848))

#### salesforcedx-sobjects-faux-generator

- Prevent SObject refresh from filtering SObjects unexpectedly ([PR #2806](https://github.com/forcedotcom/salesforcedx-vscode/pull/2806)) - Contribution by [@maaaaarco](https://github.com/maaaaarco)

- Allow Event SObject generation ([PR #2821](https://github.com/forcedotcom/salesforcedx-vscode/pull/2821), [Issue #2490](https://github.com/forcedotcom/salesforcedx-vscode/issues/2490)) - Contribution by [@XVRick](https://github.com/XVRick)

#### salesforcedx-vscode-core

- Provides relative project paths for beta deploy/retrieve in the output ([PR #2807](https://github.com/forcedotcom/salesforcedx-vscode/pull/2807))

# 50.8.0 - December 9, 2020

## Added

#### salesforcedx-vscode-core

- Allow deploying with manifest as part of [Performance Enhancements](https://developer.salesforce.com/tools/vscode/en/user-guide/perf-enhancements) ([PR #2787](https://github.com/forcedotcom/salesforcedx-vscode/pull/2787))

- Allow retrieving with manfiest as part of [Performance Enhancements](https://developer.salesforce.com/tools/vscode/en/user-guide/perf-enhancements) ([PR #2785](https://github.com/forcedotcom/salesforcedx-vscode/pull/2785))

# 50.7.0 - December 2, 2020

## Added

#### salesforcedx-vscode-core

- Org Browser usage of [Performance Enhancements](https://developer.salesforce.com/tools/vscode/en/user-guide/perf-enhancements) ([PR #2756](https://github.com/forcedotcom/salesforcedx-vscode/pull/2756))

## Fixed

#### docs

- Add license note for Apex Interactive Debugger ([PR #2760](https://github.com/forcedotcom/salesforcedx-vscode/pull/2760))

#### salesforcedx-vscode-core

- Reduce `salesforcedx-vscode-core` extension size by 30% ([PR #2769](https://github.com/forcedotcom/salesforcedx-vscode/pull/2769))

#### salesforcedx-vscode-lightning

- Fix `TypeError: Cannot read property 'charCodeAt' of undefined` ([PR #2775](https://github.com/forcedotcom/salesforcedx-vscode/pull/2775), [Issue #1684](https://github.com/forcedotcom/salesforcedx-vscode/issues/1684))

- Fix `Error re-indexing workspace: Cannot read property 'indexOf' of undefined` ([PR #2775](https://github.com/forcedotcom/salesforcedx-vscode/pull/2775), [Issue #2624](https://github.com/forcedotcom/salesforcedx-vscode/issues/2624))

#### salesforcedx-vscode-lwc

- Fix LWC component library links displayed when hovering over tags ([PR #2775](https://github.com/forcedotcom/salesforcedx-vscode/pull/2775), [Issue #2703](https://github.com/forcedotcom/salesforcedx-vscode/issues/2703))

- Fix `Cannot destructure property 'delimiter' of (intermediate value) as it is undefined` ([PR #2775](https://github.com/forcedotcom/salesforcedx-vscode/pull/2775), [Issue #2636](https://github.com/forcedotcom/salesforcedx-vscode/issues/2636), [Issue #2570](https://github.com/forcedotcom/salesforcedx-vscode/issues/2570))

- Auto-complete support for js-meta.xml ([PR #2726](https://github.com/forcedotcom/salesforcedx-vscode/pull/2726))

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
