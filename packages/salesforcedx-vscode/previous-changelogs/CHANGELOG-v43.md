## 43.19.0 - October 4, 2018

### Fixed

#### salesforcedx-vscode-apex

- Fix test execution from Apex Tests sidebar so it shows an error message when the user is not authenticated ([PR #652](https://github.com/forcedotcom/salesforcedx-vscode/pull/652))
- Update telemetry to track extension activation time, Apex LSP errors, and startup time ([PR #646](https://github.com/forcedotcom/salesforcedx-vscode/pull/646))

## 43.17.0 - September 20, 2018

### Fixed

#### salesforcedx-vscode-apex

- Fix `NullPointerException` in Apex Language Server that could occur when using Go To Definition ([PR #642](https://github.com/forcedotcom/salesforcedx-vscode/pull/642))

#### salesforcedx-vscode-core

- Change default scratch org alias to project folder name ([PR #620](https://github.com/forcedotcom/salesforcedx-vscode/pull/620))

#### salesforcedx-vscode-lightning

- Fix Lightning component syntax highlighting ([PR #637](https://github.com/forcedotcom/salesforcedx-vscode/pull/637))

## 43.16.0 - September 13, 2018

### Fixed

#### salesforcedx-vscode-apex-debugger, salesforcedx-vscode-apex-replay-debugger

- Prevent Apex Debugger and Apex Replay Debugger from activating in projects without an `sfdx-project.json` file ([PR #631](https://github.com/forcedotcom/salesforcedx-vscode/pull/631))

#### salesforcedx-vscode

- Update documentation ([PR #628](https://github.com/forcedotcom/salesforcedx-vscode/pull/628))
- Update commands and messages that apply to both scratch orgs and the org development model ([PR #621](https://github.com/forcedotcom/salesforcedx-vscode/pull/621))

#### salesforcedx-vscode-core

- Fix error output when successfully running `SFDX: Execute Anonymous Apex with Currently Selected Text` and `SFDX: Execute Anonymous Apex with Editor Contents` commands ([PR #617](https://github.com/forcedotcom/salesforcedx-vscode/pull/617))

### Added

#### salesforcedx-vscode-apex

- Add folding regions for Apex code ([PR #630](https://github.com/forcedotcom/salesforcedx-vscode/pull/630))

## 43.15.0 - September 6, 2018

### Fixed

#### salesforcedx-vscode

- Update telemetry dialog text with additional opt-out link ([PR #608](https://github.com/forcedotcom/salesforcedx-vscode/pull/608))

## 43.14.0 - August 30, 2018

### Added

#### salesforcedx-vscode-replay-debugger

- Support telemetry for capturing high-level execution details and errors ([PR #599](https://github.com/forcedotcom/salesforcedx-vscode/pull/599))

### Fixed

#### salesforce-vscode-apex

- Fix `NullPointerException` when Apex Language Server initializes ([PR #598](https://github.com/forcedotcom/salesforcedx-vscode/pull/598))

## 43.13.0 - August 23, 2018

### Added

#### salesforcedx-vscode-apex

- [Apex Tests sidebar](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/packages/salesforcedx-vscode-core/README.md#explore-your-apex-tests) allows you to view, run, and interact with the Apex tests in your project ([PR #552](https://github.com/forcedotcom/salesforcedx-vscode/pull/552))

#### salesforcedx-vscode

- Support telemetry for commands in Salesforce extensions ([PR #549](https://github.com/forcedotcom/salesforcedx-vscode/pull/549))

## 43.12.0 - August 16, 2018

### Fixed

#### salesforcedx-vscode

- We fixed some minor under-the-hood bugs.

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

- Apex code snippets for use in autocompletion and when running **Insert Snippet** ([PR #464](https://github.com/forcedotcom/salesforcedx-vscode/pull/464), [PR #487](https://github.com/forcedotcom/salesforcedx-vscode/pull/487))

#### salesforcedx-vscode-core

- `salesforcedx-vscode-core.retrieve-test-code-coverage` setting to enable code coverage calculation and retrieval when running Apex tests ([PR #482](https://github.com/forcedotcom/salesforcedx-vscode/pull/482))—Contribution by [@dylanribb](https://github.com/dylanribb)
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
