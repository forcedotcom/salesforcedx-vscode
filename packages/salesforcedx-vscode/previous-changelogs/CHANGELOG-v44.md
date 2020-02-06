## 44.18.0 - January 31, 2019

### Fixed

#### salesforcedx-vscode-core

- Make push-or-deploy-on-save feature less overzealous, by pushing or deploying files only when they are saved ([PR #895](https://github.com/forcedotcom/salesforcedx-vscode/pull/895), [Issue #883](https://github.com/forcedotcom/salesforcedx-vscode/issues/883))

#### salesforcedx-vscode-apex

- Fix Apex Language Server to make it update stale references in files that have errors when the files are edited ([PR #905](https://github.com/forcedotcom/salesforcedx-vscode/pull/905))

## 44.17.0 - January 24, 2019

### Fixed

#### salesforcedx-vscode-core

- We fixed some minor under-the-hood bugs.

## 44.16.0 - January 17, 2019

### Added

#### salesforcedx-vscode-core

- Add username to Apex debug log entry list ([PR #864](https://github.com/forcedotcom/salesforcedx-vscode/pull/864), [Issue #834](https://github.com/forcedotcom/salesforcedx-vscode/issues/834))—Contribution by [@maaaaarco](https://github.com/maaaaarco)

### Fixed

#### salesforcedx-vscode-core

- Handle errors during extension activation that caused SFDX commands to fail when executed ([PR #868](https://github.com/forcedotcom/salesforcedx-vscode/pull/868), [Issue #742](https://github.com/forcedotcom/salesforcedx-vscode/issues/742))

## 44.15.0 - January 10, 2019

### Added

#### salesforcedx-vscode

- Add [Code of Conduct](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/CODE_OF_CONDUCT.md) ([PR #846](https://github.com/forcedotcom/salesforcedx-vscode/pull/846))

#### salesforcedx-vscode-apex

- Display results in Apex Tests sidebar for tests executed using code lens, Apex Tests sidebar, or command palette commands ([PR #800](https://github.com/forcedotcom/salesforcedx-vscode/pull/800))

- Show different options in Apex Tests sidebar’s right-click menu based on test status: **Go to Definition** for passing tests or **Display Error** for failing tests ([PR #811](https://github.com/forcedotcom/salesforcedx-vscode/pull/811))

#### salesforcedx-vscode-core

- Allow selecting a domain (production, sandbox, or custom) when running `SFDX: Authorize an Org` ([PR #818](https://github.com/forcedotcom/salesforcedx-vscode/pull/818), [Issue #610](https://github.com/forcedotcom/salesforcedx-vscode/issues/610))

- Push or deploy code on save when `salesforcedx-vscode-core.push-or-deploy-on-save.enabled` setting is `true` ([PR #822](https://github.com/forcedotcom/salesforcedx-vscode/pull/822), [Issue #577](https://github.com/forcedotcom/salesforcedx-vscode/issues/577), [Issue #662](https://github.com/forcedotcom/salesforcedx-vscode/issues/662))

### Fixed

#### salesforcedx-vscode-core

- Enable multi-line SOQL query selection for `SFDX: Execute SOQL Query with Currently Selected Text` ([PR #833](https://github.com/forcedotcom/salesforcedx-vscode/pull/833/files), [Issue #816](https://github.com/forcedotcom/salesforcedx-vscode/issues/816))—Contribution by [@boxfoot](https://github.com/boxfoot)

- Fix syntax highlighting for manifest XML files ([PR #823](https://github.com/forcedotcom/salesforcedx-vscode/pull/823))

## 44.11.0 - December 13, 2018

### Added

#### salesforcedx-vscode-core

- Two new commands for working with manifest files (such as `package.xml`): `SFDX: Deploy Source in Manifest to Org` and `SFDX: Retrieve Source in Manifest from Org` ([PR #795](https://github.com/forcedotcom/salesforcedx-vscode/pull/795))

- Set the duration of a scratch org when running `SFDX: Create a Default Scratch Org` ([PR #799](https://github.com/forcedotcom/salesforcedx-vscode/pull/799), [Issue #768](https://github.com/forcedotcom/salesforcedx-vscode/issues/768))—Contribution by [@renatoliveira](https://github.com/renatoliveira)

- Include timestamps for command executions in Output view ([PR #780](https://github.com/forcedotcom/salesforcedx-vscode/pull/780), [Issue #759](https://github.com/forcedotcom/salesforcedx-vscode/issues/759))

### Fixed

#### salesforcedx-vscode-apex

- Update Apex Test sidebar to use **Run Tests** hover text for whole classes ([PR #805](https://github.com/forcedotcom/salesforcedx-vscode/pull/805))

## 44.10.0 - December 6, 2018

### Fixed

#### salesforcedx-vscode-apex

- Alphabetically sort test classes displayed in Apex Tests sidebar ([PR #782](https://github.com/forcedotcom/salesforcedx-vscode/pull/782), [Issue #605](https://github.com/forcedotcom/salesforcedx-vscode/issues/605))—Contribution by [@0ff](https://github.com/0ff)

## 44.9.0 - November 29, 2018

### Fixed

#### salesforcedx-vscode-core

- Show better error message for `SFDX: Turn On Apex Debug Log for Replay Debugger` when updating a trace flag that is missing a debug level ([PR #765](https://github.com/forcedotcom/salesforcedx-vscode/pull/765), [Issue #761](https://github.com/forcedotcom/salesforcedx-vscode/issues/761))

## 44.8.0 - November 22, 2018

### Fixed

#### salesforcedx-vscode-core

- Fix start date when creating or updating a trace flag for the command `SFDX: Turn On Apex Debug Log for Replay Debugger` ([PR #743](https://github.com/forcedotcom/salesforcedx-vscode/pull/743), [Issue #710](https://github.com/forcedotcom/salesforcedx-vscode/issues/710))

#### salesforcedx-vscode-apex

- Fix `NullPointerException` in Apex Language Server that sometimes occurred during initialization ([PR #760](https://github.com/forcedotcom/salesforcedx-vscode/pull/760))

## 44.7.0 - November 15, 2018

### Added

#### salesforcedx-vscode-apex

- Beta for Apex Refactor: Rename capabilities ([PR #681](https://github.com/forcedotcom/salesforcedx-vscode/pull/681), [Apex Refactor: Rename (Beta)](https://forcedotcom.github.io/salesforcedx-vscode/articles/apex/refactoring))

### Fixed

#### salesforcedx-vscode-apex-debugger

- Update Apex Interactive Debugger initialization ([PR #732](https://github.com/forcedotcom/salesforcedx-vscode/pull/732), [PR #754](https://github.com/forcedotcom/salesforcedx-vscode/pull/754), [Issue #722](https://github.com/forcedotcom/salesforcedx-vscode/issues/722))

## 44.6.1 - November 9, 2018

### Fixed

#### salesforcedx-vscode-core

- Update API used for workspace path for commands `SFDX: Deploy This Source to Org` and `SFDX: Deploy Source to Org` ([PR #738](https://github.com/forcedotcom/salesforcedx-vscode/pull/738), [Issue #737](https://github.com/forcedotcom/salesforcedx-vscode/issues/737))

## 44.6.0 - November 8, 2018

### Added

#### salesforcedx-vscode-core

- Include deployment errors in the Problems view for `SFDX: Deploy This Source to Org` and `SFDX: Deploy Source to Org` commands ([PR #717](https://github.com/forcedotcom/salesforcedx-vscode/pull/717), [Issue #588](https://github.com/forcedotcom/salesforcedx-vscode/issues/588))—Contribution by [@ChuckJonas](https://github.com/ChuckJonas)
- Validate JSON schema for `sfdx-project.json` and `project-scratch-def.json` files ([PR #719](https://github.com/forcedotcom/salesforcedx-vscode/pull/719), [Issue #287](https://github.com/forcedotcom/salesforcedx-vscode/issues/287))

## 44.5.0 - November 1, 2018

### Fixed

#### salesforcedx-vscode-apex-replay-debugger

- We fixed some minor under-the-hood bugs.

## 44.4.0 - October 25, 2018

### Fixed

#### salesforcedx-vscode-apex

- Report accurate test results in Apex Tests sidebar ([PR #683](https://github.com/forcedotcom/salesforcedx-vscode/pull/683), [Issue #645](https://github.com/forcedotcom/salesforcedx-vscode/issues/645))

#### salesforcedx-vscode

- Fix typo in scripts ([PR #682](https://github.com/forcedotcom/salesforcedx-vscode/pull/682))—Contribution by [@hasantayyar](https://github.com/hasantayyar)

## 44.3.0 - October 18, 2018

### Fixed

#### salesforcedx-vscode-apex

- We fixed some minor under-the-hood bugs.

## 44.2.0 - October 13, 2018

### Added

#### salesforcedx-vscode-core

- Open beta for Org Development commands ([PR #669](https://github.com/forcedotcom/salesforcedx-vscode/pull/669), _Salesforce Winter ’19 Release Notes_: [Develop Against Any Org in Visual Studio Code (Beta)](https://releasenotes.docs.salesforce.com/en-us/winter19/release-notes/rn_vscode_any_org.htm))

#### salesforcedx-vscode-apex-replay-debugger

- Apex Replay Debugger generally available ([PR #664](https://github.com/forcedotcom/salesforcedx-vscode/pull/664), _Salesforce Winter ’19 Release Notes_: [Debug All Your Orgs for Free with Apex Replay Debugger (Generally Available)](https://releasenotes.docs.salesforce.com/en-us/winter19/release-notes/rn_vscode_replay_debugger.htm))

### Fixed

#### salesforcedx-vscode-apex-replay-debugger

- Fix incorrect variable values when parameters have the same names as the object properties ([PR #663](https://github.com/forcedotcom/salesforcedx-vscode/pull/663))
- Correctly parse values for circular references ([PR #659](https://github.com/forcedotcom/salesforcedx-vscode/pull/659))
- Correctly display static variables after processing breakpoints ([PR #657](https://github.com/forcedotcom/salesforcedx-vscode/pull/657))
- Fix trace flag creation when running `SFDX: Turn On Apex Debug Log for Replay Debugger` with non-scratch orgs ([PR #656](https://github.com/forcedotcom/salesforcedx-vscode/pull/656))
