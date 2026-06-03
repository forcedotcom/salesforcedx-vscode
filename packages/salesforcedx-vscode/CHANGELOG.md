# 66.14.2 - June 4, 2026

## Added

#### salesforcedx-vscode-apex-testing

- The Apex Test Explorer now performs an incremental update when you deploy a class instead of clearing the entire test tree. Only the deployed class is refreshed at method granularity, and existing results are preserved and marked stale so you don't lose context from your last run. ([PR #7300](https://github.com/forcedotcom/salesforcedx-vscode/pull/7300))
- We added a new setting, **Restore Previous Results**, that restores your Apex test results when you reload the workspace (results from the last 24 hours, marked stale). Use the **Don't Restore Again** action to disable it for a workspace. ([PR #7300](https://github.com/forcedotcom/salesforcedx-vscode/pull/7300))

#### salesforcedx-vscode-core

- We bumped `@salesforce/templates` to 66.9.0 to support the new React and UIBundle multiframework project templates. ([PR #7365](https://github.com/forcedotcom/salesforcedx-vscode/pull/7365))

#### salesforcedx-vscode-services

- We added a new **Enable File Traces** setting (`salesforcedx-vscode-salesforcedx.enableFileTraces`, default `false`). When enabled, spans and log records are written in OTLP JSON format to `~/.sf/vscode-spans/` so you can share traces with support for import into Grafana. ([PR #7305](https://github.com/forcedotcom/salesforcedx-vscode/pull/7305))

## Fixed

#### salesforcedx-vscode-apex-log

- When you click the **Create trace flag for current user** code lens, you can now choose a debug level from a dropdown instead of being defaulted to `ReplayDebuggerLevels`. ([PR #7330](https://github.com/forcedotcom/salesforcedx-vscode/pull/7330), [ISSUE #7262](https://github.com/forcedotcom/salesforcedx-vscode/issues/7262))

#### salesforcedx-vscode-apex-testing

- We fixed a bug where Apex test coverage didn't aggregate across recent test runs, and corrected an issue restoring previous results after reload. ([PR #7362](https://github.com/forcedotcom/salesforcedx-vscode/pull/7362))
- We fixed a bug where Apex test results were read from the wrong location when multiple orgs were used. ([PR #7360](https://github.com/forcedotcom/salesforcedx-vscode/pull/7360))

#### salesforcedx-vscode-core

- We fixed a bug where the **Org Browser** crashed with "Element with id `CustomObject:Account` is already registered" in orgs with Person Account enabled. The Metadata API can return duplicate entries for the same component, which we now deduplicate. ([PR #7321](https://github.com/forcedotcom/salesforcedx-vscode/pull/7321), [ISSUE #7212](https://github.com/forcedotcom/salesforcedx-vscode/issues/7212))

#### salesforcedx-vscode-services

- We fixed a bug where the `TemplateService` ignored custom metadata templates. ([PR #7333](https://github.com/forcedotcom/salesforcedx-vscode/pull/7333))

## Under the Hood

- We made some under the hood changes. ([PR #7343](https://github.com/forcedotcom/salesforcedx-vscode/pull/7343))

