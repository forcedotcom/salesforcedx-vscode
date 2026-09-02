# 67.17.2 - September 4, 2026

## Added

#### salesforcedx-vscode

- We added the **Metadata Visualizer** (salesforce.salesforcedx-metadata-visualizer-vscode) to the standard extension pack, so it's now included by default. ([PR #8049](https://github.com/forcedotcom/salesforcedx-vscode/pull/8049))

#### salesforcedx-vscode-core

- We added a configurable notifications system so you can control whether progress and success notifications for a command appear as a toast, in the status bar, or (for success notifications) not at all. You can set this at the system, extension, or command level. ([PR #8073](https://github.com/forcedotcom/salesforcedx-vscode/pull/8073))

## Fixed

#### salesforcedx-vscode-apex-testing

- We fixed a bug where selecting a mix of individual Apex tests and Apex test suites in the **Testing** sidebar silently skipped the test suites instead of running them; you now get an error notification instead. ([PR #8048](https://github.com/forcedotcom/salesforcedx-vscode/pull/8048))

#### salesforcedx-vscode-metadata

- We fixed a bug where generated sObject faux classes and TypeScript typings didn't sort fields alphabetically by name. ([PR #8071](https://github.com/forcedotcom/salesforcedx-vscode/pull/8071))

#### salesforcedx-vscode-services

- We fixed a bug in web-based VS Code where files created, deployed, or retrieved after your first change appeared in the Explorer but disappeared after a reload. ([PR #8088](https://github.com/forcedotcom/salesforcedx-vscode/pull/8088))

- We fixed a bug that prevented Salesforce project creation commands from running in an empty VS Code window. ([PR #8065](https://github.com/forcedotcom/salesforcedx-vscode/pull/8065))

## Under the Hood

- We made some under the hood changes. ([PR #8033](https://github.com/forcedotcom/salesforcedx-vscode/pull/8033), [PR #8034](https://github.com/forcedotcom/salesforcedx-vscode/pull/8034), [PR #8035](https://github.com/forcedotcom/salesforcedx-vscode/pull/8035), [PR #8026](https://github.com/forcedotcom/salesforcedx-vscode/pull/8026), [PR #8053](https://github.com/forcedotcom/salesforcedx-vscode/pull/8053), [PR #8042](https://github.com/forcedotcom/salesforcedx-vscode/pull/8042), [PR #8078](https://github.com/forcedotcom/salesforcedx-vscode/pull/8078), [PR #8072](https://github.com/forcedotcom/salesforcedx-vscode/pull/8072))
