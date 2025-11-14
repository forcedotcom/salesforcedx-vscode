# 65.4.0 - November 12, 2025

## Added

#### salesforcedx-utils

#### salesforcedx-vscode-apex

- We added the `Test-run-concise` setting, defaulting to false. Enabling this skips over successful test results, and only displays failures, using the `--concise` flag in the CLI. Thank you [Kyle Capehart](https://github.com/k-capehart) for your contribution. ([PR #6636](https://github.com/forcedotcom/salesforcedx-vscode/pull/6636))

#### salesforcedx-vscode-core

- In preparation for making our extensions web-compatible, we moved the org/auth related commands from the CLI Integration extension to a new **Salesforce Org Management** extension. This new extension is included in the Salesforce Extension Pack and Salesforce Extension Pack Expanded, so there is no functionality change. ([PR #6612](https://github.com/forcedotcom/salesforcedx-vscode/pull/6612))

## Fixed

#### docs

- We added documentation to help teams new to Salesforce extension development get started. ([PR #6634](https://github.com/forcedotcom/salesforcedx-vscode/pull/6634))

#### salesforcedx-apex-debugger

#### salesforcedx-vscode-apex-debugger

- We fixed a bug where the Apex Interactive Debugger was producing the error `Error: No username provided and no default username found in project config or state.` when attempting to start a debugging session. Thank you [sf-blilley](https://github.com/sf-blilley) for filing this issue. ([PR #6633](https://github.com/forcedotcom/salesforcedx-vscode/pull/6633), [ISSUE #6558](https://github.com/forcedotcom/salesforcedx-vscode/issues/6558))
