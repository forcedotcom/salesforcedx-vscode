# 49.9.0 - September 10, 2020
## Added

#### salesforcedx-vscode-apex
- Added support for the new [Safe Navigation Operator](https://releasenotes.docs.salesforce.com/en-us/winter21/release-notes/rn_apex_SafeNavigationOperator.htm) within the Apex Language Server Protocol ([PR #2507](https://github.com/forcedotcom/salesforcedx-vscode/pull/2507))

## Fixed

#### salesforcedx-vscode-lightning

- chore: update to latest lwc/aura lang server version ([PR #2495](https://github.com/forcedotcom/salesforcedx-vscode/pull/2495))

#### salesforcedx-vscode-lwc

- Update to the latest version of the Aura and LWC language servers ([PR #2495](https://github.com/forcedotcom/salesforcedx-vscode/pull/2495))

#### salesforcedx-vscode

- chore: changelog 49.8.0 updates ([PR #2486](https://github.com/forcedotcom/salesforcedx-vscode/pull/2486))

#### docs

- Updates to [Code Completion](https://developer.salesforce.com/tools/vscode/en/apex/writing) documentation ([PR #2471](https://github.com/forcedotcom/salesforcedx-vscode/pull/2471))

- Added [Community Extensions](https://developer.salesforce.com/tools/vscode/en/getting-started/recommended-extensions/#community-extensions) section ([PR #2477](https://github.com/forcedotcom/salesforcedx-vscode/pull/2477))

# 49.8.0 - September 2, 2020

## Added

#### salesforcedx-vscode-core

- Support deploying multiple components in [Performance Enhancements](https://developer.salesforce.com/tools/vscode/en/user-guide/perf-enhancements) ([PR #2450](https://github.com/forcedotcom/salesforcedx-vscode/pull/2450))
- Scaffolding commands using the new `@salesforce/templates` library ([PR #2428](https://github.com/forcedotcom/salesforcedx-vscode/pull/2428), [PR #2437](https://github.com/forcedotcom/salesforcedx-vscode/pull/2437))
  - `SFDX: Create Apex Class`
  - `SFDX: Create Apex Trigger`
  - `SFDX: Create Aura App`
  - `SFDX: Create Aura Component`
  - `SFDX: Create Aura Event`
  - `SFDX: Create Aura Interface`
  - `SFDX: Create Lightning Web Component`
  - `SFDX: Create Project`
  - `SFDX: Create Project with Manifest`
  - `SFDX: Create and Set Up Project for ISV Debugger`
  - `SFDX: Create Visualforce Component`
  - `SFDX: Create Visualforce Page`

## Fixed

#### salesforce-vscode-core

- Add `ProfilePasswordPolicy` and `ProfileSessionSetting` to Org Browser ([PR #2466](https://github.com/forcedotcom/salesforcedx-vscode/pull/2466), [Issue #2400](https://github.com/forcedotcom/salesforcedx-vscode/issues/2400))
- Reduce the number of SObjects being refreshed through the information message during startup ([PR #2467](https://github.com/forcedotcom/salesforcedx-vscode/pull/2467), [Issue #2410](https://github.com/forcedotcom/salesforcedx-vscode/issues/2410))

# 49.7.0 - August 27, 2020

## Fixed

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- Update to the latest version of the Aura and LWC language servers [PR #2380](https://github.com/forcedotcom/salesforcedx-vscode/pull/2380)

#### docs

- Fix example under [Advanced Setup](https://developer.salesforce.com/tools/vscode/en/getting-started/java-setup/#advanced-setup) on Java Setup page [PR #2426](https://github.com/forcedotcom/salesforcedx-vscode/pull/2426) - Contribution by ([@nabondance](https://github.com/nabondance))

# 49.6.0 - August 20, 2020

## Fixed

#### salesforcedx-vscode-core

- Prompts the user to remove stale files in an existing project when running the `SFDX: Create and Set Up Project for ISV Debugging` command ([PR #2407](https://github.com/forcedotcom/salesforcedx-vscode/pull/2407))

#### salesforcedx-sobjects-faux-generator

- Fix SObject refresh to ignore entities ending with Share, History, Feed and Event ([PR #2412](https://github.com/forcedotcom/salesforcedx-vscode/pull/2412))

# 49.5.0 - August 13, 2020

## Fixed

#### salesforcedx-vscode-apex

- Fix system assert snippets ([PR #2393](https://github.com/forcedotcom/salesforcedx-vscode/pull/2393)) - Contribution by ([@PawełWoźniak](https://github.com/PawelWozniak))

- Fix SObject refresh pop up when a project does not have a defaultusername ([PR #2396](https://github.com/forcedotcom/salesforcedx-vscode/pull/2396))

#### docs

- Update [Remote Development](https://developer.salesforce.com/tools/vscode/en/user-guide/remote-development/) doc ([PR #2402](https://github.com/forcedotcom/salesforcedx-vscode/pull/2402))

## Added

#### docs

- Add docs for [Using Windows Subsystem for Linux (WSL) 2](https://developer.salesforce.com/tools/vscode/en/user-guide/remote-development/#using-windows-subsystem-for-linux-wsl-2) ([PR #2388](https://github.com/forcedotcom/salesforcedx-vscode/pull/2388))

#### salesforcedx-vscode

- Include SLDS Validator extension in Salesforce Extension Pack ([PR #2245](https://github.com/forcedotcom/salesforcedx-vscode/pull/2245))

# 49.4.0 - August 6, 2020

## Fixed

#### salesforcedx-vscode-core

- Performance enhancements for `SFDX: Get Apex Debug Logs...` command ([PR #2353](https://github.com/forcedotcom/salesforcedx-vscode/pull/2353))

# 49.3.0 - July 30, 2020

## Added

#### salesforcedx-vscode-core

- Show message for missing SObject information at startup ([PR #2356](https://github.com/forcedotcom/salesforcedx-vscode/pull/2356))

- Update telemetry to include number of metadata types on a deploy ([PR #2355](https://github.com/forcedotcom/salesforcedx-vscode/pull/2355))

#### salesforcedx-vscode-lwc

- Show list of available devices for `SFDX: Preview Component Locally` command ([PR #2368](https://github.com/forcedotcom/salesforcedx-vscode/pull/2368))

# 49.2.0 - July 24, 2020

## Fixed

#### docs

- Update [Remote Development - Containers](https://developer.salesforce.com/tools/vscode/en/user-guide/remote-development/) to remove references to the sample repo. ([PR #2352](https://github.com/forcedotcom/salesforcedx-vscode/pull/2352))

#### salesforcedx-vscode-core

- We fixed some minor under-the-hood bugs.

- Fix `SFDX: Execute Anonymous Apex with Editor Contents` to work on untitled editors ([PR #2370](https://github.com/forcedotcom/salesforcedx-vscode/pull/2370), [Issue #2369](https://github.com/forcedotcom/salesforcedx-vscode/issues/2369))

# 49.1.0 - July 18, 2020

## Fixed

#### docs

- Replaced non-inclusive content ([PR #2323](https://github.com/forcedotcom/salesforcedx-vscode/pull/2323))

- Update prettier-plugin-apex documentation ([PR #2329](https://github.com/forcedotcom/salesforcedx-vscode/pull/2329), [Issue #2328](https://github.com/forcedotcom/salesforcedx-vscode/issues/2328))-Contribution by [@jefersonchaves](https://github.com/jefersonchaves)

#### salesforcedx-vscode-core

- Performance enhancements for `SFDX: Execute Anonymous Apex with Editor Contents` command ([PR #2291](https://github.com/forcedotcom/salesforcedx-vscode/pull/2291))

#### salesforcedx-vscode-lwc

- Support debugging LWC tests in VSCode's new JavaScript debugger ([PR #2345](https://github.com/forcedotcom/salesforcedx-vscode/pull/2345))
