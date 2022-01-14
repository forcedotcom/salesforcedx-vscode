# 53.13.0 - January 13, 2022

## Added

#### salesforcedx-vscode-apex

- Identify test class from uri ([PR #3751](https://github.com/forcedotcom/salesforcedx-vscode/pull/3751))

## Fixed

#### docs

- Updates to reflect runtime restrictions ([PR #3741](https://github.com/forcedotcom/salesforcedx-vscode/pull/3741))

#### salesforcedx-vscode-apex

- Prevent local java runtime in project ([PR #3730](https://github.com/forcedotcom/salesforcedx-vscode/pull/3730))

# 53.12.0 - January 5, 2022

## Added

#### salesforcedx-vscode-core

- Add ability to remove expired orgs from the org list ([PR #3732](https://github.com/forcedotcom/salesforcedx-vscode/pull/3732))

# 53.8.0 - December 16, 2021

## Added

#### salesforcedx-vscode-apex

- Enable use of anonymous Apex execution codelens ([PR #3688](https://github.com/forcedotcom/salesforcedx-vscode/pull/3688))

## Fixed

#### salesforcedx-vscode-core

- Fix org browser to show retrieve source action for sobjects ([PR #3697](https://github.com/forcedotcom/salesforcedx-vscode/pull/3697))

- Fix org browser to display nested items such as Email Templates, Dashboards, Documents and Reports ([PR #3685](https://github.com/forcedotcom/salesforcedx-vscode/pull/3685))

# 53.7.0 - December 9, 2021

## Fixed

#### docs

- Fix broken doc links ([PR #3665](https://github.com/forcedotcom/salesforcedx-vscode/pull/3665))

#### salesforcedx-vscode-core

- Retrieve field data for a custom object type ([PR #3661](https://github.com/forcedotcom/salesforcedx-vscode/pull/3661))

- Ability to select and deploy multiple files ([PR #3660](https://github.com/forcedotcom/salesforcedx-vscode/pull/3660))

# 53.4.0 - November 17, 2021

## Added

#### salesforcedx-vscode-core

- Add ability to deploy and retrieve multiple files ([PR #3621](https://github.com/forcedotcom/salesforcedx-vscode/pull/3621))

#### salesforcedx-vscode-apex

- Enabled Hover, Go to Definition, and References functionality in anonymous apex files ([PR #3650](https://github.com/forcedotcom/salesforcedx-vscode/pull/3650))

## Fixed

#### docs

- Add multi-selecting files and folders in explorer for Source Deploy/Retrieve, and fields and field details for custom objects ([PR #3639](https://github.com/forcedotcom/salesforcedx-vscode/pull/3639))

- Added New Articles for Japanese ([PR #3640](https://github.com/forcedotcom/salesforcedx-vscode/pull/3640))

# 53.3.0 - November 10, 2021

## Added

#### salesforcedx-vscode-apex

- Code completion for anonymous apex ([PR #3617](https://github.com/forcedotcom/salesforcedx-vscode/pull/3617))

## Fixed

#### salesforcedx-vscode-core

- Under-the-hood fixes ([PR #3631](https://github.com/forcedotcom/salesforcedx-vscode/pull/3631))

#### salesforcedx-vscode-lightning

- Update lightning-language-server to latest version ([PR #3633](https://github.com/forcedotcom/salesforcedx-vscode/pull/3633))

#### salesforcedx-vscode-lwc

- Update lightning-language-server to latest version ([PR #3633](https://github.com/forcedotcom/salesforcedx-vscode/pull/3633))

# 53.2.0 - November 4, 2021

## Fixed

#### docs

- Update byotemplate.md ([PR #3628](https://github.com/forcedotcom/salesforcedx-vscode/pull/3628))

# 53.1.0 - October 28, 2021

## Added

#### docs

- Append or prepend site title with SEO meta data ([PR #3546](https://github.com/forcedotcom/salesforcedx-vscode/pull/3546))

#### salesforcedx-vscode-apex

- Bundle extensions with apex.db to optimize LSP performance ([PR #3585](https://github.com/forcedotcom/salesforcedx-vscode/pull/3585))

## Fixed

#### docs

- Removed extra line in documentation ([PR #3614](https://github.com/forcedotcom/salesforcedx-vscode/pull/3614))

- Update performance enhancements documentation ([PR #3593](https://github.com/forcedotcom/salesforcedx-vscode/pull/3593))

#### salesforcedx-vscode-core

- Set first alias when configuring default org ([PR #3581](https://github.com/forcedotcom/salesforcedx-vscode/pull/3581)) - Contribution by @DanielCalle

- Fix broken documentation links ([PR #3605](https://github.com/forcedotcom/salesforcedx-vscode/pull/3605))

- Remove the Experimental: Deploy Retrieve performance enhancements user setting ([PR #3580](https://github.com/forcedotcom/salesforcedx-vscode/pull/3580))

- Under-the-hood fixes

# 53.0.0 - October 13, 2021

## Fixed

#### salesforcedx-vscode-apex

- Changes in Apex Language Server to suggest correct autocompletes in projects with namespace, additional telemetry and deletion of SOQL library. ([PR #3568](https://github.com/forcedotcom/salesforcedx-vscode/pull/3568))

#### docs

- Removes Salesforce Functions Beta tag. ([PR #3583](https://github.com/forcedotcom/salesforcedx-vscode/pull/3583))

# 52.17.0 - October 8, 2021

## Added

#### salesforcedx-vscode-core

- Support custom templates in VS Code ([PR #3563](https://github.com/forcedotcom/salesforcedx-vscode/pull/3563))

## Fixed

#### docs

- Documentation for custom templates in VS Code ([PR #3565](https://github.com/forcedotcom/salesforcedx-vscode/pull/3565))

#### salesforcedx-vscode-core

- Fix a conflict detection bug when components are deployed multiple time ([PR #3556](https://github.com/forcedotcom/salesforcedx-vscode/pull/3556))

# 52.16.0 - September 29, 2021

## Added

#### salesforcedx-vscode-apex

- Improve performance for Apex Indexer startup and updates the faux classes for the built-in standard Apex library ([PR #3529](https://github.com/forcedotcom/salesforcedx-vscode/pull/3529))

## Fixed

#### salesforcedx-vscode-core

- Set sourceApiVersion for sourcepath based deploy and retrieve ([PR #3528](https://github.com/forcedotcom/salesforcedx-vscode/pull/3528))

#### salesforcedx-vscode-lwc

- Fix debug code lens for VS Code 1.60+ ([PR #3545](https://github.com/forcedotcom/salesforcedx-vscode/pull/3545))

#### salesforcedx-vscode-apex-replay-debugger

- Fix trace flag update error ([PR #3550](https://github.com/forcedotcom/salesforcedx-vscode/pull/3550))

#### salesforcedx-vscode-soql

- Skip checking types in libs ([PR #3534](https://github.com/forcedotcom/salesforcedx-vscode/pull/3534))

# 52.13.0 - September 8, 2021

## Fixed

#### docs

- Fixes doc bug that has incorrect location of the Org Picker. ([PR #3423](https://github.com/forcedotcom/salesforcedx-vscode/pull/3423))

#### salesforcedx-vscode-core

- Typo in salesforcedx-vscode-core/src/messages/i18n.ts ([PR #3525](https://github.com/forcedotcom/salesforcedx-vscode/pull/3525)) - Contribution by [@RitamAgrawal](https://github.com/RitamAgrawal)

# 52.12.0 - September 1, 2021

## Fixed

#### salesforcedx-vscode-apex

- Fixes Apex snippets to use a drop-down for access modifiers instead of a list, including: staticmethod, method, field, constructor. ([PR #3492](https://github.com/forcedotcom/salesforcedx-vscode/pull/3492))

# 52.11.0 - August 26, 2021

## Fixed

#### docs

- Add Functions to the sidebar of VSCode doc site ([PR #3510](https://github.com/forcedotcom/salesforcedx-vscode/pull/3510))

# 52.9.1 - August 12, 2021

## Fixed

#### docs

- Updated docs website's default header and footer ([PR #3491](https://github.com/forcedotcom/salesforcedx-vscode/pull/3491))

#### salesforcedx-vscode-core

- Revert SDR to 2.1.5 ([PR #3497](https://github.com/forcedotcom/salesforcedx-vscode/pull/3497))

# 52.9.0 - August 11, 2021

## Fixed

#### salesforcedx-vscode-core

- Use functions library to create functions ([PR #3476](https://github.com/forcedotcom/salesforcedx-vscode/pull/3476))

- Add support for invoking function using payload contents ([PR #3472](https://github.com/forcedotcom/salesforcedx-vscode/pull/3472))

- Bump SDR to 3.0.0 ([PR #3497](https://github.com/forcedotcom/salesforcedx-vscode/pull/3451))

#### salesforcedx-vscode-lwc

- Update lightning language servers to 3.0.14 ([PR #3468](https://github.com/forcedotcom/salesforcedx-vscode/pull/3468))

#### salesforcedx-vscode-lightning

- Update lightning language servers to 3.0.14 ([PR #3468](https://github.com/forcedotcom/salesforcedx-vscode/pull/3468))

# 52.8.0 - August 4, 2021

## Added

#### salesforcedx-vscode-apex-replay-debugger

- Support checkpoints for one-step replay debugger ([PR #3410](https://github.com/forcedotcom/salesforcedx-vscode/pull/3410))

#### salesforcedx-vscode-core

- Remove old conflict detection mechanism ([PR #3377](https://github.com/forcedotcom/salesforcedx-vscode/pull/3377))

# 52.7.0 - July 30, 2021

## Added

#### salesforcedx-vscode-apex

- Add commands `SFDX: Create Apex Test Suite`, `SFDX: Add Tests to Apex Test Suite`, and `SFDX: Run Apex Test Suite` ([PR #3435](https://github.com/forcedotcom/salesforcedx-vscode/pull/3435))

#### salesforcedx-vscode-core

- Add command `SFDX: Log Out from Default Org` ([PR #3428](https://github.com/forcedotcom/salesforcedx-vscode/pull/3428))

## Fixed

#### docs

- Update default-org.md ([PR #3447](https://github.com/forcedotcom/salesforcedx-vscode/pull/3447))

#### salesforcedx-vscode-core

- Support additional metadata types with conflict detection ([PR #3424](https://github.com/forcedotcom/salesforcedx-vscode/pull/3424))

- Support multiple directories on deploy on save with conflict detection ([PR #3393](https://github.com/forcedotcom/salesforcedx-vscode/pull/3393))

# 52.6.0 - July 23, 2021

## Added

#### salesforcedx-vscode

- Include SOQL in extension pack ([PR #3400](https://github.com/forcedotcom/salesforcedx-vscode/pull/3400))

#### salesforcedx-vscode-core

- Update conflict detection setting description ([PR #3416](https://github.com/forcedotcom/salesforcedx-vscode/pull/3416))

- Fix functions dependency issue preventing extensions from loading ([PR #3443](https://github.com/forcedotcom/salesforcedx-vscode/pull/3443))

## Fixed

#### salesforcedx-sobjects-faux-generator

- Correct LWC typing generation for new projects ([PR #3418](https://github.com/forcedotcom/salesforcedx-vscode/pull/3418))

#### salesforcedx-vscode-core

- Performance improvements for `SFDX: Start Function`, `Invoke` and `Debug Invoke` commands ([PR #3399](https://github.com/forcedotcom/salesforcedx-vscode/pull/3399))

- Fix conflict detection error for empty results ([PR #3376](https://github.com/forcedotcom/salesforcedx-vscode/pull/3376))

# 52.5.0 - July 14, 2021

## Added

#### salesforcedx-vscode-apex-replay-debugger

- Update test sidebar icons and add test coverage for easy button replay debugger ([PR #3381](https://github.com/forcedotcom/salesforcedx-vscode/pull/3381))

#### salesforcedx-vscode-core

- Update text on Conflict detection modal window ([PR #3394](https://github.com/forcedotcom/salesforcedx-vscode/pull/3394))

- Enhance hovertip text for conflict detection to show last modified date information ([PR #3352](https://github.com/forcedotcom/salesforcedx-vscode/pull/3352))

## Fixed

#### docs

- Update docs for conflict detection ([PR #3396](https://github.com/forcedotcom/salesforcedx-vscode/pull/3396))

#### salesforcedx-vscode-core

- Remove setting to enable function [PR #3409](https://github.com/forcedotcom/salesforcedx-vscode/pull/3409))

# 52.4.0 - July 8, 2021

## Added

#### salesforcedx-vscode-core

- Enable conflict detection for all deploy commands ([PR #3357](https://github.com/forcedotcom/salesforcedx-vscode/pull/3357))

# 52.3.0 - June 30, 2021

## Added

#### salesforcedx-vscode-apex

- Add "Debug Test" code lens to Apex test methods and classes ([PR #3347](https://github.com/forcedotcom/salesforcedx-vscode/pull/3347))

#### salesforcedx-vscode-core

- Add language data to telemetry for functions ([PR #3338](https://github.com/forcedotcom/salesforcedx-vscode/pull/3338))

## Fixed

#### salesforcedx-vscode-apex

- Stop the language server output panel from stealing focus ([PR #3356](https://github.com/forcedotcom/salesforcedx-vscode/pull/3356), [Issue #1429](https://github.com/forcedotcom/salesforcedx-vscode/issues/1429))

#### salesforcedx-vscode-core

- Conflict detection not working in a brand new project ([PR #3358](https://github.com/forcedotcom/salesforcedx-vscode/pull/3358), [Issue #3294](https://github.com/forcedotcom/salesforcedx-vscode/issues/3294))

# 52.2.0 - June 24, 2021

## Added

#### salesforcedx-vscode-core

- Background enhancements to conflict detection caching ([PR #3334](https://github.com/forcedotcom/salesforcedx-vscode/pull/3334), [PR #3298](https://github.com/forcedotcom/salesforcedx-vscode/pull/3298), & [PR #3325](https://github.com/forcedotcom/salesforcedx-vscode/pull/3325))

# 52.1.0 - June 16, 2021

## Added

#### salesforcedx-vscode-core

- Setting to always force push on save ([PR #3144](https://github.com/forcedotcom/salesforcedx-vscode/pull/3144)) - Contribution by [@lukecotter](https://github.com/lukecotter)

- Auth with token ([PR #3268](https://github.com/forcedotcom/salesforcedx-vscode/pull/3268))

## Fixed

#### docs

- Update japanese translation ([PR #3205](https://github.com/forcedotcom/salesforcedx-vscode/pull/3205)) - Contribution by [@shunkosa](https://github.com/shunkosa)

#### salesforcedx-vscode-core

- Import FileProperties from the top level ([PR #3302](https://github.com/forcedotcom/salesforcedx-vscode/pull/3302))

- Use correct message for file diffs ([PR #3304](https://github.com/forcedotcom/salesforcedx-vscode/pull/3304))

# 51.17.0 - June 10, 2021

## Added

#### salesforcedx-vscode-core

- Add caching for conflict detection ([PR #3283](https://github.com/forcedotcom/salesforcedx-vscode/pull/3283))

## Fixed

#### docs

- New Functions article and related changes. ([PR #3278](https://github.com/forcedotcom/salesforcedx-vscode/pull/3278))

#### salesforcedx-vscode-core

- Remove Functions feature-flag and update doc ([PR #3289](https://github.com/forcedotcom/salesforcedx-vscode/pull/3289))

- Correct creation of trace flags when running `SFDX Turn on Apex Debug Log` ([PR #3290](https://github.com/forcedotcom/salesforcedx-vscode/pull/3290)), ([Issue #3288](https://github.com/forcedotcom/salesforcedx-vscode/issues/3288))

# 51.16.0 - June 3, 2021

## Added

#### salesforcedx-vscode-core

- Add Java support for Functions debugging ([PR #3273](https://github.com/forcedotcom/salesforcedx-vscode/pull/3273))

- Add Java support for `SFDX: Start Function` ([PR #3269](https://github.com/forcedotcom/salesforcedx-vscode/pull/3269))

## Fixed

#### salesforcedx-vscode-core

- Update default debug port ([PR #3272](https://github.com/forcedotcom/salesforcedx-vscode/pull/3272))

- Use new CLI for functions invoke @W-9282250@ ([PR #3270](https://github.com/forcedotcom/salesforcedx-vscode/pull/3270))

- Throw error on remote component not found ([PR #3259](https://github.com/forcedotcom/salesforcedx-vscode/pull/3259))

- Pull function dependencies by default + Java/Maven support @W-9282387@ ([PR #3262](https://github.com/forcedotcom/salesforcedx-vscode/pull/3262))

# 51.15.0 - May 27, 2021

## Added

#### salesforcedx-vscode-core

- Conflict detection performance improvements ([PR #3246](https://github.com/forcedotcom/salesforcedx-vscode/pull/3246))

- Use new CLI for Functions creation and add Java Functions support ([PR #3247](https://github.com/forcedotcom/salesforcedx-vscode/pull/3247))

## Fixed

#### salesforcedx-vscode-core

- Fix "Cannot read property split of undefined" issue when retrieving with Org Browser or Manifest ([#3262](https://github.com/forcedotcom/salesforcedx-vscode/pull/3263), [#3210](https://github.com/forcedotcom/salesforcedx-vscode/issues/3210), [#3218](https://github.com/forcedotcom/salesforcedx-vscode/issues/3218))

- Remove Functions template for `SFDX: Create Project` command ([#3253](https://github.com/forcedotcom/salesforcedx-vscode/pull/3253))

#### salesforcedx-vscode-apex

- Fix an issue where Apex test results were limited to 2000 records ([#3265](https://github.com/forcedotcom/salesforcedx-vscode/pull/3265))

# 51.14.0 - May 21, 2021

## Added

#### salesforcedx-vscode-core

- Enable diff detection for folders ([PR #3243](https://github.com/forcedotcom/salesforcedx-vscode/pull/3243))

- Enable diff detection for all metadata types ([PR #3240](https://github.com/forcedotcom/salesforcedx-vscode/pull/3240))

#### salesforcedx-vscode-lwc

- Add support for new LWC Analytics Dashboard feature and fix some under-the-hood bugs ([PR #3232](https://github.com/forcedotcom/salesforcedx-vscode/pull/3232))

#### docs

- Doc updates for Diff Detection([PR #3250](https://github.com/forcedotcom/salesforcedx-vscode/pull/3250))

# 51.13.0 - May 12, 2021

## Added

#### salesforcedx-vscode-core

- Cache metadata based on a project path ([PR #3191](https://github.com/forcedotcom/salesforcedx-vscode/pull/3191))

# 51.12.0 - May 6, 2021

## Fixed

#### salesforcedx-vscode-core

- Respect sfdx api version override during new deploy/retrieve ([PR #3208](https://github.com/forcedotcom/salesforcedx-vscode/pull/3208)), ([Issue #3151](https://github.com/forcedotcom/salesforcedx-vscode/issues/3151))

# 51.11.0 - April 29, 2021

## Fixed

#### salesforcedx-sobjects-faux-generator

- Disable LWC type generation ([PR #3165](https://github.com/forcedotcom/salesforcedx-vscode/pull/3165))

#### salesforcedx-vscode-core

- Preserve leading zeros in xml tags for the new Deploy/Retrieve route ([PR #3189](https://github.com/forcedotcom/salesforcedx-vscode/pull/3189))

- Fix metadata xml issues by removing the tooling api route for the new Deploy/Retrieve ([PR #3181](https://github.com/forcedotcom/salesforcedx-vscode/pull/3181))

- Surface original error with deploy/retrieve ([PR #3178](https://github.com/forcedotcom/salesforcedx-vscode/pull/3178))

# 51.10.0 - April 21, 2021

## Fixed

#### docs

- Update docs to reflect Apex library setting has been removed ([PR #3148](https://github.com/forcedotcom/salesforcedx-vscode/pull/3148))

#### salesforcedx-vscode-apex

- Update "All tests" option for `SFDX: Run Apex Tests` command to match CLI behavior ([PR #3126](https://github.com/forcedotcom/salesforcedx-vscode/pull/3126))

#### salesforcedx-vscode-core

- Fix issues with the following types for deploy/retrieve library ([PR #3147](https://github.com/forcedotcom/salesforcedx-vscode/pull/3147), [Issue #3114](https://github.com/forcedotcom/salesforcedx-vscode/issues/3114), [Issue #3157](https://github.com/forcedotcom/salesforcedx-vscode/issues/3157)):

  - AccountRelationshipShareRule
  - TimeSheetTemplate
  - WaveDashboard
  - WaveRecipe
  - WaveLens
  - WaveDataflow
  - WorkSkillRouting

- Remove Apex feature flag & delete CLI code path ([PR #3148](https://github.com/forcedotcom/salesforcedx-vscode/pull/3148))

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
