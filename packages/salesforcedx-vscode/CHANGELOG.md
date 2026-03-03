# 65.20.1 - March 5, 2026

## Added

#### salesforcedx-vscode-apex-testing

- Apex tests in the Test Explorer are now organized in a hierarchy of Namespace → Package → Class → Method, making it easy to distinguish unpackaged tests, 1GP namespaced tests, and 2GP package tests (including unlocked packages). A Local Namespace groups classes without a namespace, and tests can be filtered and run/debugged at the namespace or package level. Package resolution is handled automatically per org, with intelligent fallbacks and caching for improved performance and reliability. ([PR #6888](https://github.com/forcedotcom/salesforcedx-vscode/pull/6888))

#### salesforcedx-vscode-core

- The `SFDX: Create Project` command now has new templates for React support. ([PR #6884](https://github.com/forcedotcom/salesforcedx-vscode/pull/6884))

#### salesforcedx-vscode-lwc

- We added a new setting to enable TypeScript LWC components. ([PR #6872](https://github.com/forcedotcom/salesforcedx-vscode/pull/6872))

#### salesforcedx-vscode-org

- We refreshed the org picker with a cleaner, more organized layout. Orgs are now grouped by type (for example, Scratch Org and Sandbox), with aliased orgs prioritized at the top of each section. Visual indicators make it easy to identify your default org and Dev Hub at a glance. ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

#### salesforcedx-vscode-apex-log

We introduced Apex Log, a dedicated extension for Apex debugging and log workflows with these features-
- You can create Trace Flags for any user in your org, define reusable Debug Levels, and manage both directly from VS Code.
- An enhanced Status Bar indicator that shows when a trace is active and when it expires, with quick actions to view and manage Trace Flags and Debug Levels. Now logs automatically download in the background while a trace is active (polling frequency configurable via logPollIntervalSeconds).
- Running Anonymous Apex now automatically retrieves and opens the corresponding log even creating a temporary Trace Flag, if needed. A new command also lets you quickly generate a placeholder Anonymous Apex script.

## Fixed

- We fixed some issues with extension activation. ([PR #6914](https://github.com/forcedotcom/salesforcedx-vscode/pull/6914), [ISSUE #6914](https://github.com/forcedotcom/salesforcedx-vscode/issues/6914), [ISSUE #6916](https://github.com/forcedotcom/salesforcedx-vscode/issues/6916))

- We fixed an issue with code coverage toggle not being visible. ([PR #6915](https://github.com/forcedotcom/salesforcedx-vscode/pull/6915), [ISSUE #6890](https://github.com/forcedotcom/salesforcedx-vscode/issues/6890))
