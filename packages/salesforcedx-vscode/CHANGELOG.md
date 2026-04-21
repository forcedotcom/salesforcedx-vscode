# 66.8.0 - April 22, 2026

## Added

#### salesforcedx-vscode-apex-log

- When creating an Apex class, trigger, or unit test class, the output directory picker now only lists package directories that contain a `classes` or `triggers` folder. ([PR #7225](https://github.com/forcedotcom/salesforcedx-vscode/pull/7225))

#### salesforcedx-vscode-apex-testing

- We made some changes under the hood to improve Apex test discovery for org-only tests. ([PR #7112](https://github.com/forcedotcom/salesforcedx-vscode/pull/7112))

#### salesforcedx-vscode-metadata

- When creating an LWC component, the output directory picker now lists package directories that contain an `lwc` folder. ([PR #7225](https://github.com/forcedotcom/salesforcedx-vscode/pull/7225))
- We added a cancellable progress indicator shown during component set preparation, conflict detection, and diff computation before deploy, retrieve, and delete. ([PR #7187](https://github.com/forcedotcom/salesforcedx-vscode/pull/7187), [ISSUE #7188](https://github.com/forcedotcom/salesforcedx-vscode/issues/7188))
- We added a new **SFDX: Generate Project Info** command that collects project, org, and environment details into a `project-info.md` report to speed up support triage. ([PR #7192](https://github.com/forcedotcom/salesforcedx-vscode/pull/7192)). Next time you open an issue, try including this info.

#### salesforcedx-vscode-services

- The LWC and Aura extensions activate programmatically the first time a file inside an `/lwc/` or `/aura/` package directory is opened, or when LWC testing UI is opened. Previously, they activated on any sfdx-project. ([PR #7154](https://github.com/forcedotcom/salesforcedx-vscode/pull/7154))

#### salesforcedx-vscode-soql

- We added a **Query Plan** step to the SOQL walkthrough and refreshed the walkthrough GIF to reflect the current behavior. ([PR #7199](https://github.com/forcedotcom/salesforcedx-vscode/pull/7199))
- We added a **Set a Default Org** button under the blue banner in the **SOQL Builder** UI so you can open the org picker without leaving the view. ([PR #7183](https://github.com/forcedotcom/salesforcedx-vscode/pull/7183))

## Fixed

#### salesforcedx-lwc-language-server

- We fixed a bug where the LWC language server could overwrite a user-customized `tsconfig.json` on VS Code startup. ([PR #7207](https://github.com/forcedotcom/salesforcedx-vscode/pull/7207), [ISSUE #7203](https://github.com/forcedotcom/salesforcedx-vscode/issues/7203))

#### salesforcedx-vscode-lwc

- We reverted a change that excluded `.d.ts` files from the packaged extension so type declarations are available again. ([PR #7175](https://github.com/forcedotcom/salesforcedx-vscode/pull/7175), [ISSUE #7173](https://github.com/forcedotcom/salesforcedx-vscode/issues/7173))

#### salesforcedx-vscode-metadata

- We fixed **Diff Source Against Org** for components stored outside their standard directory (for example, Apex classes in a folder other than `classes/`). ([PR #7184](https://github.com/forcedotcom/salesforcedx-vscode/pull/7184), [ISSUE #7177](https://github.com/forcedotcom/salesforcedx-vscode/issues/7177))

#### salesforcedx-vscode-soql

- We fixed a bug where **SOQL Builder** **Run Query** results disappeared and the save buttons stopped working after switching to another tab and back, and we also reduced a ~1 second lag when the results table re-rendered on tab switches. ([PR #7226](https://github.com/forcedotcom/salesforcedx-vscode/pull/7226))
- We fixed a bug where the `.soql` extension was included in the suggested file name when saving **SOQL Builder** query results as CSV or JSON; `AAA.soql` now suggests `AAA.csv` and `AAA.json`. ([PR #7181](https://github.com/forcedotcom/salesforcedx-vscode/pull/7181))
- We fixed a bug where the **SOQL Builder** toggle button failed to switch between builder view and text editor view when the **Output** panel was open. ([PR #7178](https://github.com/forcedotcom/salesforcedx-vscode/pull/7178))
