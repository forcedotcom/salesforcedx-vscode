## 41.18.0 - January 22, 2018

### Fixed

#### salesforcedx-vscode

- Update to the latest Salesforce icons ([PR #269](https://github.com/forcedotcom/salesforcedx-vscode/pull/269))

### Added

#### salesforcedx-vscode-core

- New workspace setting to control whether Salesforce CLI success messages show as information messages (pop-ups) or status bar messages (in the footer) ([PR #259](https://github.com/forcedotcom/salesforcedx-vscode/pull/259))

## 41.17.0 - January 15, 2018

### Added

#### salesforcedx-vscode-apex

- Add Go To Definition for class/interface usage for inner classes ([PR #258](https://github.com/forcedotcom/salesforcedx-vscode/pull/258))

## 41.16.0 - January 8, 2018

### Added

#### salesforcedx-vscode-apex

- Enable Go To Definition for usages of classes and interfaces in class and interface declarations ([PR #247](https://github.com/forcedotcom/salesforcedx-vscode/pull/247))

#### salesforcedx-apex-debugger

- Add visual indication in the call stack telling the user what exception the debugger is currently paused on ([PR #240](https://github.com/forcedotcom/salesforcedx-vscode/pull/240))

#### salesforcedx-vscode

- Add Dreamforce video links to README ([PR #239](https://github.com/forcedotcom/salesforcedx-vscode/pull/239))

### Fixed

#### salesforcedx-vscode-core

- Fix scratch org creation alias request message ([PR #238](https://github.com/forcedotcom/salesforcedx-vscode/pull/238))

## 41.12.0 - December 14, 2017

### Added

#### salesforcedx-vscode-core

- Export SFDX_SET_CLIENT_IDS environment variable to the embedded terminal in VS Code, to help with logging ([PR #235](https://github.com/forcedotcom/salesforcedx-vscode/pull/235))

## 41.11.0 - December 7, 2017

### Added

#### salesforcedx-vscode-core

- SFDX: Create Apex Trigger (_Requires v41.11.0 of the Salesforce CLI_) ([PR #224](https://github.com/forcedotcom/salesforcedx-vscode/pull/224))

### Fixed

#### salesforcedx-vscode-core

- Prevent running `SFDX: Refresh SObject Definitions` while it's already running ([PR #227](https://github.com/forcedotcom/salesforcedx-vscode/pull/227))
- Add explanatory comment to the generated sObject faux classes ([PR #228](https://github.com/forcedotcom/salesforcedx-vscode/pull/228))

## 41.9.0 - November 30, 2017

### Added

#### salesforcedx-vscode-apex-debugger

- Configure exception breakpoints ([PR #218](https://github.com/forcedotcom/salesforcedx-vscode/pull/218))
- Timeout for idle debugger session ([PR #221](https://github.com/forcedotcom/salesforcedx-vscode/pull/221))

## 41.8.1 - November 16, 2017

### Fixed

#### salesforcedx-vscode-core

- Fix SFDX commands not showing up on Windows

## 41.8.0 - November 16, 2017

### Added

#### salesforcedx-vscode-core

- Option to run a single Apex test class synchronously (_Requires v41.8.0 of the Salesforce CLI_) ([PR #206](https://github.com/forcedotcom/salesforcedx-vscode/pull/206))
- SFDX: Create Project ([PR #197](https://github.com/forcedotcom/salesforcedx-vscode/pull/197))
- SFDX: Refresh SObject Definitions (Enables code smartness in Apex for sObjects: [Read more](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex))

### Fixed

#### salesforcedx-vscode-apex-debugger

- Paginate collections in variables view ([PR #209](https://github.com/forcedotcom/salesforcedx-vscode/pull/209))

## 41.6.0 - November 2, 2017

### Added

#### salesforcedx-vscode

- Change name to `Salesforce Extensions for VS Code` ([PR #192](https://github.com/forcedotcom/salesforcedx-vscode/pull/192))

### Fixed

#### salesforcedx-vscode-apex-debugger

- Fix timeout issue when starting a debugger session ([PR #194](https://github.com/forcedotcom/salesforcedx-vscode/pull/194))

#### salesforcedx-vscode-visualforce

- Support proper formatting with Cmd+/ (macOS) or Ctrl+/ (Linux and Windows) in embedded CSS and JavaScript within Visualforce files ([PR #200](https://github.com/forcedotcom/salesforcedx-vscode/pull/200))

## 41.5.0 - October 25, 2017

### Added

### salesforcedx-vscode

- Update the minimum VS Code version to 1.17 ([PR #187](https://github.com/forcedotcom/salesforcedx-vscode/pull/187))

### Fixed

#### salesforcedx-vscode-visualforce

- Remove non-public attributes from Visualforce tags ([PR #188](https://github.com/forcedotcom/salesforcedx-vscode/pull/188))

## 41.4.0 - October 19, 2017

### Added

### salesforcedx-vscode-visualforce

- Code completion for standard Visualforce components ([PR #180](https://github.com/forcedotcom/salesforcedx-vscode/pull/180))

### Fixed

#### salesforcedx-vscode-apex-debugger

- Default type of `requestTypeFilter` in `launch.json` is an array ([PR #168](https://github.com/forcedotcom/salesforcedx-vscode/pull/168))
- Fix timing issue when showing the callstack ([PR #168](https://github.com/forcedotcom/salesforcedx-vscode/pull/168))

## 41.3.0 - October 14, 2017

### Added

#### salesforcedx-vscode-apex-debugger

- Apex Debugger extension for VS Code ([Read more](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-apex-debugger))

#### salesforcedx-vscode-core

- Alias prompt for command `SFDX: Create a Default Scratch Org...` ([PR #157](https://github.com/forcedotcom/salesforcedx-vscode/pull/157))
