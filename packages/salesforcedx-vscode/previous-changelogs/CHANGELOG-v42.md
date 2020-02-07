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
