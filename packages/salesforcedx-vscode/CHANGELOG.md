# 66.0.0 - March 5, 2026

## Added

Updates for the Spring 26 (v66.0) release.

#### salesforcedx-vscode-apex-testing

- [W-21263254] Apex tests in the test panel tree are organized by namespace and package. You can also filter tests by namespace and package. ([PR #6888](https://github.com/forcedotcom/salesforcedx-vscode/pull/6888))

#### salesforcedx-vscode-core

- [W-21360572] The create project command has new templates for React support ([PR #6884](https://github.com/forcedotcom/salesforcedx-vscode/pull/6884))

#### salesforcedx-vscode-lwc

- New setting to enable TypeScript LWC components ([PR #6872](https://github.com/forcedotcom/salesforcedx-vscode/pull/6872))

#### salesforcedx-vscode-apex-log

- What's "apex-log"? A whole new extension for debug/logging. Things it can now do that you couldn't do before
  - Create a TraceFlag on another user (search for users from your org and choose a level)
  - Create new DebugLevels that you can reuse
  - The improved StatusBarItem (in the bottom bar in VS Code shows whether you have a trace running and when it expires) has actions in its hover to manage some debug related tasks
  - Click on it to open a file which shows TraceFlags and DebugLevels in your org (and has actions to create/delete them)
  - If you have an active trace running, logs will automatically download in the background (there's a setting to control the polling frequency (`logPollIntervalSeconds`))
  - Running Anonymous Apex will automatically retrieve and open the log file when you run them. Even if you don't have a trace flag active, we'll create one just for the life of the transaction so you can get the logs for it
  - There's a new command to create a placeholder Anonymous Apex script

#### salesforcedx-vscode-org

- [W-21323001] we made the org picker UI nicer. Orgs are "*org*anized" into sections by type (ex: scratch org, sandbox) with aliased orgs at the top of their section. There are icon indicators (tree and leaf) for your default org and DevHub ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

#### salesforcedx-vscode-services-types

- [W-21323001] add media service to services extension and org picker icon updates ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

## Fixed

- Extension activation issues [W-21381917] ([PR #6914](https://github.com/forcedotcom/salesforcedx-vscode/pull/6914)) which should solve [issue #6914](https://github.com/forcedotcom/salesforcedx-vscode/issues/6914) and [issue #6916](https://github.com/forcedotcom/salesforcedx-vscode/issues/6916)

#### salesforcedx-vscode-apex-testing

- Code coverage toggle was not visible [Issue #6890](https://github.com/forcedotcom/salesforcedx-vscode/issues/6890) ([PR #6915](https://github.com/forcedotcom/salesforcedx-vscode/pull/6915))
