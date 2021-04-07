# 51.8.0 - April 07, 2021

## Added

#### salesforcedx-vscode-apex

- Add progress reporting and cancellation to Apex test runs ([PR #3103](https://github.com/forcedotcom/salesforcedx-vscode/pull/3103))

#### salesforcedx-sobjects-faux-generator

- Add cancellation to SObject Refresh command ([PR #3116](https://github.com/forcedotcom/salesforcedx-vscode/pull/3116))

## Fixed

#### docs

- Update Org Picker location in documentation ([PR #3099](https://github.com/forcedotcom/salesforcedx-vscode/pull/3099)) ([Issue #3095](https://github.com/forcedotcom/salesforcedx-vscode/issues/3095))

- Update Apex status to reflect default usage in Salesforce CLI ([PR #3119](https://github.com/forcedotcom/salesforcedx-vscode/pull/3119))

#### salesforcedx-vscode-core

- Better exception handling for type inference errors ([PR #3127](https://github.com/forcedotcom/salesforcedx-vscode/pull/3127))

- Fix missing label issue ([PR #3123](https://github.com/forcedotcom/salesforcedx-vscode/pull/3123)) ([Issue #3111](https://github.com/forcedotcom/salesforcedx-vscode/issues/3111))

# 51.7.0 - Mar 31, 2021

## Added

#### salesforcedx-sobjects-vscode-core

- Switched setting `salesforcedx-vscode-core.experimental.deployRetrieve` to on by default. ([PR #3101](https://github.com/forcedotcom/salesforcedx-vscode/pull/3101))

#### salesforcedx-sobjects-faux-generator

- Generate typings for sobjects ([PR #3018](https://github.com/forcedotcom/salesforcedx-vscode/pull/3018))

## Fixed

#### salesforcedx-vscode-core

- Do not show refresh success message for min sobjects ([PR #3082](https://github.com/forcedotcom/salesforcedx-vscode/pull/3082))

# 51.6.0 - March 24, 2021

## Added

#### salesforcedx-vscode-core

- Add cancellation to Deploy & Retrieve Library commands ([PR #3068](https://github.com/forcedotcom/salesforcedx-vscode/pull/3068))

## Fixed

#### salesforcedx-vscode-core

- Fix deployment issues with Document metadata types ([PR #3083](https://github.com/forcedotcom/salesforcedx-vscode/pull/3083))

- Fix library executions not focusing on channel output via the 'Show' button ([PR #3081](https://github.com/forcedotcom/salesforcedx-vscode/pull/3081), [Issue #2987](https://github.com/forcedotcom/salesforcedx-vscode/issues/2987))

- Generate SObject definitions from cached data ([PR #3037](https://github.com/forcedotcom/salesforcedx-vscode/pull/3037))

# 51.5.0 - March 18, 2021

## Fixed

#### salesforcedx-sobjects-faux-generator

- Handle `undefined` results when running `SFDX: Refresh SObject Definitions` command ([PR #3064](https://github.com/forcedotcom/salesforcedx-vscode/pull/3064), [Issue #3056](https://github.com/forcedotcom/salesforcedx-vscode/issues/3056))

#### salesforcedx-vscode-core

- Fixed issues with deploy retrieve beta: timeout for long running operations, output for multi-file components, and retrieving static resources ([PR #3048](https://github.com/forcedotcom/salesforcedx-vscode/pull/3048))

### docs

- Update description for deploy retrieve beta setting ([PR #3043](https://github.com/forcedotcom/salesforcedx-vscode/pull/3043))

# 51.4.0 - March 10, 2021

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- Issue with debugging single test method ([PR #3033](https://github.com/forcedotcom/salesforcedx-vscode/pull/3033), [Issue #3026](https://github.com/forcedotcom/salesforcedx-vscode/issues/3026))

#### salesforcedx-vscode-apex

- Switch to Apex output channel automatically after running Apex tests ([PR #3027](https://github.com/forcedotcom/salesforcedx-vscode/pull/3027)), ([Issue #3009](https://github.com/forcedotcom/salesforcedx-vscode/issues/3009))

# 51.3.0 - March 3, 2021

## Added

#### salesforcedx-sobjects-faux-generator

- Improved sObject refresh performance ([PR #2997](https://github.com/forcedotcom/salesforcedx-vscode/pull/2997))

### docs

- Add learning map to additional resources ([PR #2989](https://github.com/forcedotcom/salesforcedx-vscode/pull/2989))

- Update SOQL docs for saving query results ([PR #2988](https://github.com/forcedotcom/salesforcedx-vscode/pull/2988))

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- Fix debug test icon color to be friendly for light themes ([PR #2978](https://github.com/forcedotcom/salesforcedx-vscode/pull/2978))

# 51.2.0 - February 24, 2021

## Added

#### salesforcedx-vscode-apex

- Add namespace support for running and debugging tests ([PR #2961](https://github.com/forcedotcom/salesforcedx-vscode/pull/2961)), ([Issue #2865](https://github.com/forcedotcom/salesforcedx-vscode/issues/2865))

## Fixed

#### docs

- SOQL Builder - Add LIKE support ([PR #2971](https://github.com/forcedotcom/salesforcedx-vscode/pull/2971))

- SOQL Builder - Add COUNT support ([PR #2946](https://github.com/forcedotcom/salesforcedx-vscode/pull/2946))

#### salesforcedx-vscode-apex

- Execute anonymous Apex command not focusing the output channel ([PR #2962](https://github.com/forcedotcom/salesforcedx-vscode/pull/2962)), ([Issue #2947](https://github.com/forcedotcom/salesforcedx-vscode/issues/2947))

# 50.17.0 - February 10, 2021

## Fixed

#### docs

- Update documentation for [local development](https://developer.salesforce.com/tools/vscode/en/lwc/localdev) ([PR #2917](https://github.com/forcedotcom/salesforcedx-vscode/pull/2917))

#### salesforcedx-vscode-apex

- Fix 'SFDX: Execute Anonymous Apex' diagnostic reporting for runtime failures ([PR #2927](https://github.com/forcedotcom/salesforcedx-vscode/pull/2927))

#### salesforcedx-vscode-apex-debugger

- Remove use of missing telemetry method ([PR #2913](https://github.com/forcedotcom/salesforcedx-vscode/pull/2913))

#### salesforcedx-vscode-apex-replay-debugger

- Remove use of missing telemetry method ([PR #2913](https://github.com/forcedotcom/salesforcedx-vscode/pull/2913))

#### salesforcedx-vscode-core

- Add new template updates for apex class and project config ([PR #2919](https://github.com/forcedotcom/salesforcedx-vscode/pull/2919))

#### salesforcedx-vscode-lwc

- Activate Redhat XML extension only if it is version 0.14.0 ([PR #2934](https://github.com/forcedotcom/salesforcedx-vscode/pull/2934)). This is an interim fix for the issue ([Issue #2923](https://github.com/forcedotcom/salesforcedx-vscode/issues/2923)).

- Adds VS Code support for Email Templates as a target for custom components. ([PR #2918](https://github.com/forcedotcom/salesforcedx-vscode/pull/2918))

#### salesforcedx-vscode-visualforce

- Remove use of missing telemetry method ([PR #2913](https://github.com/forcedotcom/salesforcedx-vscode/pull/2913))

# 50.16.0 - February 3, 2021

## Added

#### salesforcedx-vscode-apex

- Surface project information in `Apex Language Server` Output panel ([PR #2891](https://github.com/forcedotcom/salesforcedx-vscode/pull/2891))

## Fixed

#### docs

- Add Log Analyzer to [Recommended Extensions](https://developer.salesforce.com/tools/vscode/en/getting-started/recommended-extensions) ([PR #2911](https://github.com/forcedotcom/salesforcedx-vscode/pull/2911))

- Add AdoptOpenJDK configuration sample for Linux in [Java Setup](https://developer.salesforce.com/tools/vscode/en/getting-started/java-setup) ([PR #2870](https://github.com/forcedotcom/salesforcedx-vscode/pull/2870)) - Contribution by [@renatoliveira](https://github.com/renatoliveira)

- Include steps to get the JDK install path for MacOS in [Java Setup](https://developer.salesforce.com/tools/vscode/en/getting-started/java-setup) ([PR #2910](https://github.com/forcedotcom/salesforcedx-vscode/pull/2910)) - Contribution by [@mikeflemingcfs](https://github.com/mikeflemingcfs)

- Add missing permission step to [ISV Customer Debugger](https://developer.salesforce.com/tools/vscode/en/apex/isv-debugger/#configure-isv-customer-debugger) ([PR #2901](https://github.com/forcedotcom/salesforcedx-vscode/pull/2901))

#### salesforcedx-vscode-lwc

- Reduce extension size by 34% ([PR #2904](https://github.com/forcedotcom/salesforcedx-vscode/pull/2904))

#### salesforcedx-vscode-lightning

- Reduce extension size by 68% ([PR #2908](https://github.com/forcedotcom/salesforcedx-vscode/pull/2908))

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
