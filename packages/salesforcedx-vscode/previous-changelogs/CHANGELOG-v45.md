## 45.15.1 - May 17, 2019

### Fixed

#### salesforcedx-vscode-apex

- Apex language server accurately reports the location of a Trigger definition ([PR #1346](https://github.com/forcedotcom/salesforcedx-vscode/pull/1346))

#### salesforcedx-vscode-core

- Fix an edge case where not having an alias for a Dev Hub makes scratch orgs fail to load in the org picker ([PR #1352](https://github.com/forcedotcom/salesforcedx-vscode/pull/1352))

## 45.15.0 - May 16, 2019

### Added

#### salesforcedx-vscode/docs

- Add [Apex Quick Fix](https://forcedotcom.github.io/salesforcedx-vscode/articles/apex/quick-fix) doc re: how to declare missing methods

#### salesforcedx-vscode-apex

- Add `Declare missing method` quick fix option ([PR #1334](https://github.com/forcedotcom/salesforcedx-vscode/pull/1334))

### Fixed

#### salesforcedx-vscode-core

- Update command context to address SFDX commands not showing after creating scratch orgs ([PR #1327](https://github.com/forcedotcom/salesforcedx-vscode/pull/1327), [Issue #1196](https://github.com/forcedotcom/salesforcedx-vscode/issues/1196))
- Remove `No default org set` warning message when opening the org picker ([PR #1329](https://github.com/forcedotcom/salesforcedx-vscode/pull/1329))

#### salesforcedx-vscode-apex

- Cache most recent code compilation when users trigger code action features like Hover, Apex Rename, Go To Definition, Find All References, etc. ([PR #1334](https://github.com/forcedotcom/salesforcedx-vscode/pull/1334))

## 45.14.0 - May 9, 2019

### Added

#### salesforcedx-vscode

- Reference the change log at the top level of the repository ([PR #1304](https://github.com/forcedotcom/salesforcedx-vscode/pull/1304), [Issue #1292](https://github.com/forcedotcom/salesforcedx-vscode/issues/1292))

### Fixed

#### salesforcedx-vscode-core

- When running `SFDX: Turn On Apex Debug Log for Replay Debugger`, show trace flags only for the user that Salesforce CLI is authenticated with ([PR #1315](https://github.com/forcedotcom/salesforcedx-vscode/pull/1315), [Issue #1285](https://github.com/forcedotcom/salesforcedx-vscode/issues/1285), [Issue #1280](https://github.com/forcedotcom/salesforcedx-vscode/issues/1280))
- When running commands to create metadata, show only directories within package directories as available locations ([PR #1288](https://github.com/forcedotcom/salesforcedx-vscode/pull/1288), [Issue #1206](https://github.com/forcedotcom/salesforcedx-vscode/issues/1206))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- Use system version of Node.js when launching Aura Language Server and LWC Language Server ([PR #1305](https://github.com/forcedotcom/salesforcedx-vscode/pull/1305))
- Show method icon for LWC component methods in Lightning Explorer ([PR #1305](https://github.com/forcedotcom/salesforcedx-vscode/pull/1305))
- Display message in Lightning Explorer when no components are found ([PR #1305](https://github.com/forcedotcom/salesforcedx-vscode/pull/1305))
- Filter Aura and LWC system namespaces for unknown workspaces in Lightning Explorer when no custom components are detected ([PR #1305](https://github.com/forcedotcom/salesforcedx-vscode/pull/1305))

## 45.13.0 - May 2, 2019

### Added

#### salesforcedx-vscode-apex

- Add support for Java 11 ([PR #1275](https://github.com/forcedotcom/salesforcedx-vscode/pull/1275))

### Fixed

#### salesforcedx-vscode-core

- Remove references to `workspace.rootPath`, which is deprecated; use `workspace.workspaceFolders` instead ([PR #1260](https://github.com/forcedotcom/salesforcedx-vscode/pull/1260))

## 45.12.1 - April 25, 2019

### Fixed

#### salesforcedx-vscode-apex

- Enable Apex debuggers to get the latest status from Apex Language Server ([PR #1290](https://github.com/forcedotcom/salesforcedx-vscode/pull/1290), [Issue #1289](https://github.com/forcedotcom/salesforcedx-vscode/issues/1289))

## 45.12.0 - April 25, 2019

### Added

#### salesforcedx-vscode/docs

- Update Prettier installation instructions to use the latest release ([PR #1263](https://github.com/forcedotcom/salesforcedx-vscode/pull/1263))

#### salesforcedx-vscode-core

- Show which default username is in use ([PR #1259](https://github.com/forcedotcom/salesforcedx-vscode/pull/1259))
- Use the `standard` template value (`sfdx force:project:create --template standard`) when creating projects ([PR #1234](https://github.com/forcedotcom/salesforcedx-vscode/pull/1234), [Issue #1090](https://github.com/forcedotcom/salesforcedx-vscode/issues/1090)):
  - `SFDX: Create Project`
  - `SFDX: Create Project with Manifest`
  - `SFDX: Create and Set Up Project for ISV Debugger`

### Fixed

#### salesforcedx-vscode-apex

- Activate Apex extension even when Java is misconfigured ([PR #1261](https://github.com/forcedotcom/salesforcedx-vscode/pull/1261), [Issue #809](https://github.com/forcedotcom/salesforcedx-vscode/issues/809))
- Handle Apex Language Server’s sObject checks on Windows ([PR #1276](https://github.com/forcedotcom/salesforcedx-vscode/pull/1276), [Issue #1269](https://github.com/forcedotcom/salesforcedx-vscode/issues/1269), [Issue #1170](https://github.com/forcedotcom/salesforcedx-vscode/issues/1170))
- Change name of setting that enables sObject refresh on startup to `salesforcedx-vscode-apex.enable-sobject-refresh-on-startup` ([PR #1236](https://github.com/forcedotcom/salesforcedx-vscode/pull/1236))

#### salesforcedx-vscode-core

- Support uppercase package names in `sfdx-project.json` ([PR #1277](https://github.com/forcedotcom/salesforcedx-vscode/pull/1277), [Issue #1266](https://github.com/forcedotcom/salesforcedx-vscode/issues/1266))

#### salesforcedx-vscode-lightning

- Start Lightning Language Server asynchronously ([PR #1253](https://github.com/forcedotcom/salesforcedx-vscode/pull/1253))
- Support different extension activation modes: `always`, `autodetect`, and `off` ([PR #1253](https://github.com/forcedotcom/salesforcedx-vscode/pull/1253))

## 45.10.0 - April 10, 2019

### Fixed

#### salesforcedx-vscode-apex

- Fix NullPointerException when Apex language server processes references ([PR #1245](https://github.com/forcedotcom/salesforcedx-vscode/pull/1245))

#### salesforcedx-vscode-apex-debugger, salesforcedx-vscode-apex-replay-debugger

- Update dependency to address security vulnerability ([PR #1230](https://github.com/forcedotcom/salesforcedx-vscode/pull/1230))

#### salesforcedx-vscode-core

- Expose SFDX: Create commands only on source files’ default directories when right-clicking folders in the File Explorer ([PR #1235](https://github.com/forcedotcom/salesforcedx-vscode/pull/1235), [Issue #852](https://github.com/forcedotcom/salesforcedx-vscode/issues/852)):
  - `SFDX: Create Apex Class`
  - `SFDX: Create Apex Trigger`
  - `SFDX: Create Visualforce Component`
  - `SFDX: Create Visualforce Page`

#### salesforcedx-vscode-lightning

- Stop extension from overwriting `settings.json` contents ([PR #1254](https://github.com/forcedotcom/salesforcedx-vscode/pull/1254), [Issue #1210](https://github.com/forcedotcom/salesforcedx-vscode/issues/1210))

## 45.9.0 - April 4, 2019

### Added

#### salesforcedx-vscode/docs

- Add [Set Up the Prettier Code Formatter for Salesforce Projects](https://forcedotcom.github.io/salesforcedx-vscode/articles/getting-started/prettier) article ([PR #1208](https://github.com/forcedotcom/salesforcedx-vscode/pull/1208))
- Show the statuses of the project’s dependencies ([PR #1218](https://github.com/forcedotcom/salesforcedx-vscode/pull/1218))

#### salesforcedx-vscode-core

- Include org development commands in command palette ([PR #1190](https://github.com/forcedotcom/salesforcedx-vscode/pull/1190), [Issue #662](https://github.com/forcedotcom/salesforcedx-vscode/issues/662), [Issue #918](https://github.com/forcedotcom/salesforcedx-vscode/issues/918)):
  - `SFDX: Deploy Source in Manifest to Org`
  - `SFDX: Retrieve Source in Manifest from Org`
  - `SFDX: Delete from Project and Org`
  - `SFDX: Deploy Source to Org`
  - `SFDX: Retrieve Source From Org`

### Fixed

#### salesforcedx-vscode-apex

- Add missing closing bracket on `testMethod` Apex snippet ([PR #1219](https://github.com/forcedotcom/salesforcedx-vscode/pull/1219))—Contribution by [@1ktribble](https://github.com/1ktribble)

#### salesforcedx-vscode-core

- Add a menu for selecting an output directory for commands that create metadata from a template; create the `default` directory, if it doesn’t exist, when running these commands ([PR #1187](https://github.com/forcedotcom/salesforcedx-vscode/pull/1187), [Issue #852](https://github.com/forcedotcom/salesforcedx-vscode/issues/852), [Issue #998](https://github.com/forcedotcom/salesforcedx-vscode/issues/998))
- Update command execution telemetry when directory type is included ([PR #1225](https://github.com/forcedotcom/salesforcedx-vscode/pull/1225))

## 45.8.0 - March 28, 2019

### Added

#### salesforcedx-vscode-lightning

- Add Aura Language Server: Support Go to Definition, autocompletion, and showing documentation on hover ([PR #1183](https://github.com/forcedotcom/salesforcedx-vscode/pull/1183))

### Fixed

#### salesforcedx-vscode-apex

- Fix threading issues in Apex Language Server’s CompilerService ([PR #1173](https://github.com/forcedotcom/salesforcedx-vscode/pull/1173), [Issue #867](https://github.com/forcedotcom/salesforcedx-vscode/issues/867))

#### salesforcedx-vscode-core

- Prevent Output panel from stealing focus during command execution ([PR #1181](https://github.com/forcedotcom/salesforcedx-vscode/pull/1181), [Issue #1110](https://github.com/forcedotcom/salesforcedx-vscode/issues/1110))

#### salesforcedx-vscode-lightning

- Remove deprecated SLDS linter ([PR #1191](https://github.com/forcedotcom/salesforcedx-vscode/pull/1191))

## 45.7.0 - March 21, 2019

### Added

#### salesforcedx-vscode/docs

- Add troubleshooting information about Apex compilation during deployments ([PR #1150](https://github.com/forcedotcom/salesforcedx-vscode/pull/1150))

#### salesforcedx-vscode-apex

- Visually display Apex code coverage ([PR #1145](https://github.com/forcedotcom/salesforcedx-vscode/pull/1145), [Issue #973](https://github.com/forcedotcom/salesforcedx-vscode/issues/973))
- Collect telemetry data for Apex Language Server ([PR #1148](https://github.com/forcedotcom/salesforcedx-vscode/pull/1148))

#### salesforcedx-vscode-lwc

- Include execution time in telemetry for `SFDX: Create Lightning Web Component` command ([PR #1154](https://github.com/forcedotcom/salesforcedx-vscode/pull/1154))

### Fixed

#### salesforcedx-vscode-apex

- Improve Apex Tests sidebar performance when refreshing tests ([PR #1144](https://github.com/forcedotcom/salesforcedx-vscode/pull/1144), [Issue #1103](https://github.com/forcedotcom/salesforcedx-vscode/issues/1103))
- Update Apex snippets to respect user’s indentation configuration ([PR #1158](https://github.com/forcedotcom/salesforcedx-vscode/pull/1158), [Issue #1152](https://github.com/forcedotcom/salesforcedx-vscode/issues/1152))—Contribution by [@Gkupce](https://github.com/Gkupce)

#### salesforcedx-vscode-core

- Improve performance for [org picker and `SFDX: Set a Default Org` command](https://forcedotcom.github.io/salesforcedx-vscode/articles/user-guide/default-org) ([PR #1139](https://github.com/forcedotcom/salesforcedx-vscode/pull/1139), [Issue #1007](https://github.com/forcedotcom/salesforcedx-vscode/issues/1007))

## 45.6.0 - March 14, 2019

### Added

#### salesforcedx-vscode-core

- Display `source:push` error messages in Problems view ([PR #1117](https://github.com/forcedotcom/salesforcedx-vscode/pull/1117))
- Add CPUs and total system memory information to telemetry ([PR #1119](https://github.com/forcedotcom/salesforcedx-vscode/pull/1119))

### Fixed

#### salesforcedx-vscode-apex

- Enable `SFDX: Re-Run Last Invoked Apex Test Class` and `SFDX: Re-Run Last Invoked Apex Test Method` commands to work with Apex Tests sidebar ([PR #1135](https://github.com/forcedotcom/salesforcedx-vscode/pull/1135), [Issue #962](https://github.com/forcedotcom/salesforcedx-vscode/issues/962))

#### salesforcedx-vscode-core

- Enabling or disabling push-or-deploy-on-save feature does not require reloading VS Code ([PR #1129](https://github.com/forcedotcom/salesforcedx-vscode/pull/1129))

## 45.5.0 - March 7, 2019

### Added

#### salesforcedx-vscode-apex

- Show Apex block comment information when hovering on symbols ([PR #1106](https://github.com/forcedotcom/salesforcedx-vscode/pull/1106))

### Fixed

#### salesforcedx-vscode/docs

- Fix typos in Org Development Model documentation ([PR #1089](https://github.com/forcedotcom/salesforcedx-vscode/pull/1089))—Contribution by [@tet3](https://github.com/tet3)

#### salesforcedx-vscode-apex

- Fix Apex Language Server performance issues that caused high CPU load:
  - Handle document change requests queuing up ([PR #1086](https://github.com/forcedotcom/salesforcedx-vscode/pull/1086), [Issue #1047](https://github.com/forcedotcom/salesforcedx-vscode/issues/1047))
  - Compile only necessary files when running a refactoring operation ([PR #1118](https://github.com/forcedotcom/salesforcedx-vscode/pull/1118), [Issue #1100](https://github.com/forcedotcom/salesforcedx-vscode/issues/1100))
- Include a link to our documentation in the information messages that appear when Java isn’t set up correctly ([PR #1116](https://github.com/forcedotcom/salesforcedx-vscode/pull/1116))

#### salesforcedx-vscode-core

- Remove information message asking to allow configuraton changes on terminal when opening a new Salesforce DX project ([PR #1062](https://github.com/forcedotcom/salesforcedx-vscode/pull/1062))
- Display human-readable `source:deploy` messages in Output view ([PR #1085](https://github.com/forcedotcom/salesforcedx-vscode/pull/1085))
- Allow extensions to activate when Salesforce CLI isn’t installed ([PR #1107](https://github.com/forcedotcom/salesforcedx-vscode/pull/1107))

## 45.3.0 - February 22, 2019

### Added

#### salesforcedx-vscode-core

- Add `salesforcedx-vscode-core.enable-sobject-refresh-on-startup` setting to control initial refresh of sObject definitions ([PR #1079](https://github.com/forcedotcom/salesforcedx-vscode/pull/1079))

### Fixed

#### salesforcedx-vscode

- Update search and analytics on the [documentation site](https://forcedotcom.github.io/salesforcedx-vscode) ([PR #1074](https://github.com/forcedotcom/salesforcedx-vscode/pull/1074))

#### salesforcedx-vscode-core

- Change the telemetry documentation URL to the documentation site’s [FAQ: Telemetry](https://forcedotcom.github.io/salesforcedx-vscode/articles/faq/telemetry) article’s URL ([PR #1059](https://github.com/forcedotcom/salesforcedx-vscode/pull/1059))

#### salesforcedx-vscode-apex

- Fix Apex Language Server performance issue that caused high CPU load: Run `updateTypeInfos` only on latest doc version ([PR #1093](https://github.com/forcedotcom/salesforcedx-vscode/pull/1093), [Issue #1047](https://github.com/forcedotcom/salesforcedx-vscode/issues/1047))

## 45.2.0 - February 14, 2019

### Added

#### salesforcedx-vscode

- Replace the project’s wiki and the docs on the extensions’ Visual Studio Marketplace pages with a new [GitHub Pages site](https://forcedotcom.github.io/salesforcedx-vscode) ([PR #853](https://github.com/forcedotcom/salesforcedx-vscode/pull/853))

#### salesforcedx-vscode-apex

- Update standard Apex symbols to API v45.0 ([PR #1037](https://github.com/forcedotcom/salesforcedx-vscode/pull/1037))

### Fixed

#### salesforcedx-vscode-apex

- Prevent using Apex Refactor: Rename on `System` symbols ([PR #1037](https://github.com/forcedotcom/salesforcedx-vscode/pull/1037))

## 45.1.0 - February 9, 2019

### Added

#### salesforcedx-vscode

- Include LWC extension in Salesforce Extension Pack ([PR #1015](https://github.com/forcedotcom/salesforcedx-vscode/pull/1015))

#### salesforcedx-vscode-apex

- Apex Refactor: Rename is generally available ([PR #984](https://github.com/forcedotcom/salesforcedx-vscode/pull/984), [PR #980](https://github.com/forcedotcom/salesforcedx-vscode/pull/980))

#### salesforcedx-vscode-core

- Change your default org from the VS Code footer ([PR #890](https://github.com/forcedotcom/salesforcedx-vscode/pull/890), [Issue #944](https://github.com/forcedotcom/salesforcedx-vscode/issues/944))
- Automatically refresh sObject definitions on extension activation ([PR #986](https://github.com/forcedotcom/salesforcedx-vscode/pull/986))
- Include execution time in command execution telemetry ([PR #989](https://github.com/forcedotcom/salesforcedx-vscode/pull/989))
- Add syntax highlighting for Einstein Analytics and IoT files ([PR #1003](https://github.com/forcedotcom/salesforcedx-vscode/pull/1003), [Issue #1002](https://github.com/forcedotcom/salesforcedx-vscode/issues/1002))

### Fixed

#### salesforcedx-vscode-apex

- Update test run icon in Apex Tests sidebar to be consistent with official VS Code icons ([PR #988](https://github.com/forcedotcom/salesforcedx-vscode/pull/988))
- Prevent Apex Language Server from running in anonymous Apex (`.apex`) files ([PR #1001](https://github.com/forcedotcom/salesforcedx-vscode/pull/1001), [Issue #929](https://github.com/forcedotcom/salesforcedx-vscode/issues/929))
- Fix Apex rename and codelens exceptions and update rename error messages ([PR #1014](https://github.com/forcedotcom/salesforcedx-vscode/pull/1014))

#### salesforcedx-vscode-core

- Speed up extension activation time ([PR #889](https://github.com/forcedotcom/salesforcedx-vscode/pull/889))
- Make push-or-deploy-on-save feature respect new `packageDirectories` values added to `sfdx-project.json` ([PR #987](https://github.com/forcedotcom/salesforcedx-vscode/pull/987))
- Keep errors in Problems view until next deployment ([PR #1016](https://github.com/forcedotcom/salesforcedx-vscode/pull/1016))
