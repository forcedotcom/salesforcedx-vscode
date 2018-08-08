## 43.11.0 - August 9, 2018

### Fixed

#### salesforcedx-vscode-core

- Prevent `Path does not exist` errors by changing the way that the extension opens folders ([PR #545](https://github.com/forcedotcom/salesforcedx-vscode/pull/545))

### Added

#### salesforcedx-vscode

- Support telemetry in activation/deactivation of Salesforce extensions ([PR #511](https://github.com/forcedotcom/salesforcedx-vscode/pull/511))

## 43.10.0 - August 2, 2018

### Fixed

#### salesforcedx-vscode

- Document how to retrieve code coverage results ([PR #533](https://github.com/forcedotcom/salesforcedx-vscode/pull/533))
- Use ProgressNotification to show SFDX command execution progress in a message box instead of in the footer ([PR #536](https://github.com/forcedotcom/salesforcedx-vscode/pull/536))

## 43.8.0 - July 19, 2018

### Fixed

#### salesforcedx-vscode

- We fixed some minor under-the-hood bugs.

## 43.6.0 - July 5, 2018

### Fixed

#### salesforcedx-vscode-core

- ISV Customer Debugger file watcher looks only for `.sfdx/sfdx-config.json` changes ([PR #509](https://github.com/forcedotcom/salesforcedx-vscode/pull/509))

## 43.5.0 - June 28, 2018

### Fixed

#### salesforcedx-vscode-core

- Guard against salesforcedx-vscode-core failing to launch if there’s an issue with configuring ISV Customer Debugger ([PR #497](https://github.com/forcedotcom/salesforcedx-vscode/pull/497))

### Added

#### salesforcedx-vscode-apex

- Syntax highlighting for merge function and Apex switch statements ([PR #503](https://github.com/forcedotcom/salesforcedx-vscode/pull/503))

## 43.4.0 - June 21, 2018

### Added

#### salesforcedx-vscode-apex

- Apex code snippets for use in autocompletion and when running **Insert Snippet** ([PR #464](https://github.com/forcedotcom/salesforcedx-vscode/pull/464)), ([PR #487](https://github.com/forcedotcom/salesforcedx-vscode/pull/487))

#### salesforcedx-vscode-core

- `salesforcedx-vscode-core.retrieve-test-code-coverage` setting to enable code coverage calculation and retrieval when running Apex tests ([PR #482](https://github.com/forcedotcom/salesforcedx-vscode/pull/482)). Contribution by [@dylanribb](https://github.com/dylanribb)
- Quick pick to select which API (REST API or Tooling API) to use when running SOQL query commands ([PR #461](https://github.com/forcedotcom/salesforcedx-vscode/pull/461))

## 43.3.0 - June 14, 2018

### Fixed

#### salesforcedx-vscode-apex

- Improve syntax highlighting for built-in Apex classes, methods, and types ([PR #474](https://github.com/forcedotcom/salesforcedx-vscode/pull/474), [PR #484](https://github.com/forcedotcom/salesforcedx-vscode/pull/484))

## 43.2.0 - June 9, 2018

### Added

#### salesforcedx-vscode-apex-replay-debugger

- Apex Replay Debugger extension for VS Code ([Read more](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-replay-debugger))
- SFDX: Turn On Apex Debug Log for Replay Debugger ([PR #264](https://github.com/forcedotcom/salesforcedx-vscode/pull/264))
- SFDX: Turn Off Apex Debug Log for Replay Debugger ([PR #264](https://github.com/forcedotcom/salesforcedx-vscode/pull/264))
- SFDX: Launch Apex Replay Debugger with Current File ([PR #423](https://github.com/forcedotcom/salesforcedx-vscode/pull/423))
- SFDX: Launch Apex Replay Debugger with Last Log File ([PR #439](https://github.com/forcedotcom/salesforcedx-vscode/pull/439))

#### salesforcedx-vscode-apex-debugger

- Use ISV Customer Debugger to debug subscribers of managed packages ([Read more](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-apex-debugger#isv-customer-debugger))
- SFDX: Create and Set Up Project for ISV Debugging ([PR #282](https://github.com/forcedotcom/salesforcedx-vscode/pull/282))

### Fixed

#### salesforcedx-vscode-apex-debugger

- Launch Apex Debugger session with an active Visual Studio Live Share session ([PR #442](https://github.com/forcedotcom/salesforcedx-vscode/pull/442))

## 42.18.0 - May 31, 2018

### Fixed

#### salesforcedx-vscode-core

- Rename the output channel from Salesforce DX CLI to Salesforce CLI ([PR #446](https://github.com/forcedotcom/salesforcedx-vscode/pull/446))

## 42.17.0 - May 24, 2018

### Added

#### salesforcedx-vscode-apex-debugger

- Clarify current Apex Debugger limitations with the Visual Studio Live Share extension ([PR #425](https://github.com/forcedotcom/salesforcedx-vscode/pull/425))

## 42.16.0 - May 17, 2018

### Fixed

#### salesforcedx-vscode-apex

- Apex language grammar rules properly categorize Apex syntax, improving code highlighting ([PR #415](https://github.com/forcedotcom/salesforcedx-vscode/pull/415))
- Go To Definition and Find All References properly handle custom objects that have a namespace ([PR #413](https://github.com/forcedotcom/salesforcedx-vscode/pull/413))

## 42.15.0 - May 10, 2018

### Fixed

#### salesforcedx-vscode-core

- Make extension resilient against Salesforce CLI's STDERR messages (warnings and available updates) when parsing `--json` output ([PR #406](https://github.com/forcedotcom/salesforcedx-vscode/pull/406))

## 42.14.0 - May 3, 2018

### Fixed

#### salesforcedx-vscode-apex

- Code completion now respects the `global`, `public`, `protected`, and `private` modifiers when offering suggestions ([PR #404](https://github.com/forcedotcom/salesforcedx-vscode/pull/404))

## 42.13.0 - April 26, 2018

### Fixed

#### salesforcedx-vscode

- Previously, copying and pasting Salesforce CLI output from the embedded terminal in VS Code would embed terminal escape characters in the pasted text. We have fixed this in Salesforce CLI, and the Visual Studio Code team has made a similar fix in VS Code. If you see any issues with copy and pasting, be sure to update both VS Code and Salesforce CLI.

#### salesforcedx-vscode-apex

- Handle missing `namespace` attribute in sfdx-project.json ([PR #391](https://github.com/forcedotcom/salesforcedx-vscode/pull/391))

## 42.12.0 - April 19, 2018

### Added

#### salesforcedx-vscode-apex

- Go To Definition and Find All References for type usage in constructors for arrays and lists ([PR #376](https://github.com/forcedotcom/salesforcedx-vscode/pull/376))
- Go To Definition and Find All References for types used with instanceOf ([PR #376](https://github.com/forcedotcom/salesforcedx-vscode/pull/376))
- Go To Definition for implicit constructors across Apex classes ([PR #376](https://github.com/forcedotcom/salesforcedx-vscode/pull/376))

### Fixed

#### salesforcedx-vscode-core

- Support invoking Salesforce CLI commands for CLI installations that used the new installers on Windows ([PR #386](https://github.com/forcedotcom/salesforcedx-vscode/pull/386))

## 42.11.0 - April 12, 2018

### Added

#### salesforcedx-vscode-apex

- Go To Definition and Find All References for [built-in (`System`) exceptions](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_exception_methods.htm) ([PR #370](https://github.com/forcedotcom/salesforcedx-vscode/pull/370))
- Go To Definition and Find All References for sObjects in Apex trigger declarations ([PR #370](https://github.com/forcedotcom/salesforcedx-vscode/pull/370))

### Fixed

#### salesforcedx-vscode-apex

- Language server processes Apex code only in the `packageDirectories` set in `sfdx-project.json` (and their subdirectories) ([PR #370](https://github.com/forcedotcom/salesforcedx-vscode/pull/370))

#### salesforcedx-vscode-apex-debugger

- Apex Debugger works on Windows even when there are spaces in the project's path ([PR #359](https://github.com/forcedotcom/salesforcedx-vscode/pull/359))

## 42.10.0 - April 5, 2018

### Added

#### salesforcedx-vscode-apex

- Go To Definition and Find All References for type usage in collection constructors ([PR #362](https://github.com/forcedotcom/salesforcedx-vscode/pull/362))
- Go To Definition and Find All References for type usage in casting ([PR #362](https://github.com/forcedotcom/salesforcedx-vscode/pull/362))

### Fixed

#### salesforcedx-vscode-apex

- Go To Definition now works after moving a class/trigger to a different directory ([PR #362](https://github.com/forcedotcom/salesforcedx-vscode/pull/362))

## 42.8.0 - March 22, 2018

### Added

#### salesforcedx-vscode-apex

- Go To Definition and Find All References for inner interfaces and implicit constructors ([PR #353](https://github.com/forcedotcom/salesforcedx-vscode/pull/353))

## 42.7.0 - March 15, 2018

### Added

#### salesforcedx-vscode-core

- Demo mode for VS Code warns users who authorize business or production orgs on demo machines about the security risk ([PR #335](https://github.com/forcedotcom/salesforcedx-vscode/pull/335))
- `SFDX: Log Out from All Authorized Orgs` command supports demo mode ([PR #335](https://github.com/forcedotcom/salesforcedx-vscode/pull/335))

### Fixed

#### salesforcedx-vscode-apex

- Handle Apex language server failures without disrupting indexing ([PR #341](https://github.com/forcedotcom/salesforcedx-vscode/pull/341))

## 42.5.0 - March 1, 2018

### Added

#### salesforcedx-vscode-apex

- Find All References for user-defined classes, enums, interfaces and methods ([PR #324](https://github.com/forcedotcom/salesforcedx-vscode/pull/324))
- `SFDX: Get Apex Debug Logs` command to fetch debug logs ([PR #310](https://github.com/forcedotcom/salesforcedx-vscode/pull/310))

### Fixed

#### salesforcedx-vscode-core

- Change code actions for running Apex tests to code lenses, to follow VS Code conventions ([PR #324](https://github.com/forcedotcom/salesforcedx-vscode/pull/324))

## 42.4.0 - February 22, 2018

### Added

#### salesforcedx-vscode-core

- Include source links to Apex classes on Apex test failures ([PR #308](https://github.com/forcedotcom/salesforcedx-vscode/pull/308))
- `SFDX: Re-Run Last Invoked Apex Test Class` and `SFDX: Re-Run Last Invoked Apex Test Method` show up in the command palette after you run tests ([PR #308](https://github.com/forcedotcom/salesforcedx-vscode/pull/308))

## 42.2.0 - February 10, 2018

### Added

#### salesforcedx-vscode-core

- Code action to run Apex tests; run a single method or all test methods in a test class ([PR #291](https://github.com/forcedotcom/salesforcedx-vscode/pull/291))

#### salesforcedx-vscode-apex

- Find All References feature for Apex fields and properties; includes usage in expressions, declarations, and references in Apex code ([PR #292](https://github.com/forcedotcom/salesforcedx-vscode/pull/292))

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
