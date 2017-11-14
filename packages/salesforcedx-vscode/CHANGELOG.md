## 41.8.0 - November 16, 2017
### Added

#### salesforcedx-vscode-core

* Option to run a single Apex test class synchronously (*Requires v41.8.0 of the Salesforce CLI*) ([PR #206](https://github.com/forcedotcom/salesforcedx-vscode/pull/206))
* SFDX: Create Project ([PR #197](https://github.com/forcedotcom/salesforcedx-vscode/pull/197))
* SFDX: Refresh SObject Definitions (Enables code smartness in Apex for sObjects: [Read more](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex))

### Fixed
#### salesforcedx-vscode-apex-debugger

* Paginate collections in variables view ([PR #209](https://github.com/forcedotcom/salesforcedx-vscode/pull/209))

## 41.6.0 - November 2, 2017

### Added
#### salesforcedx-vscode

* Change name to `Salesforce Extensions for VS Code` ([PR #192](https://github.com/forcedotcom/salesforcedx-vscode/pull/192))

### Fixed
#### salesforcedx-vscode-apex-debugger

* Fix timeout issue when starting a debugger session ([PR #194](https://github.com/forcedotcom/salesforcedx-vscode/pull/194))

#### salesforcedx-vscode-visualforce

* Support proper formatting with Cmd+/ (macOS) or Ctrl+/ (Linux and Windows) in embedded CSS and JavaScript within Visualforce files ([PR #200](https://github.com/forcedotcom/salesforcedx-vscode/pull/200))

## 41.5.0 - October 25, 2017

### Added
### salesforcedx-vscode

* Update the minimum VS Code version to 1.17 ([PR #187](https://github.com/forcedotcom/salesforcedx-vscode/pull/187))

### Fixed
#### salesforcedx-vscode-visualforce

* Remove non-public attributes from Visualforce tags ([PR #188](https://github.com/forcedotcom/salesforcedx-vscode/pull/188))

## 41.4.0 - October 19, 2017

### Added
### salesforcedx-vscode-visualforce

* Code completion for standard Visualforce components ([PR #180](https://github.com/forcedotcom/salesforcedx-vscode/pull/180))

### Fixed
#### salesforcedx-vscode-apex-debugger

* Default type of `requestTypeFilter` in `launch.json` is an array ([PR #168](https://github.com/forcedotcom/salesforcedx-vscode/pull/168))
* Fix timing issue when showing the callstack ([PR #168](https://github.com/forcedotcom/salesforcedx-vscode/pull/168))

## 41.3.0 - October 14, 2017

### Added
#### salesforcedx-vscode-apex-debugger

* Apex Debugger extension for VS Code ([Read more](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-apex-debugger))

#### salesforcedx-vscode-core

* Alias prompt for command `SFDX: Create a Default Scratch Org...` ([PR #157](https://github.com/forcedotcom/salesforcedx-vscode/pull/157))

## 40.13.0 - October 5, 2017

### Added
#### salesforcedx-vscode-core

* SFDX: Execute SOQL Query... ([PR #149](https://github.com/forcedotcom/salesforcedx-vscode/pull/149))
* SFDX: Execute SOQL Query with Currently Selected Text ([PR #149](https://github.com/forcedotcom/salesforcedx-vscode/pull/149))
* SFDX: Execute Anonymous Apex with Editor Contents ([PR #152](https://github.com/forcedotcom/salesforcedx-vscode/pull/152))
* SFDX: Execute Anonymous Apex with Currently Selected Text ([PR #152](https://github.com/forcedotcom/salesforcedx-vscode/pull/152))

## 40.12.0 - September 28, 2017

### Added
#### salesforcedx-vscode-core

* SFDX: Display Org Details... ([PR #131](https://github.com/forcedotcom/salesforcedx-vscode/pull/131))
* SFDX: Display Org Details for Default Scratch Org ([PR #116](https://github.com/forcedotcom/salesforcedx-vscode/pull/116))
* SFDX: List All Aliases ([PR #116](https://github.com/forcedotcom/salesforcedx-vscode/pull/116))
* SFDX: List All Config Variables ([PR #116](https://github.com/forcedotcom/salesforcedx-vscode/pull/116))
* SFDX: Pull Source from Default Scratch Org and Override Conflicts ([PR #127](https://github.com/forcedotcom/salesforcedx-vscode/pull/127))
* SFDX: Push Source to Default Scratch Org and Override Conflicts ([PR #125](https://github.com/forcedotcom/salesforcedx-vscode/pull/125))

## 40.11.0 - September 21, 2017

### Added
#### salesforcedx-vscode-apex

* Go To Definition feature for Apex methods, properties, constructors, and class variables across Apex files. ([PR #114](https://github.com/forcedotcom/salesforcedx-vscode/pull/114))

#### salesforcedx-vscode-lightning

* Salesforce Lightning Design System (SLDS) linter for deprecated CSS class names. ([PR #101](https://github.com/forcedotcom/salesforcedx-vscode/pull/101))

### Fixed
#### salesforcedx-vscode-core

* Wizards warn about overwriting an existing file. ([PR #106](https://github.com/forcedotcom/salesforcedx-vscode/pull/106))
* Suggest only 'aura' subdirectories for Lightning wizard commands. ([PR #113](https://github.com/forcedotcom/salesforcedx-vscode/pull/113))

## 40.10.0 - September 14, 2017

### Added
#### salesforcedx-vscode-apex

* Go To Definition feature for Apex methods and constructors within the current file. ([PR #104](https://github.com/forcedotcom/salesforcedx-vscode/pull/104))

#### salesforcedx-vscode-core

* SFDX: View Local Changes command ([PR #102](https://github.com/forcedotcom/salesforcedx-vscode/pull/102))
* SFDX: View Changes in Default Scratch Org command ([PR #102](https://github.com/forcedotcom/salesforcedx-vscode/pull/102))

## 40.9.0 - September 7, 2017

### Added
#### salesforcedx-vscode-apex

* Go To Definition feature for Apex fields, properties, local variables, and method parameters within the current file. ([PR #88](https://github.com/forcedotcom/salesforcedx-vscode/pull/88))
## 40.8.0 - August 31, 2017

### Added
#### salesforcedx-vscode-core

* SFDX: Create Lightning App command ([PR #62](https://github.com/forcedotcom/salesforcedx-vscode/pull/62))
* SFDX: Create Lightning Component command ([PR #70](https://github.com/forcedotcom/salesforcedx-vscode/pull/70))
* SFDX: Create Lightning Event command ([PR #76](https://github.com/forcedotcom/salesforcedx-vscode/pull/76))
* SFDX: Create Lightning Interface command ([PR #77](https://github.com/forcedotcom/salesforcedx-vscode/pull/77))
## 40.7.0 - August 24, 2017

### Changed
    
#### salesforcedx-vscode-apex

* Switched the Apex Language Server to use standard input/output instead of creating a local socket ([PR #53](https://github.com/forcedotcom/salesforcedx-vscode/pull/53)).

### Added
#### salesforcedx-vscode-core

* SFDX: Create Apex Class command ([PR #47](https://github.com/forcedotcom/salesforcedx-vscode/pull/47))
* SFDX: Create Visualforce Component and SFDX: Create Visualforce Page commands ([PR #55](https://github.com/forcedotcom/salesforcedx-vscode/pull/55))
## 40.5.0 - August 10, 2017

### Bug Fixes
    
#### salesforcedx-vscode-apex

* Fixed the way entries are stored in the database to prevent errors when upgrading to the latest version of the extension ([PR #42](https://github.com/forcedotcom/salesforcedx-vscode/pull/42), [PR #43](https://github.com/forcedotcom/salesforcedx-vscode/pull/43)).

#### salesforcedx-vscode-core

* The command SFDX: Create a Default Scratch Org now looks for `*-scratch-def.json` files only in the `config` directory and its children ([PR #41](https://github.com/forcedotcom/salesforcedx-vscode/pull/41)).
* SFDX commands appear in the command palette only when a directory open in a VS Code window contains an `sfdx-project.json` file ([PR #40](https://github.com/forcedotcom/salesforcedx-vscode/pull/40#issuecomment-320560173)).
