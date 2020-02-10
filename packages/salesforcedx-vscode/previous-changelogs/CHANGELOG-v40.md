## 40.13.0 - October 5, 2017

### Added

#### salesforcedx-vscode-core

- SFDX: Execute SOQL Query... ([PR #149](https://github.com/forcedotcom/salesforcedx-vscode/pull/149))
- SFDX: Execute SOQL Query with Currently Selected Text ([PR #149](https://github.com/forcedotcom/salesforcedx-vscode/pull/149))
- SFDX: Execute Anonymous Apex with Editor Contents ([PR #152](https://github.com/forcedotcom/salesforcedx-vscode/pull/152))
- SFDX: Execute Anonymous Apex with Currently Selected Text ([PR #152](https://github.com/forcedotcom/salesforcedx-vscode/pull/152))

## 40.12.0 - September 28, 2017

### Added

#### salesforcedx-vscode-core

- SFDX: Display Org Details... ([PR #131](https://github.com/forcedotcom/salesforcedx-vscode/pull/131))
- SFDX: Display Org Details for Default Scratch Org ([PR #116](https://github.com/forcedotcom/salesforcedx-vscode/pull/116))
- SFDX: List All Aliases ([PR #116](https://github.com/forcedotcom/salesforcedx-vscode/pull/116))
- SFDX: List All Config Variables ([PR #116](https://github.com/forcedotcom/salesforcedx-vscode/pull/116))
- SFDX: Pull Source from Default Scratch Org and Override Conflicts ([PR #127](https://github.com/forcedotcom/salesforcedx-vscode/pull/127))
- SFDX: Push Source to Default Scratch Org and Override Conflicts ([PR #125](https://github.com/forcedotcom/salesforcedx-vscode/pull/125))

## 40.11.0 - September 21, 2017

### Added

#### salesforcedx-vscode-apex

- Go To Definition feature for Apex methods, properties, constructors, and class variables across Apex files. ([PR #114](https://github.com/forcedotcom/salesforcedx-vscode/pull/114))

#### salesforcedx-vscode-lightning

- Salesforce Lightning Design System (SLDS) linter for deprecated CSS class names. ([PR #101](https://github.com/forcedotcom/salesforcedx-vscode/pull/101))

### Fixed

#### salesforcedx-vscode-core

- Wizards warn about overwriting an existing file. ([PR #106](https://github.com/forcedotcom/salesforcedx-vscode/pull/106))
- Suggest only 'aura' subdirectories for Lightning wizard commands. ([PR #113](https://github.com/forcedotcom/salesforcedx-vscode/pull/113))

## 40.10.0 - September 14, 2017

### Added

#### salesforcedx-vscode-apex

- Go To Definition feature for Apex methods and constructors within the current file. ([PR #104](https://github.com/forcedotcom/salesforcedx-vscode/pull/104))

#### salesforcedx-vscode-core

- SFDX: View Local Changes command ([PR #102](https://github.com/forcedotcom/salesforcedx-vscode/pull/102))
- SFDX: View Changes in Default Scratch Org command ([PR #102](https://github.com/forcedotcom/salesforcedx-vscode/pull/102))

## 40.9.0 - September 7, 2017

### Added

#### salesforcedx-vscode-apex

- Go To Definition feature for Apex fields, properties, local variables, and method parameters within the current file. ([PR #88](https://github.com/forcedotcom/salesforcedx-vscode/pull/88))

## 40.8.0 - August 31, 2017

### Added

#### salesforcedx-vscode-core

- SFDX: Create Lightning App command ([PR #62](https://github.com/forcedotcom/salesforcedx-vscode/pull/62))
- SFDX: Create Lightning Component command ([PR #70](https://github.com/forcedotcom/salesforcedx-vscode/pull/70))
- SFDX: Create Lightning Event command ([PR #76](https://github.com/forcedotcom/salesforcedx-vscode/pull/76))
- SFDX: Create Lightning Interface command ([PR #77](https://github.com/forcedotcom/salesforcedx-vscode/pull/77))

## 40.7.0 - August 24, 2017

### Changed

#### salesforcedx-vscode-apex

- Switched the Apex Language Server to use standard input/output instead of creating a local socket ([PR #53](https://github.com/forcedotcom/salesforcedx-vscode/pull/53)).

### Added

#### salesforcedx-vscode-core

- SFDX: Create Apex Class command ([PR #47](https://github.com/forcedotcom/salesforcedx-vscode/pull/47))
- SFDX: Create Visualforce Component and SFDX: Create Visualforce Page commands ([PR #55](https://github.com/forcedotcom/salesforcedx-vscode/pull/55))

## 40.5.0 - August 10, 2017

### Bug Fixes

#### salesforcedx-vscode-apex

- Fixed the way entries are stored in the database to prevent errors when upgrading to the latest version of the extension ([PR #42](https://github.com/forcedotcom/salesforcedx-vscode/pull/42), [PR #43](https://github.com/forcedotcom/salesforcedx-vscode/pull/43)).

#### salesforcedx-vscode-core

- The command SFDX: Create a Default Scratch Org now looks for `*-scratch-def.json` files only in the `config` directory and its children ([PR #41](https://github.com/forcedotcom/salesforcedx-vscode/pull/41)).
- SFDX commands appear in the command palette only when a directory open in a VS Code window contains an `sfdx-project.json` file ([PR #40](https://github.com/forcedotcom/salesforcedx-vscode/pull/40#issuecomment-320560173)).
