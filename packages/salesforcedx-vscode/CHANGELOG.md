# 67.3.0 - July 1, 2026

## Added

#### salesforcedx-apex-replay-debugger

- The **Variables** panel now sorts variables alphabetically. ([PR #7559](https://github.com/forcedotcom/salesforcedx-vscode/pull/7559), [DISCUSSION #5457](https://github.com/forcedotcom/salesforcedx-vscode/discussions/5457))

#### salesforcedx-vscode-lwc

- LWC Jest run and debug entry points (command palette, editor-title buttons, code lens) now route through VS Code's native **Test Controller**, giving you real-time feedback — progress spinners and results in the **Test Results** panel. ([PR #7577](https://github.com/forcedotcom/salesforcedx-vscode/pull/7577))

#### salesforcedx-vscode-org

- Canceling **SFDX: Delete Default Org** now terminates the underlying process immediately. ([PR #7524](https://github.com/forcedotcom/salesforcedx-vscode/pull/7524))

#### salesforcedx-vscode-soql

- The **SOQL Query Builder** now supports the `ALL ROWS` clause, letting you include deleted and archived records in query results. ([PR #7560](https://github.com/forcedotcom/salesforcedx-vscode/pull/7560))

## Fixed

#### salesforcedx-apex-debugger

- We fixed a bug where parent-relationship and child-subquery SObject fields showed `[object Object]` in the interactive debugger **Variables** panel. ([PR #7519](https://github.com/forcedotcom/salesforcedx-vscode/pull/7519), [ISSUE #4065](https://github.com/forcedotcom/salesforcedx-vscode/issues/4065))

#### salesforcedx-apex-replay-debugger

- We fixed a bug where nested related-object variables (parent SObject relationships, multi-level hierarchies, child subqueries) showed `[object Object]` instead of expanding in the **Variables** panel. ([PR #7517](https://github.com/forcedotcom/salesforcedx-vscode/pull/7517), [ISSUE #4065](https://github.com/forcedotcom/salesforcedx-vscode/issues/4065))

#### salesforcedx-vscode-apex-log

- We fixed a bug where the **Trace Flags** view failed entirely when a trace flag referenced a deleted debug level; the view now renders and surfaces the unresolvable flag gracefully. ([PR #7531](https://github.com/forcedotcom/salesforcedx-vscode/pull/7531), [ISSUE #7528](https://github.com/forcedotcom/salesforcedx-vscode/issues/7528))

- **SFDX: Remove Debug Level** now shows a quick pick when run from the command palette, letting you choose which debug level to remove instead of silently doing nothing. ([PR #7562](https://github.com/forcedotcom/salesforcedx-vscode/pull/7562))

- **SFDX: Remove Trace Flag** now shows a quick pick when run from the command palette, letting you choose which trace flag to remove instead of silently doing nothing. ([PR #7537](https://github.com/forcedotcom/salesforcedx-vscode/pull/7537))

- We fixed a bug where the trace flag status bar icon reflected trace flags created for other users; it now only tracks the current user's active trace flag. ([PR #7534](https://github.com/forcedotcom/salesforcedx-vscode/pull/7534))

- The trace flag status bar icon now clears automatically when the active trace flag expires, without requiring a manual toggle or reload. ([PR #7520](https://github.com/forcedotcom/salesforcedx-vscode/pull/7520), [ISSUE #1417](https://github.com/forcedotcom/salesforcedx-vscode/issues/1417))

#### salesforcedx-vscode-lwc

- We fixed a bug where LWC tests disappeared from the test explorer when the **@in-workspace** filter was active. ([PR #7529](https://github.com/forcedotcom/salesforcedx-vscode/pull/7529), [ISSUE #7350](https://github.com/forcedotcom/salesforcedx-vscode/issues/7350))

#### salesforcedx-vscode-metadata

- Deploy and retrieve commands now pick up changes to `sourceApiVersion` in `sfdx-project.json` mid-session, without requiring a reload. ([PR #7521](https://github.com/forcedotcom/salesforcedx-vscode/pull/7521), [ISSUE #5313](https://github.com/forcedotcom/salesforcedx-vscode/issues/5313))

# 67.2.0 - June 24, 2026

## Added

#### salesforcedx-vscode

- We added **Agentforce Vibes Autocomplete** (salesforce.agentforce-vibes-autocomplete) to both the standard and Expanded Salesforce Extension Packs, so you can install it from either pack. ([PR #7499](https://github.com/forcedotcom/salesforcedx-vscode/pull/7499))

#### salesforcedx-vscode-apex-oas

- We added a new **Enable REST OAS Gen** setting (`salesforcedx-vscode-apex-oas.enableRestOASGen`, off by default) and decoupled REST OpenAPI document generation from the Agentforce for Developers extension. Generation now shows a progress notification and clearer error messages. ([PR #7465](https://github.com/forcedotcom/salesforcedx-vscode/pull/7465))

## Fixed

#### salesforcedx-vscode-apex

- We fixed a bug where the extension could freeze VS Code for 20-30 seconds at startup on Windows while checking for orphaned language server processes. ([PR #7508](https://github.com/forcedotcom/salesforcedx-vscode/pull/7508), [ISSUE #7461](https://github.com/forcedotcom/salesforcedx-vscode/issues/7461))

#### salesforcedx-vscode-services

- We fixed a bug where Web Console showed **Untitled (Workspace)** instead of the project name, and we made creating a project in the web significantly faster. ([PR #7484](https://github.com/forcedotcom/salesforcedx-vscode/pull/7484))

## Under the Hood

- We made some changes under the hood. ([PR #7463](https://github.com/forcedotcom/salesforcedx-vscode/pull/7463), [PR #7487](https://github.com/forcedotcom/salesforcedx-vscode/pull/7487), [PR #7489](https://github.com/forcedotcom/salesforcedx-vscode/pull/7489))

# 67.1.0 - June 18, 2026

## Added

#### salesforcedx-vscode-apex

- We updated the Apex Language Server with Summer '26 (API version 262) language definitions and refreshed standard Apex library. ([PR #7435](https://github.com/forcedotcom/salesforcedx-vscode/pull/7435))

#### salesforcedx-vscode-org

- The **SFDX: Delete Default Org** command is now hidden when your default org is a production org or Dev Hub (only scratch orgs and sandboxes can be deleted). ([PR #7433](https://github.com/forcedotcom/salesforcedx-vscode/pull/7433))

## Fixed

#### salesforcedx-vscode-org

- We fixed a bug where the Apex test view didn't refresh immediately after changing the default org. ([PR #7448](https://github.com/forcedotcom/salesforcedx-vscode/pull/7448))

## Under the Hood

- We made some under the hood changes. ([PR #7418](https://github.com/forcedotcom/salesforcedx-vscode/pull/7418), [PR #7351](https://github.com/forcedotcom/salesforcedx-vscode/pull/7351))

# 66.15.0 - June 10, 2026

## Added

#### salesforcedx-vscode-metadata

- We rewrote the **SFDX: Install Package** command to use the Tooling API directly, so it now works in Web Console without the Salesforce CLI. The command also shows cancellable progress while the install request is polling. ([PR #7369](https://github.com/forcedotcom/salesforcedx-vscode/pull/7369))

## Changed

#### salesforcedx-vscode-lwc

- You can now rename a Lightning Web Component in Web Console. ([PR #7371](https://github.com/forcedotcom/salesforcedx-vscode/pull/7371))

## Fixed

#### salesforcedx-vscode-apex-log

- We reduced the number of API calls used to query information related to trace flags. ([PR #7391](https://github.com/forcedotcom/salesforcedx-vscode/pull/7391))

#### salesforcedx-vscode-lwc

- You can create a Lightning Web Component from the Explorer context menu, not only the Command Palette. Thanks to [@vsdragon626](https://github.com/vsdragon626) for the contribution! ([PR #7392](https://github.com/forcedotcom/salesforcedx-vscode/pull/7392))

# 66.14.2 - June 4, 2026

## Added

#### salesforcedx-vscode-apex-testing

- The Apex Test Explorer now performs an incremental update when you deploy a class instead of clearing the entire test tree. Only the deployed class is refreshed at method granularity, and existing results are preserved and marked stale so you don't lose context from your last run. ([PR #7300](https://github.com/forcedotcom/salesforcedx-vscode/pull/7300))
- We added a new setting, **Restore Previous Results**, that restores your Apex test results when you reload the workspace (results from the last 24 hours, marked stale). Use the **Don't Restore Again** action to disable it for a workspace. ([PR #7300](https://github.com/forcedotcom/salesforcedx-vscode/pull/7300))

#### salesforcedx-vscode-core

- We bumped \`@salesforce/templates\` to 66.9.0 to support the new React and UIBundle multiframework project templates. ([PR #7365](https://github.com/forcedotcom/salesforcedx-vscode/pull/7365))

#### salesforcedx-vscode-services

- We added a new **Enable File Traces** setting (\`salesforcedx-vscode-salesforcedx.enableFileTraces\`, default \`false\`). When enabled, spans and log records are written in OTLP JSON format to \`~/.sf/vscode-spans/\` so you can share traces with support for import into Grafana. ([PR #7305](https://github.com/forcedotcom/salesforcedx-vscode/pull/7305))

## Fixed

#### salesforcedx-vscode-apex-log

- When you click the **Create trace flag for current user** code lens, you can now choose a debug level from a dropdown instead of being defaulted to \`ReplayDebuggerLevels\`. ([PR #7330](https://github.com/forcedotcom/salesforcedx-vscode/pull/7330), [ISSUE #7262](https://github.com/forcedotcom/salesforcedx-vscode/issues/7262))

#### salesforcedx-vscode-apex-testing

- We fixed a bug where Apex test coverage didn't aggregate across recent test runs, and corrected an issue restoring previous results after reload. ([PR #7362](https://github.com/forcedotcom/salesforcedx-vscode/pull/7362))
- We fixed a bug where Apex test results were read from the wrong location when multiple orgs were used. ([PR #7360](https://github.com/forcedotcom/salesforcedx-vscode/pull/7360))

#### salesforcedx-vscode-core

- We fixed a bug where the **Org Browser** crashed with "Element with id \`CustomObject:Account\` is already registered" in orgs with Person Account enabled. The Metadata API can return duplicate entries for the same component, which we now deduplicate. ([PR #7321](https://github.com/forcedotcom/salesforcedx-vscode/pull/7321), [ISSUE #7212](https://github.com/forcedotcom/salesforcedx-vscode/issues/7212))

#### salesforcedx-vscode-services

- We fixed a bug where the \`TemplateService\` ignored custom metadata templates. ([PR #7333](https://github.com/forcedotcom/salesforcedx-vscode/pull/7333))

## Under the Hood

- We made some under the hood changes. ([PR #7343](https://github.com/forcedotcom/salesforcedx-vscode/pull/7343))

# 66.14.1 - June 3, 2026

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

- We fixed a bug where Apex test results were read from the wrong location when multiple orgs were used. ([PR #7360](https://github.com/forcedotcom/salesforcedx-vscode/pull/7360))

#### salesforcedx-vscode-core

- We fixed a bug where the **Org Browser** crashed with "Element with id `CustomObject:Account` is already registered" in orgs with Person Account enabled. The Metadata API can return duplicate entries for the same component, which we now deduplicate. ([PR #7321](https://github.com/forcedotcom/salesforcedx-vscode/pull/7321), [ISSUE #7212](https://github.com/forcedotcom/salesforcedx-vscode/issues/7212))

#### salesforcedx-vscode-services

- We fixed a bug where the `TemplateService` ignored custom metadata templates. ([PR #7333](https://github.com/forcedotcom/salesforcedx-vscode/pull/7333))

## Under the Hood

- We made some under the hood changes. ([PR #7343](https://github.com/forcedotcom/salesforcedx-vscode/pull/7343))

# 66.14.0 - June 3, 2026

## Added

#### salesforcedx-vscode-core

- We bumped `@salesforce/templates` to 66.9.0 to support the new React and UIBundle multiframework project templates. ([PR #7365](https://github.com/forcedotcom/salesforcedx-vscode/pull/7365))

#### salesforcedx-vscode-services

- We added a new **Enable File Traces** setting (`salesforcedx-vscode-salesforcedx.enableFileTraces`, default `false`). When enabled, spans and log records are written in OTLP JSON format to `~/.sf/vscode-spans/` so you can share traces with support for import into Grafana. ([PR #7305](https://github.com/forcedotcom/salesforcedx-vscode/pull/7305))

## Fixed

#### salesforcedx-vscode-apex-testing

- We fixed a bug where Apex test results were read from the wrong location when multiple orgs were used. ([PR #7360](https://github.com/forcedotcom/salesforcedx-vscode/pull/7360))

#### salesforcedx-vscode-services

- We fixed a bug where the `TemplateService` ignored custom metadata templates. ([PR #7333](https://github.com/forcedotcom/salesforcedx-vscode/pull/7333))

# 66.13.0 - May 27, 2026

## Added

#### salesforcedx-vscode-apex-testing

- The Apex Test Explorer now performs an incremental update when you deploy a class instead of clearing the entire test tree. Only the deployed class is refreshed at method granularity, and existing results are preserved and marked stale so you don't lose context from your last run. ([PR #7300](https://github.com/forcedotcom/salesforcedx-vscode/pull/7300))

- We added a new setting, **Restore Previous Results**, that restores your Apex test results when you reload the workspace (results from the last 24 hours, marked stale). Use the **Don't Restore Again** action to disable it for a workspace. ([PR #7300](https://github.com/forcedotcom/salesforcedx-vscode/pull/7300))

## Fixed

#### salesforcedx-vscode-apex-log

- When you click the **Create trace flag for current user** code lens, you can now choose a debug level from a dropdown instead of being defaulted to `ReplayDebuggerLevels`. ([PR #7330](https://github.com/forcedotcom/salesforcedx-vscode/pull/7330), [ISSUE #7262](https://github.com/forcedotcom/salesforcedx-vscode/issues/7262))

## Under the Hood

- We made some under the hood changes. ([PR #7343](https://github.com/forcedotcom/salesforcedx-vscode/pull/7343))

# 66.12.3 - May 22, 2026

## Added

#### salesforcedx-vscode-metadata

- You can now disable automatic source tracking conflict detection via the **Source Tracking: Disable Conflict Detection** setting for improved startup performance. ([PR #7323](https://github.com/forcedotcom/salesforcedx-vscode/pull/7323))

## Fixed

#### salesforcedx-vscode-apex

- We fixed an unhandled "Channel has been closed" exception that could occur during Apex Language Server restart. ([PR #7314](https://github.com/forcedotcom/salesforcedx-vscode/pull/7314))

#### salesforcedx-vscode-org

- We fixed an issue where the source tracking status bar didn't refresh after switching orgs via the org picker. ([PR #7328](https://github.com/forcedotcom/salesforcedx-vscode/pull/7328))

## Under the Hood

- We made some under the hood changes. ([PR #7293](https://github.com/forcedotcom/salesforcedx-vscode/pull/7293), [PR #7299](https://github.com/forcedotcom/salesforcedx-vscode/pull/7299), [PR #7322](https://github.com/forcedotcom/salesforcedx-vscode/pull/7322), [PR #7325](https://github.com/forcedotcom/salesforcedx-vscode/pull/7325), [PR #7331](https://github.com/forcedotcom/salesforcedx-vscode/pull/7331), [PR #7336](https://github.com/forcedotcom/salesforcedx-vscode/pull/7336))

# 66.12.2 - May 21, 2026

## Added

#### salesforcedx-vscode-metadata

- You can now disable automatic source tracking conflict detection via the **Source Tracking: Disable Conflict Detection** setting for improved startup performance. ([PR #7323](https://github.com/forcedotcom/salesforcedx-vscode/pull/7323))

## Fixed

#### salesforcedx-vscode-lwc

- We fixed an issue where LWC HTML completions, hover, and diagnostics were not working because required modules were missing from the packaged extension. ([PR #7331](https://github.com/forcedotcom/salesforcedx-vscode/pull/7331))

#### salesforcedx-vscode-apex

- We fixed an unhandled "Channel has been closed" exception that could occur during Apex Language Server restart. ([PR #7314](https://github.com/forcedotcom/salesforcedx-vscode/pull/7314))

## Under the Hood

- We made some under the hood changes. ([PR #7293](https://github.com/forcedotcom/salesforcedx-vscode/pull/7293), [PR #7299](https://github.com/forcedotcom/salesforcedx-vscode/pull/7299), [PR #7322](https://github.com/forcedotcom/salesforcedx-vscode/pull/7322), [PR #7325](https://github.com/forcedotcom/salesforcedx-vscode/pull/7325))

# 66.12.1 - May 20, 2026

## Added

#### salesforcedx-vscode-metadata

- You can now disable automatic source tracking conflict detection via the **Source Tracking: Disable Conflict Detection** setting for improved startup performance. ([PR #7323](https://github.com/forcedotcom/salesforcedx-vscode/pull/7323))

## Fixed

#### salesforcedx-vscode-apex

- We fixed an unhandled "Channel has been closed" exception that could occur during Apex Language Server restart. ([PR #7314](https://github.com/forcedotcom/salesforcedx-vscode/pull/7314))

## Under the Hood

- We made some under the hood changes. ([PR #7299](https://github.com/forcedotcom/salesforcedx-vscode/pull/7299), [PR #7322](https://github.com/forcedotcom/salesforcedx-vscode/pull/7322))

# 66.11.0 - May 13, 2026

## Added

#### salesforcedx-vscode-services

- We made some changes under the hood. ([PR #7286](https://github.com/forcedotcom/salesforcedx-vscode/pull/7286))

#### salesforcedx-vscode-soql

- We added a setting to allow users to set the maximum number of rows to display when running a SOQL query in the builder view. ([PR #7261](https://github.com/forcedotcom/salesforcedx-vscode/pull/7261), [Discussion #5373](https://github.com/forcedotcom/salesforcedx-vscode/discussions/5373))

## Fixed

#### salesforcedx-vscode-lwc

- We fixed an issue where the **SFDX: Create Lightning Web Component** command was appearing twice in the command palette. ([PR #7302](https://github.com/forcedotcom/salesforcedx-vscode/pull/7302))

# 66.10.1 - May 7, 2026

## Fixed

#### salesforcedx-vscode-apex-testing

- We fixed a performance issue where deploying a large number of files caused the Apex Testing view to refresh slowly. ([PR #7272](https://github.com/forcedotcom/salesforcedx-vscode/pull/7272))

#### salesforcedx-vscode-soql

- We fixed a bug where Filter values were becoming blank when reopening a query in SOQL Builder UI. ([PR #7283](https://github.com/forcedotcom/salesforcedx-vscode/pull/7283))

# 66.9.0 - April 29, 2026

## Fixed

#### salesforcedx-vscode-core

- We added hover documentation support for metadata types that have a description but no Fields table. Now all `*-meta.xml` files have proper hover documentation. ([PR #7241](https://github.com/forcedotcom/salesforcedx-vscode/pull/7241))

#### salesforcedx-vscode-soql

- We fixed a bug where horizontal and vertical scrollbars were not visible in SOQL Builder UI results table. ([PR #7229](https://github.com/forcedotcom/salesforcedx-vscode/pull/7229))

# 66.8.0 - April 22, 2026

## Added

#### salesforcedx-vscode-apex-log

- When creating an Apex class, trigger, or unit test class, the output directory picker now lists package directories that contain a `classes` or `triggers` folder. ([PR #7225](https://github.com/forcedotcom/salesforcedx-vscode/pull/7225))

#### salesforcedx-vscode-apex-testing

- We added support for browsing and opening the source of Apex test classes that exist only in your org (no local file needed). ([PR #7112](https://github.com/forcedotcom/salesforcedx-vscode/pull/7112))

#### salesforcedx-vscode-metadata

- When creating an LWC component, the output directory picker now lists package directories that contain an `lwc` folder. ([PR #7225](https://github.com/forcedotcom/salesforcedx-vscode/pull/7225))
- We added a cancellable progress indicator shown during component set preparation, conflict detection, and diff computation before deploy, retrieve, and delete. ([PR #7187](https://github.com/forcedotcom/salesforcedx-vscode/pull/7187), [ISSUE #7188](https://github.com/forcedotcom/salesforcedx-vscode/issues/7188))
- We added a new **SFDX: Generate Project Info** command that collects project, org, and environment details into a `project-info.md` report to speed up support triage. ([PR #7192](https://github.com/forcedotcom/salesforcedx-vscode/pull/7192)). Next time you open an issue, try including this info.

#### salesforcedx-vscode-services

- The LWC and Aura extensions activate programmatically the first time a file inside an `/lwc/` or `/aura/` package directory is opened, or when LWC testing UI is opened. Previously, they activated in any Salesforce project. ([PR #7154](https://github.com/forcedotcom/salesforcedx-vscode/pull/7154))

#### salesforcedx-vscode-soql

- We added a **Query Plan** step to the SOQL walkthrough and refreshed the walkthrough GIF to reflect the current behavior. ([PR #7199](https://github.com/forcedotcom/salesforcedx-vscode/pull/7199))
- We added a **Set a Default Org** button under the blue banner in the **SOQL Builder UI** so you can open the org picker without leaving the view. ([PR #7183](https://github.com/forcedotcom/salesforcedx-vscode/pull/7183))

## Fixed

#### salesforcedx-lwc-language-server

- We fixed a bug where the LWC language server could overwrite a user-customized `tsconfig.json` on VS Code startup. ([PR #7207](https://github.com/forcedotcom/salesforcedx-vscode/pull/7207), [ISSUE #7203](https://github.com/forcedotcom/salesforcedx-vscode/issues/7203))

#### salesforcedx-vscode-lwc

- We reverted a change that excluded `.d.ts` files from the packaged extension so type declarations are available again. ([PR #7175](https://github.com/forcedotcom/salesforcedx-vscode/pull/7175), [ISSUE #7173](https://github.com/forcedotcom/salesforcedx-vscode/issues/7173))

#### salesforcedx-vscode-metadata

- We fixed **Diff Source Against Org** for components stored outside their standard directory (for example, Apex classes in a folder other than `classes/`). ([PR #7184](https://github.com/forcedotcom/salesforcedx-vscode/pull/7184), [ISSUE #7177](https://github.com/forcedotcom/salesforcedx-vscode/issues/7177))

#### salesforcedx-vscode-soql

- We fixed a bug where **SOQL Builder** **Run Query** results disappeared and the save buttons stopped working after switching to another tab and back. ([PR #7226](https://github.com/forcedotcom/salesforcedx-vscode/pull/7226))
- We fixed a bug where the `.soql` extension was included in the suggested file name when saving **SOQL Builder** query results as CSV or JSON; `AAA.soql` now suggests `AAA.csv` and `AAA.json`. ([PR #7181](https://github.com/forcedotcom/salesforcedx-vscode/pull/7181))
- We fixed a bug where the **SOQL Builder** toggle button failed to switch between builder view and text editor view when the **Output** panel was open. ([PR #7178](https://github.com/forcedotcom/salesforcedx-vscode/pull/7178))

# 66.5.4 - April 13, 2026

## Fixed

#### salesforcedx-lightning-lsp-common

- We fixed an error where trailing whitespaces were being trimmed from the end of **.forceignore** files. ([PR #7162](https://github.com/forcedotcom/salesforcedx-vscode/pull/7162), [ISSUE #7108](https://github.com/forcedotcom/salesforcedx-vscode/issues/7108))

#### salesforcedx-vscode-core

#### salesforcedx-vscode-metadata

#### salesforcedx-vscode-services

- We fixed some performance issues and made some UI improvements regarding deploy and retrieve commands. ([PR #7167](https://github.com/forcedotcom/salesforcedx-vscode/pull/7167), [PR #7170](https://github.com/forcedotcom/salesforcedx-vscode/pull/7170), [PR #7166](https://github.com/forcedotcom/salesforcedx-vscode/pull/7166), [PR #7168](https://github.com/forcedotcom/salesforcedx-vscode/pull/7168))

# 66.5.3 - April 10, 2026

## Added

#### salesforcedx-lwc-language-server

- We added a URL to LWC error messages for easier debugging. ([PR #7123](https://github.com/forcedotcom/salesforcedx-vscode/pull/7123))

#### salesforcedx-vscode-apex

- The Apex Language Server now uses the `MetadataRegistryService` to determine which folders to scan, skipping folders that cannot contain Apex files to reduce indexing time. ([PR #7135](https://github.com/forcedotcom/salesforcedx-vscode/pull/7135))
- We improved detection of orphaned Apex Language Server processes. Detected orphans are now automatically shut down in the background after approximately 30 seconds, rather than prompting the user to terminate them. ([PR #7135](https://github.com/forcedotcom/salesforcedx-vscode/pull/7135))

#### salesforcedx-vscode-apex-testing

- The Test Explorer's default **Run** button now runs only in-workspace tests. **Run All Tests in Org** has been moved to a secondary profile in the run dropdown. We also fixed a bug where Test Explorer exclusion filters were not consistently applied when test suites were expanded. ([PR #7137](https://github.com/forcedotcom/salesforcedx-vscode/pull/7137))

#### salesforcedx-vscode-core

- We introduced a new **Org Differences** view that displays conflicts and diffs between your project and org during deploy, retrieve, and delete operations. When a conflict is detected, you can view the conflicting files, override them, or cancel the operation. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))
- We added a new status bar icon that shows the sync state between your project and org at a glance. It turns red when conflicts are present — hover to see which files are affected, and click to deploy local changes, retrieve remote changes, or open the **Org Differences** view. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))
- Conflict detection is now smarter: only components in the current deploy/retrieve/delete set are checked for conflicts, and whitespace-only differences are no longer flagged. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))
- We added a new **Show Success Notification** setting that controls whether a notification toast appears after a successful deploy, retrieve, or delete operation. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))

#### salesforcedx-vscode-expanded

- We added the **Salesforce Metadata Visualizer** extension to the Salesforce Extension Pack (Expanded). ([PR #7129](https://github.com/forcedotcom/salesforcedx-vscode/pull/7129))

#### salesforcedx-vscode-soql

- The SOQL Builder UI now hides its query builder dropdowns and **Run Query** button, and shows a warning when no default org is set. ([PR #7092](https://github.com/forcedotcom/salesforcedx-vscode/pull/7092))

## Fixed

#### salesforcedx-aura-language-server

- We fixed an issue where the Aura Language Server was producing an error notification when reindexing Aura components. ([PR #7133](https://github.com/forcedotcom/salesforcedx-vscode/pull/7133))

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-apex-oas

#### salesforcedx-vscode-apex-replay-debugger

- When an org lacks access to `PackageLicense`, we added a fallback to the `InstalledSubscriberPackage` tooling query. ([PR #7155](https://github.com/forcedotcom/salesforcedx-vscode/pull/7155))
- We made some changes under the hood. ([PR #7130](https://github.com/forcedotcom/salesforcedx-vscode/pull/7130))

#### salesforcedx-vscode-apex-testing

#### salesforcedx-vscode-metadata

- We fixed a bug where debugging a single test method in the Apex Test Explorer incorrectly ran the entire class instead of only the selected method. ([PR #7127](https://github.com/forcedotcom/salesforcedx-vscode/pull/7127), [ISSUE #7120](https://github.com/forcedotcom/salesforcedx-vscode/issues/7120))
- We fixed a bug where the Apex Test Explorer did not refresh after metadata changes. ([PR #7140](https://github.com/forcedotcom/salesforcedx-vscode/pull/7140))
- We added a message to the Apex Testing sidebar reminding users to deploy their Apex tests to the default org if no tests appear. ([PR #7152](https://github.com/forcedotcom/salesforcedx-vscode/pull/7152))
- Strip subclass for vscode RPC serialization W-21972447 ([PR #7159](https://github.com/forcedotcom/salesforcedx-vscode/pull/7159))
  
#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #7145](https://github.com/forcedotcom/salesforcedx-vscode/pull/7145), [PR #7073](https://github.com/forcedotcom/salesforcedx-vscode/pull/7073), [PR #7124](https://github.com/forcedotcom/salesforcedx-vscode/pull/7124))

#### salesforcedx-vscode-org

#### salesforcedx-utils-vscode

- We fixed a bug where duplicate **Org Management** output channels were created. ([PR #7144](https://github.com/forcedotcom/salesforcedx-vscode/pull/7144))
- We fixed a bug in Agentforce Vibes IDE where, after re-authorizing via the login popup, the status bar continued to show **No Default Org Set**, and attempting to set the newly authorized org as the default produced `Error: No authorization information found for reauth-vscodeOrg`. ([PR #7141](https://github.com/forcedotcom/salesforcedx-vscode/pull/7141))

#### salesforcedx-vscode-services

- We made some changes under the hood. ([PR #7138](https://github.com/forcedotcom/salesforcedx-vscode/pull/7138))
- We fixed a bug where creating Typescript LWC components was failing. ([PR #7126](https://github.com/forcedotcom/salesforcedx-vscode/pull/7126))
- Strip subclass for vscode RPC serialization W-21972447 ([PR #7159](https://github.com/forcedotcom/salesforcedx-vscode/pull/7159))
- CBW esbuild web config returns undefined when no org alias set W-21985385 ([PR #7164](https://github.com/forcedotcom/salesforcedx-vscode/pull/7164))

#### salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #7143](https://github.com/forcedotcom/salesforcedx-vscode/pull/7143))# 66.5.2 - April 12, 2026

# 66.5.2 - April 9, 2026

## Added

#### salesforcedx-lwc-language-server

- We added a URL to LWC error messages for easier debugging. ([PR #7123](https://github.com/forcedotcom/salesforcedx-vscode/pull/7123))

#### salesforcedx-vscode-apex

- The Apex Language Server now uses the `MetadataRegistryService` to determine which folders to scan, skipping folders that cannot contain Apex files to reduce indexing time. ([PR #7135](https://github.com/forcedotcom/salesforcedx-vscode/pull/7135))
- We improved detection of orphaned Apex Language Server processes. Detected orphans are now automatically shut down in the background after approximately 30 seconds, rather than prompting the user to terminate them. ([PR #7135](https://github.com/forcedotcom/salesforcedx-vscode/pull/7135))

#### salesforcedx-vscode-apex-testing

- The Test Explorer's default **Run** button now runs only in-workspace tests. **Run All Tests in Org** has been moved to a secondary profile in the run dropdown. We also fixed a bug where Test Explorer exclusion filters were not consistently applied when test suites were expanded. ([PR #7137](https://github.com/forcedotcom/salesforcedx-vscode/pull/7137))

#### salesforcedx-vscode-core

- We introduced a new **Org Differences** view that displays conflicts and diffs between your project and org during deploy, retrieve, and delete operations. When a conflict is detected, you can view the conflicting files, override them, or cancel the operation. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))
- We added a new status bar icon that shows the sync state between your project and org at a glance. It turns red when conflicts are present — hover to see which files are affected, and click to deploy local changes, retrieve remote changes, or open the **Org Differences** view. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))
- Conflict detection is now smarter: only components in the current deploy/retrieve/delete set are checked for conflicts, and whitespace-only differences are no longer flagged. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))
- We added a new **Show Success Notification** setting that controls whether a notification toast appears after a successful deploy, retrieve, or delete operation. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))

#### salesforcedx-vscode-expanded

- We added the **Salesforce Metadata Visualizer** extension to the Salesforce Extension Pack (Expanded). ([PR #7129](https://github.com/forcedotcom/salesforcedx-vscode/pull/7129))

#### salesforcedx-vscode-soql

- The SOQL Builder UI now hides its query builder dropdowns and **Run Query** button, and shows a warning when no default org is set. ([PR #7092](https://github.com/forcedotcom/salesforcedx-vscode/pull/7092))

## Fixed

#### salesforcedx-aura-language-server

- We fixed an issue where the Aura Language Server was producing an error notification when reindexing Aura components. ([PR #7133](https://github.com/forcedotcom/salesforcedx-vscode/pull/7133))

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-apex-oas

#### salesforcedx-vscode-apex-replay-debugger

- When an org lacks access to `PackageLicense`, we added a fallback to the `InstalledSubscriberPackage` tooling query. ([PR #7155](https://github.com/forcedotcom/salesforcedx-vscode/pull/7155))
- We made some changes under the hood. ([PR #7130](https://github.com/forcedotcom/salesforcedx-vscode/pull/7130))

#### salesforcedx-vscode-apex-testing

#### salesforcedx-vscode-metadata

- We fixed a bug where debugging a single test method in the Apex Test Explorer incorrectly ran the entire class instead of only the selected method. ([PR #7127](https://github.com/forcedotcom/salesforcedx-vscode/pull/7127), [ISSUE #7120](https://github.com/forcedotcom/salesforcedx-vscode/issues/7120))
- We fixed a bug where the Apex Test Explorer did not refresh after metadata changes. ([PR #7140](https://github.com/forcedotcom/salesforcedx-vscode/pull/7140))
- We added a message to the Apex Testing sidebar reminding users to deploy their Apex tests to the default org if no tests appear. ([PR #7152](https://github.com/forcedotcom/salesforcedx-vscode/pull/7152))
- Strip subclass for vscode RPC serialization W-21972447 ([PR #7159](https://github.com/forcedotcom/salesforcedx-vscode/pull/7159))
  
#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #7145](https://github.com/forcedotcom/salesforcedx-vscode/pull/7145), [PR #7073](https://github.com/forcedotcom/salesforcedx-vscode/pull/7073), [PR #7124](https://github.com/forcedotcom/salesforcedx-vscode/pull/7124))

#### salesforcedx-vscode-org

#### salesforcedx-utils-vscode

- We fixed a bug where duplicate **Org Management** output channels were created. ([PR #7144](https://github.com/forcedotcom/salesforcedx-vscode/pull/7144))
- We fixed a bug in Agentforce Vibes IDE where, after re-authorizing via the login popup, the status bar continued to show **No Default Org Set**, and attempting to set the newly authorized org as the default produced `Error: No authorization information found for reauth-vscodeOrg`. ([PR #7141](https://github.com/forcedotcom/salesforcedx-vscode/pull/7141))

#### salesforcedx-vscode-services

- We made some changes under the hood. ([PR #7138](https://github.com/forcedotcom/salesforcedx-vscode/pull/7138))
- We fixed a bug where creating Typescript LWC components was failing. ([PR #7126](https://github.com/forcedotcom/salesforcedx-vscode/pull/7126))
- Strip subclass for vscode RPC serialization W-21972447 ([PR #7159](https://github.com/forcedotcom/salesforcedx-vscode/pull/7159))

#### salesforcedx-vscode-soql

- We mde some changes under the hood. ([PR #7143](https://github.com/forcedotcom/salesforcedx-vscode/pull/7143))# 66.5.2 - April 12, 2026

# 66.5.1 - April 9, 2026

## Added

#### salesforcedx-lwc-language-server

- We added a URL to LWC error messages for easier debugging. ([PR #7123](https://github.com/forcedotcom/salesforcedx-vscode/pull/7123))

#### salesforcedx-vscode-apex

- The Apex Language Server now uses the `MetadataRegistryService` to determine which folders to scan, skipping folders that cannot contain Apex files to reduce indexing time. ([PR #7135](https://github.com/forcedotcom/salesforcedx-vscode/pull/7135))
- We improved detection of orphaned Apex Language Server processes. Detected orphans are now automatically shut down in the background after approximately 30 seconds, rather than prompting the user to terminate them. ([PR #7135](https://github.com/forcedotcom/salesforcedx-vscode/pull/7135))

#### salesforcedx-vscode-apex-testing

- The Test Explorer's default **Run** button now runs only in-workspace tests. **Run All Tests in Org** has been moved to a secondary profile in the run dropdown. We also fixed a bug where Test Explorer exclusion filters were not consistently applied when test suites were expanded. ([PR #7137](https://github.com/forcedotcom/salesforcedx-vscode/pull/7137))

#### salesforcedx-vscode-core

- We introduced a new **Org Differences** view that displays conflicts and diffs between your project and org during deploy, retrieve, and delete operations. When a conflict is detected, you can view the conflicting files, override them, or cancel the operation. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))
- We added a new status bar icon that shows the sync state between your project and org at a glance. It turns red when conflicts are present — hover to see which files are affected, and click to deploy local changes, retrieve remote changes, or open the **Org Differences** view. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))
- Conflict detection is now smarter: only components in the current deploy/retrieve/delete set are checked for conflicts, and whitespace-only differences are no longer flagged. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))
- We added a new **Show Success Notification** setting that controls whether a notification toast appears after a successful deploy, retrieve, or delete operation. ([PR #7009](https://github.com/forcedotcom/salesforcedx-vscode/pull/7009))

#### salesforcedx-vscode-expanded

- We added the **Salesforce Metadata Visualizer** extension to the Salesforce Extension Pack (Expanded). ([PR #7129](https://github.com/forcedotcom/salesforcedx-vscode/pull/7129))

#### salesforcedx-vscode-soql

- The SOQL Builder UI now hides its query builder dropdowns and **Run Query** button, and shows a warning when no default org is set. ([PR #7092](https://github.com/forcedotcom/salesforcedx-vscode/pull/7092))

## Fixed

#### salesforcedx-aura-language-server

- We fixed an issue where the Aura Language Server was producing an error notification when reindexing Aura components. ([PR #7133](https://github.com/forcedotcom/salesforcedx-vscode/pull/7133))

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-apex-oas

#### salesforcedx-vscode-apex-replay-debugger

- When an org lacks access to `PackageLicense`, we added a fallback to the `InstalledSubscriberPackage` tooling query. ([PR #7155](https://github.com/forcedotcom/salesforcedx-vscode/pull/7155))
- We made some changes under the hood. ([PR #7130](https://github.com/forcedotcom/salesforcedx-vscode/pull/7130))

#### salesforcedx-vscode-apex-testing

#### salesforcedx-vscode-metadata

- We fixed a bug where debugging a single test method in the Apex Test Explorer incorrectly ran the entire class instead of only the selected method. ([PR #7127](https://github.com/forcedotcom/salesforcedx-vscode/pull/7127), [ISSUE #7120](https://github.com/forcedotcom/salesforcedx-vscode/issues/7120))
- We fixed a bug where the Apex Test Explorer did not refresh after metadata changes. ([PR #7140](https://github.com/forcedotcom/salesforcedx-vscode/pull/7140))
- We added a message to the Apex Testing sidebar reminding users to deploy their Apex tests to the default org if no tests appear. ([PR #7152](https://github.com/forcedotcom/salesforcedx-vscode/pull/7152))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #7145](https://github.com/forcedotcom/salesforcedx-vscode/pull/7145), [PR #7073](https://github.com/forcedotcom/salesforcedx-vscode/pull/7073), [PR #7124](https://github.com/forcedotcom/salesforcedx-vscode/pull/7124))

#### salesforcedx-vscode-org

#### salesforcedx-utils-vscode

- We fixed a bug where duplicate **Org Management** output channels were created. ([PR #7144](https://github.com/forcedotcom/salesforcedx-vscode/pull/7144))
- We fixed a bug in Agentforce Vibes IDE where, after re-authorizing via the login popup, the status bar continued to show **No Default Org Set**, and attempting to set the newly authorized org as the default produced `Error: No authorization information found for reauth-vscodeOrg`. ([PR #7141](https://github.com/forcedotcom/salesforcedx-vscode/pull/7141))

#### salesforcedx-vscode-services

- We made some changes under the hood. ([PR #7138](https://github.com/forcedotcom/salesforcedx-vscode/pull/7138))
- We fixed a bug where creating Typescript LWC components was failing. ([PR #7126](https://github.com/forcedotcom/salesforcedx-vscode/pull/7126))

#### salesforcedx-vscode-soql

- We mde some changes under the hood. ([PR #7143](https://github.com/forcedotcom/salesforcedx-vscode/pull/7143))

# 66.4.4 - April 2, 2026

## Added

#### salesforcedx-aura-language-server

#### salesforcedx-lightning-lsp-common

#### salesforcedx-lwc-language-server

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We replaced LWC and Aura server-ready popup notifications with a shared custom ready notification and in-editor language status items. ([PR #7054](https://github.com/forcedotcom/salesforcedx-vscode/pull/7054))

#### salesforcedx-vscode-core

- We added `defaultLwcLanguage` as a valid key to the sfdx-project.json schema. ([PR #7109](https://github.com/forcedotcom/salesforcedx-vscode/pull/7109))

- We renamed `WebApplication` to `UiBundle` for the **React External App** and **React Internal App** templates in **SFDX: Create Project**. ([PR #7100](https://github.com/forcedotcom/salesforcedx-vscode/pull/7100))

- We moved the following commands to the **Apex Log** extension:
  1. SFDX: Create Apex Class
  2. SFDX: Create Apex Unit Test Class
  3. SFDX: Create Apex Trigger
     ([PR #7028](https://github.com/forcedotcom/salesforcedx-vscode/pull/7028))

#### salesforcedx-vscode-expanded

- We added the **Salesforce Live Preview** (salesforce.salesforcedx-vscode-ui-preview) extension to the Salesforce Extension Pack (Expanded), enabling developers to preview Lightning Web Components directly in VS Code with live updates on save. ([PR #7058](https://github.com/forcedotcom/salesforcedx-vscode/pull/7058))

- We added the **GraphQL Syntax Highlighting** (GraphQL.vscode-graphql-syntax) extension to the Salesforce Extension Pack (Expanded) to provide syntax highlighting for GraphQL files. ([PR #7114](https://github.com/forcedotcom/salesforcedx-vscode/pull/7114))

#### salesforcedx-vscode-soql

- We added a "Run Query" code lens in `.soql` files and a new command **SFDX: Execute SOQL Query with Current File** in the command palette; the previous **SFDX: Execute SOQL Query...** command has been removed. ([PR #7089](https://github.com/forcedotcom/salesforcedx-vscode/pull/7089))

- We added a "Get Query Plan" button to the SOQL Builder UI. ([PR #7094](https://github.com/forcedotcom/salesforcedx-vscode/pull/7094))

## Fixed

#### salesforcedx-lightning-lsp-common

- We fixed a bug where `jsconfig.json` files were repeatedly modified with duplicate lines on VS Code startup. ([PR #7087](https://github.com/forcedotcom/salesforcedx-vscode/pull/7087), [ISSUE #7084](https://github.com/forcedotcom/salesforcedx-vscode/issues/7084))

#### salesforcedx-aura-language-server

#### salesforcedx-lwc-language-server

#### salesforcedx-vscode-lwc

- We fixed a bug where changes to `CustomLabels.labels-meta.xml` were not reflected in `.sfdx/typings/lwc/customlabels.d.ts`. ([PR #7065](https://github.com/forcedotcom/salesforcedx-vscode/pull/7065))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #7107](https://github.com/forcedotcom/salesforcedx-vscode/pull/7107), [PR #7116](https://github.com/forcedotcom/salesforcedx-vscode/pull/7116))

- We fixed a bug where source path-based deploy/retrieve ignored the `sourceApiVersion` set in sfdx-project.json. ([PR #7106](https://github.com/forcedotcom/salesforcedx-vscode/pull/7106))

- We fixed a bug where `_` in Apex test method names were incorrectly rendered as `\_`. ([PR #7091](https://github.com/forcedotcom/salesforcedx-vscode/pull/7091), [ISSUE #7075](https://github.com/forcedotcom/salesforcedx-vscode/issues/7075))

- We fixed a bug where the `.sfdx` folder could be created outside a Salesforce project during extension startup. ([PR #7095](https://github.com/forcedotcom/salesforcedx-vscode/pull/7095))

- The CLI Integration extension now sets `"xml.server.vmargs": "-Xmx1024M"` in the User settings.json if the value is absent or smaller, preventing Out of Memory errors when loading metadata XML hover documentation. ([PR #7115](https://github.com/forcedotcom/salesforcedx-vscode/pull/7115))

#### salesforcedx-vscode-apex

- We fixed a bug where `.soql` files were detected as language Apex instead of SOQL on Windows. ([PR #7117](https://github.com/forcedotcom/salesforcedx-vscode/pull/7117))

- We reverted the defensive Apex Language Server shutdown handling that was causing slowdowns when reloading, closing, or switching VS Code workspaces. ([PR #7119](https://github.com/forcedotcom/salesforcedx-vscode/pull/7119))

#### salesforcedx-vscode-org

- The soon-to-expire scratch orgs list in the Output tab now shows each org's alias and username. ([PR #7118](https://github.com/forcedotcom/salesforcedx-vscode/pull/7118), [ISSUE #7099](https://github.com/forcedotcom/salesforcedx-vscode/issues/7099))

# 66.4.2 - March 31, 2026

## Added

#### salesforcedx-aura-language-server

#### salesforcedx-lightning-lsp-common

#### salesforcedx-lwc-language-server

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We replaced LWC and Aura server-ready popup notifications with a shared custom ready notification and in-editor language status items. ([PR #7054](https://github.com/forcedotcom/salesforcedx-vscode/pull/7054))

#### salesforcedx-vscode-core

- We added `defaultLwcLanguage` as a valid key to the sfdx-project.json schema. ([PR #7109](https://github.com/forcedotcom/salesforcedx-vscode/pull/7109))

- We renamed `WebApplication` to `UiBundle` for the **React External App** and **React Internal App** templates in **SFDX: Create Project**. ([PR #7100](https://github.com/forcedotcom/salesforcedx-vscode/pull/7100))

#### salesforcedx-vscode-expanded

- We added the **Salesforce Live Preview** extension to the Salesforce Extension Pack (Expanded), enabling developers to preview Lightning Web Components directly in VS Code with live updates on save. ([PR #7058](https://github.com/forcedotcom/salesforcedx-vscode/pull/7058))

#### salesforcedx-vscode-soql

- We added a "Run Query" code lens in `.soql` files and a new command **SFDX: Execute SOQL Query with Current File** in the command palette; the previous **SFDX: Execute SOQL Query...** command has been removed. ([PR #7089](https://github.com/forcedotcom/salesforcedx-vscode/pull/7089))

- We added a "Get Query Plan" button to the SOQL Builder UI. ([PR #7094](https://github.com/forcedotcom/salesforcedx-vscode/pull/7094))

## Fixed

#### salesforcedx-lightning-lsp-common

- We fixed a bug where `jsconfig.json` files were repeatedly modified with duplicate lines on VS Code startup. ([PR #7087](https://github.com/forcedotcom/salesforcedx-vscode/pull/7087), [ISSUE #7084](https://github.com/forcedotcom/salesforcedx-vscode/issues/7084))

#### salesforcedx-aura-language-server

#### salesforcedx-lwc-language-server

#### salesforcedx-vscode-lwc

- We fixed a bug where changes to `CustomLabels.labels-meta.xml` were not reflected in `.sfdx/typings/lwc/customlabels.d.ts`. ([PR #7065](https://github.com/forcedotcom/salesforcedx-vscode/pull/7065))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #7107](https://github.com/forcedotcom/salesforcedx-vscode/pull/7107))

- We fixed a bug where source path-based deploy/retrieve ignored the `sourceApiVersion` set in sfdx-project.json. ([PR #7106](https://github.com/forcedotcom/salesforcedx-vscode/pull/7106))

- We fixed a bug where `_` in Apex test method names were incorrectly rendered as `\_`. ([PR #7091](https://github.com/forcedotcom/salesforcedx-vscode/pull/7091), [ISSUE #7075](https://github.com/forcedotcom/salesforcedx-vscode/issues/7075))

- We fixed a bug where the `.sfdx` folder could be created outside a Salesforce project during extension startup. ([PR #7095](https://github.com/forcedotcom/salesforcedx-vscode/pull/7095))

# 66.3.2 - March 29, 2026

## Added

#### salesforcedx-vscode-apex

- Gate LSP telemetry/event forwarding so only allowlisted Jorje Feature values are sent as apexLSPLog, reducing high-volume editor telemetry toward Application Insights. ([PR #7044](https://github.com/forcedotcom/salesforcedx-vscode/pull/7044))

#### salesforcedx-vscode-apex-log
#### salesforcedx-vscode-apex-testing
#### salesforcedx-vscode-lwc
#### salesforcedx-vscode-metadata
#### salesforcedx-vscode-org-browser
#### salesforcedx-vscode-services
#### salesforcedx-vscode-soql

- We made changes under the hood ([PR #7055](https://github.com/forcedotcom/salesforcedx-vscode/pull/7055))

#### salesforcedx-vscode-core

- Renamed react web app templates ([PR #7070](https://github.com/forcedotcom/salesforcedx-vscode/pull/7070))


## Fixed

#### salesforcedx-lightning-lsp-common

- Fixed an issue where vscode settings were overriden ([PR #7077](https://github.com/forcedotcom/salesforcedx-vscode/pull/7077))

#### salesforcedx-vscode-soql

- Report sub-query records correctly in SOQL execution table output ([PR #7034](https://github.com/forcedotcom/salesforcedx-vscode/pull/7034))

# 66.3.1 - March 27, 2026

## Added

#### salesforcedx-vscode-core

- Apex class creation now includes template selection, so developers can choose a starter pattern at creation time instead of manually editing generated files after creation. ([PR #7023](https://github.com/forcedotcom/salesforcedx-vscode/pull/7023))

- Added support for creating agent project templates to streamline Agentforce project setup and reduce manual project scaffolding steps. ([PR #7027](https://github.com/forcedotcom/salesforcedx-vscode/pull/7027))

#### salesforcedx-vscode-soql

- Query Plan is now available in the SOQL extension text editor view, making it easier to inspect query cost and optimize performance without leaving the editor. ([PR #7013](https://github.com/forcedotcom/salesforcedx-vscode/pull/7013))

## Fixed

#### salesforcedx-vscode

#### salesforcedx-vscode-expanded

- Added the Agentforce DX extension to both the Salesforce Extension Pack and the Salesforce Extension Pack (Expanded) so Agentforce capabilities are available as part of the packaged experience. ([PR #7003](https://github.com/forcedotcom/salesforcedx-vscode/pull/7003))

#### salesforcedx-vscode-apex

- Added defensive Apex Language Server shutdown handling to prevent orphaned background processes during extension restart or deactivation. ([PR #7031](https://github.com/forcedotcom/salesforcedx-vscode/pull/7031))

#### salesforcedx-vscode-apex-testing

- Added a guided VS Code walkthrough for Apex Test Explorer to help new users discover and use core testing workflows faster W-21655739 ([PR #7017](https://github.com/forcedotcom/salesforcedx-vscode/pull/7017))

- Fixed Apex testing extension test suite membership for duplicate class names to avoid ambiguous class resolution. ([PR #7016](https://github.com/forcedotcom/salesforcedx-vscode/pull/7016))

- Improved Apex testing extension error messaging with clearer guidance to help users diagnose and recover from common failures. ([PR #7005](https://github.com/forcedotcom/salesforcedx-vscode/pull/7005))

#### salesforcedx-vscode-core

- Added a quick pick option for agent project templates so template choice is surfaced directly in the command flow. ([PR #7045](https://github.com/forcedotcom/salesforcedx-vscode/pull/7045))

- Fixed issues in org logout, alias management, and org picker interactions to improve org lifecycle reliability and day-to-day UX. ([PR #6992](https://github.com/forcedotcom/salesforcedx-vscode/pull/6992))

- Made changes under the hood to catch up with the latest SDR library changes for compatibility and stability improvements. ([PR #7020](https://github.com/forcedotcom/salesforcedx-vscode/pull/7020))

#### salesforcedx-vscode-metadata

- Updated command visibility so LWC commands are not shown when no Salesforce project is open, reducing confusion and invalid command execution paths. ([PR #7024](https://github.com/forcedotcom/salesforcedx-vscode/pull/7024))

#### salesforcedx-vscode-org

- Added clearer org auth guidance for port `1717` scenarios to help users recover from local auth flow issues more quickly. ([PR #7066](https://github.com/forcedotcom/salesforcedx-vscode/pull/7066))

# 66.2.3 - March 21, 2026

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #7000](https://github.com/forcedotcom/salesforcedx-vscode/pull/7000))

#### salesforcedx-vscode-apex-testing

- **SFDX: Create Apex Test Suite** and **SFDX: Run Apex Tests** commands now list the tests in the org and not those in the workspace. ([PR #6980](https://github.com/forcedotcom/salesforcedx-vscode/pull/6980))

#### salesforcedx-apex-log

- You can now use the **SFDX: Change Trace Flag Debug Level** command to modify the LogLevel on `TraceFlag` for yourself or another user. ([PR #6987](https://github.com/forcedotcom/salesforcedx-vscode/pull/6987))

#### salesforcedx-vscode-org-browser

- The new Org Browser is now the only org browser. The legacy org browser has been removed from the core extension. The sidebar item now only appears when an org is connected. ([PR #6988](https://github.com/forcedotcom/salesforcedx-vscode/pull/6988))

#### salesforcedx-vscode-services

#### salesforcedx-vscode-soql

- We added a new **SFDX: Create SOQL Query** command that allows users to create a SOQL query, and open it directly in the text editor view. ([PR #6996](https://github.com/forcedotcom/salesforcedx-vscode/pull/6996))

- We updated the **SFDX: Create Query in SOQL Builder** command to prompt for a filename before creating the file, instead of defaulting to an unsaved `untitled.soql` file. This aligns the experience with other create commands and removes the need to save manually. ([PR #6981](https://github.com/forcedotcom/salesforcedx-vscode/pull/6981))

- We made some changes under the hood. ([PR #6965](https://github.com/forcedotcom/salesforcedx-vscode/pull/6965))

## Fixed

#### salesforcedx-vscode-soql

- We fixed a bug in the display of the SOQL query execution results table that was causing columns in the Output tab to be displayed out of order when the first entries had null value. ([PR #6995](https://github.com/forcedotcom/salesforcedx-vscode/pull/6995))

- When executing a SOQL query, the row count is now shown at the bottom of the Output Tab instead of at the top. Thank you [@cnaccio](https://github.com/cnaccio) for pointing it out. ([PR #6975](https://github.com/forcedotcom/salesforcedx-vscode/pull/6975))

#### salesforcedx-vscode-metadata

- We made some changes under the hood. ([PR #7014](https://github.com/forcedotcom/salesforcedx-vscode/pull/7014))

# 66.2.2 - March 20, 2026

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #7000](https://github.com/forcedotcom/salesforcedx-vscode/pull/7000))

#### salesforcedx-vscode-apex-testing

- **SFDX: Create Apex Test Suite** and **SFDX: Run Apex Tests** commands now list the tests in the org and not those in the workspace. ([PR #6980](https://github.com/forcedotcom/salesforcedx-vscode/pull/6980))

#### salesforcedx-apex-log

- You can now use the **SFDX: Change Trace Flag Debug Level** command to modify the LogLevel on `TraceFlag` for yourself or another user ([PR #6987](https://github.com/forcedotcom/salesforcedx-vscode/pull/6987))

#### salesforcedx-vscode-org-browser

- The new Org Browser is now the only org browser. The legacy org browser has been removed from the core extension. The sidebar item now only appears when an org is connected. ([PR #6988](https://github.com/forcedotcom/salesforcedx-vscode/pull/6988))

#### salesforcedx-vscode-services

#### salesforcedx-vscode-soql

- We added a new **SFDX: Create SOQL Query** command that allows users to create a SOQL query, and open it directly in the text editor view. ([PR #6996](https://github.com/forcedotcom/salesforcedx-vscode/pull/6996))

- We updated the **SFDX: Create Query in SOQL Builder** command to prompt for a filename before creating the file, instead of defaulting to an unsaved `untitled.soql` file. This aligns the experience with other create commands and removes the need to save manually. ([PR #6981](https://github.com/forcedotcom/salesforcedx-vscode/pull/6981))

- We made some changes under the hood. ([PR #6965](https://github.com/forcedotcom/salesforcedx-vscode/pull/6965))

## Fixed

#### salesforcedx-vscode-soql

- We fixed a bug in the display of the SOQL query execution results table that was causing columns in the Output tab to be displayed out of order when the first entries had null value. ([PR #6995](https://github.com/forcedotcom/salesforcedx-vscode/pull/6995))

- When executing a SOQL query, the row count is now shown at the bottom of the Output Tab instead of at the top. Thank you [@cnaccio](https://github.com/cnaccio) for pointing it out. ([PR #6975](https://github.com/forcedotcom/salesforcedx-vscode/pull/6975))

# 66.2.1 - March 19, 2026

## Added

#### salesforcedx-vscode-apex-testing

- **SFDX: Create Apex Test Suite** and **SFDX: Run Apex Tests** commands now list the tests in the org and not those in the workspace. ([PR #6980](https://github.com/forcedotcom/salesforcedx-vscode/pull/6980))

#### salesforcedx-apex-log

- You the **SFDX: Change Trace Flag Debug Level** command to modify the LogLevel on `TraceFlag` for yourself or another user ([PR #6987](https://github.com/forcedotcom/salesforcedx-vscode/pull/6987))

#### salesforcedx-vscode-org-browser

- The new Org Browser is now the only org browser. The legacy org browser has been removed from the core extension. The sidebar item now only appears when an org is connected. ([PR #6988](https://github.com/forcedotcom/salesforcedx-vscode/pull/6988))

#### salesforcedx-vscode-services

#### salesforcedx-vscode-soql

- We added a new **SFDX: Create SOQL Query** command that allows users to create a SOQL query, and open it directly in the text editor view. ([PR #6996](https://github.com/forcedotcom/salesforcedx-vscode/pull/6996))

- We updated the **SFDX: Create Query in SOQL Builder** command to prompt for a filename before creating the file, instead of defaulting to an unsaved `untitled.soql` file. This aligns the experience with other create commands and removes the need to save manually. ([PR #6981](https://github.com/forcedotcom/salesforcedx-vscode/pull/6981))

- We made some changes under the hood. ([PR #6965](https://github.com/forcedotcom/salesforcedx-vscode/pull/6965))

## Fixed

#### salesforcedx-vscode-soql

- We fixed a bug in the display of the SOQL query execution results table that was causing columns in the Output tab to be displayed out of order when the first entries had null value. ([PR #6995](https://github.com/forcedotcom/salesforcedx-vscode/pull/6995))

- When executing a SOQL query, the row count is now shown at the bottom of the Output Tab instead of at the top. Thank you [@cnaccio](https://github.com/cnaccio) for pointing it out. ([PR #6975](https://github.com/forcedotcom/salesforcedx-vscode/pull/6975))

# 66.1.1 - March 12, 2026

## Added

#### salesforcedx-vscode-core

- We added a progress indicator to SFDX:Refresh SObjects command & refactored it to use shared services, improving performance and consistency. ([PR #6925](https://github.com/forcedotcom/salesforcedx-vscode/pull/6925))

#### salesforcedx-vscode-org

- Verification code now appear when authorizing an org or Dev Hub in the Agentforce Vibes IDE. ([PR #6945](https://github.com/forcedotcom/salesforcedx-vscode/pull/6945))

## Fixed

#### docs

- We made some changes under the hood. ([PR #6963](https://github.com/forcedotcom/salesforcedx-vscode/pull/6963))

#### salesforcedx-lwc-language-server
#### salesforcedx-vscode-apex-testing
#### salesforcedx-vscode-org-browser
#### salesforcedx-vscode-services

- Fixed issues with Apex Testing in web-based VS Code environments (such as vscode.dev) and improved file discovery for more reliable test execution across web and desktop. ([PR #6930](https://github.com/forcedotcom/salesforcedx-vscode/pull/6930))

#### salesforcedx-vscode-core

- We fixed a missing label error that was appearing when running **SFDX: Create Lightning Web Component**. ([PR #6948](https://github.com/forcedotcom/salesforcedx-vscode/pull/6948))

#### salesforcedx-vscode-lightning
#### salesforcedx-vscode-lwc
#### salesforcedx-lightning-lsp-common

- We fixed a behavior where files written to by language server were opened in the user's IDE ([PR #6946](https://github.com/forcedotcom/salesforcedx-vscode/pull/6946))

# 66.0.3 - March 4, 2026

## Added

Updates for the Spring 26 (v66.0) release.

#### salesforcedx-vscode-apex-testing

- Apex tests in the Test Explorer are now organized in a hierarchy of Namespace → Package → Class → Method, making it easy to distinguish unpackaged tests, 1GP namespaced tests, and 2GP package tests (including unlocked packages). A Local Namespace groups classes without a namespace, and tests can be filtered and run/debugged at the namespace or package level. Package resolution is handled automatically per org, with intelligent fallbacks and caching for improved performance and reliability. ([PR #6888](https://github.com/forcedotcom/salesforcedx-vscode/pull/6888))

#### salesforcedx-vscode-core

- The `SFDX: Create Project` command now has new templates for React support. ([PR #6884](https://github.com/forcedotcom/salesforcedx-vscode/pull/6884))

#### salesforcedx-vscode-lwc

- We added a new setting to enable TypeScript LWC components. ([PR #6872](https://github.com/forcedotcom/salesforcedx-vscode/pull/6872))

#### salesforcedx-vscode-apex-log

- We introduced Apex Log, a dedicated extension for Apex debugging and log workflows with these features-
  - You can create Trace Flags for any user in your org, define reusable Debug Levels, and manage both directly from VS Code.
  - An enhanced Status Bar indicator that shows when a trace is active and when it expires, with quick actions to view and manage Trace Flags and Debug Levels. Now logs automatically download in the background while a trace is active (polling frequency configurable via `logPollIntervalSeconds`).
  - Running Anonymous Apex now automatically retrieves and opens the corresponding log even creating a temporary Trace Flag, if needed. A new command also lets you quickly generate a placeholder Anonymous Apex script.

#### salesforcedx-vscode-org

- We refreshed the org picker with a cleaner, more organized layout. Orgs are now "*org*anized" into sections by type (for example, Scratch Org and Sandbox), with aliased orgs prioritized at the top of each section. Visual indicators (tree and leaf) make it easy to identify your default org and Dev Hub at a glance. ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

#### salesforcedx-vscode-services-types

- We integrated shared org icons into the Services extension and updated the org picker to use the new icons for a more consistent experience. ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

# 66.0.2 - March 6, 2026

## Added

Updates for the Spring 26 (v66.0) release.

#### salesforcedx-vscode-apex-testing

- Apex tests in the Test Explorer are now organized in a hierarchy of Namespace → Package → Class → Method, making it easy to distinguish unpackaged tests, 1GP namespaced tests, and 2GP package tests (including unlocked packages). A Local Namespace groups classes without a namespace, and tests can be filtered and run/debugged at the namespace or package level. Package resolution is handled automatically per org, with intelligent fallbacks and caching for improved performance and reliability. ([PR #6888](https://github.com/forcedotcom/salesforcedx-vscode/pull/6888))

#### salesforcedx-vscode-core

- The `SFDX: Create Project` command now has new templates for React support. ([PR #6884](https://github.com/forcedotcom/salesforcedx-vscode/pull/6884))

#### salesforcedx-vscode-lwc

- We added a new setting to enable TypeScript LWC components. ([PR #6872](https://github.com/forcedotcom/salesforcedx-vscode/pull/6872))

#### salesforcedx-vscode-apex-log

- We introduced Apex Log, a dedicated extension for Apex debugging and log workflows with these features-
  - You can create Trace Flags for any user in your org, define reusable Debug Levels, and manage both directly from VS Code.
  - An enhanced Status Bar indicator that shows when a trace is active and when it expires, with quick actions to view and manage Trace Flags and Debug Levels. Now logs automatically download in the background while a trace is active (polling frequency configurable via `logPollIntervalSeconds`).
  - Running Anonymous Apex now automatically retrieves and opens the corresponding log even creating a temporary Trace Flag, if needed. A new command also lets you quickly generate a placeholder Anonymous Apex script.

#### salesforcedx-vscode-org

- We refreshed the org picker with a cleaner, more organized layout. Orgs are now "*org*anized" into sections by type (for example, Scratch Org and Sandbox), with aliased orgs prioritized at the top of each section. Visual indicators (tree and leaf) make it easy to identify your default org and Dev Hub at a glance. ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

#### salesforcedx-vscode-services-types

- We integrated shared org icons into the Services extension and updated the org picker to use the new icons for a more consistent experience. ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

## Fixed

- We fixed some issues with extension activation. ([PR #6914](https://github.com/forcedotcom/salesforcedx-vscode/pull/6914), [ISSUE #6914](https://github.com/forcedotcom/salesforcedx-vscode/issues/6914), [ISSUE #6916](https://github.com/forcedotcom/salesforcedx-vscode/issues/6916))

- We fixed an issue with code coverage toggle not being visible. ([PR #6915](https://github.com/forcedotcom/salesforcedx-vscode/pull/6915), [ISSUE #6890](https://github.com/forcedotcom/salesforcedx-vscode/issues/6890))

# 66.0.1 - March 5, 2026

## Added

Updates for the Spring 26 (v66.0) release.

#### salesforcedx-vscode-apex-testing

- Apex tests in the Test Explorer are now organized in a hierarchy of Namespace → Package → Class → Method, making it easy to distinguish unpackaged tests, 1GP namespaced tests, and 2GP package tests (including unlocked packages). A Local Namespace groups classes without a namespace, and tests can be filtered and run/debugged at the namespace or package level. Package resolution is handled automatically per org, with intelligent fallbacks and caching for improved performance and reliability. ([PR #6888](https://github.com/forcedotcom/salesforcedx-vscode/pull/6888))

#### salesforcedx-vscode-core

- The `SFDX: Create Project` command now has new templates for React support. ([PR #6884](https://github.com/forcedotcom/salesforcedx-vscode/pull/6884))

#### salesforcedx-vscode-lwc

- We added a new setting to enable TypeScript LWC components. ([PR #6872](https://github.com/forcedotcom/salesforcedx-vscode/pull/6872))

#### salesforcedx-vscode-apex-log

- We introduced Apex Log, a dedicated extension for Apex debugging and log workflows with these features-
  - You can create Trace Flags for any user in your org, define reusable Debug Levels, and manage both directly from VS Code.
  - An enhanced Status Bar indicator that shows when a trace is active and when it expires, with quick actions to view and manage Trace Flags and Debug Levels. Now logs automatically download in the background while a trace is active (polling frequency configurable via `logPollIntervalSeconds`).
  - Running Anonymous Apex now automatically retrieves and opens the corresponding log even creating a temporary Trace Flag, if needed. A new command also lets you quickly generate a placeholder Anonymous Apex script.

#### salesforcedx-vscode-org

- We refreshed the org picker with a cleaner, more organized layout. Orgs are now "*org*anized" into sections by type (for example, Scratch Org and Sandbox), with aliased orgs prioritized at the top of each section. Visual indicators (tree and leaf) make it easy to identify your default org and Dev Hub at a glance. ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

#### salesforcedx-vscode-services-types

- We integrated shared org icons into the Services extension and updated the org picker to use the new icons for a more consistent experience. ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

## Fixed

- We fixed some issues with extension activation. ([PR #6914](https://github.com/forcedotcom/salesforcedx-vscode/pull/6914), [ISSUE #6914](https://github.com/forcedotcom/salesforcedx-vscode/issues/6914), [ISSUE #6916](https://github.com/forcedotcom/salesforcedx-vscode/issues/6916))

- We fixed an issue with code coverage toggle not being visible. ([PR #6915](https://github.com/forcedotcom/salesforcedx-vscode/pull/6915), [ISSUE #6890](https://github.com/forcedotcom/salesforcedx-vscode/issues/6890))

# 66.0.0 - March 5, 2026

## Added

Updates for the Spring 26 (v66.0) release.

#### salesforcedx-vscode-apex-testing

- Apex tests in the test panel tree are organized by namespace and package. You can also filter tests by namespace and package. ([PR #6888](https://github.com/forcedotcom/salesforcedx-vscode/pull/6888))

#### salesforcedx-vscode-core

- The create project command has new templates for React support ([PR #6884](https://github.com/forcedotcom/salesforcedx-vscode/pull/6884))

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

- We made the org picker UI nicer. Orgs are "*org*anized" into sections by type (ex: scratch org, sandbox) with aliased orgs at the top of their section. There are icon indicators (tree and leaf) for your default org and DevHub ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

#### salesforcedx-vscode-services-types

- Add media service to services extension and org picker icon updates ([PR #6873](https://github.com/forcedotcom/salesforcedx-vscode/pull/6873))

## Fixed

- Extension activation issues ([PR #6914](https://github.com/forcedotcom/salesforcedx-vscode/pull/6914)) which should solve [issue #6914](https://github.com/forcedotcom/salesforcedx-vscode/issues/6914) and [issue #6916](https://github.com/forcedotcom/salesforcedx-vscode/issues/6916)

#### salesforcedx-vscode-apex-testing

- Code coverage toggle was not visible [Issue #6890](https://github.com/forcedotcom/salesforcedx-vscode/issues/6890) ([PR #6915](https://github.com/forcedotcom/salesforcedx-vscode/pull/6915))

# 65.18.0 - February 18, 2026

## Added

#### salesforcedx-vscode-core

- We removed the following commands associated with the deprecated Local Dev Server:
  - `SFDX: Start Local Development Server`
  - `SFDX: Stop Local Development Server`
  - `SFDX: Open Local Development Server`
  - `SFDX: Preview Component Locally`

Check out the improved version of the Local Dev Server by installing the [Salesforce Live Preview (Beta)](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-ui-preview) extension! ([PR #6849](https://github.com/forcedotcom/salesforcedx-vscode/pull/6849))

- We made some changes under the hood. ([PR #6848](https://github.com/forcedotcom/salesforcedx-vscode/pull/6848))

# 65.17.3 - February 13, 2026

## Added

#### salesforcedx-vscode-apex-testing

#### salesforcedx-vscode-metadata

#### salesforcedx-vscode-org-browser

#### salesforcedx-vscode-services

- We made some changes under the hood. ([PR #6831](https://github.com/forcedotcom/salesforcedx-vscode/pull/6831))

## Fixed

#### salesforcedx-apex-debugger

- We fixed an issue where the Apex Interactive Debugger threw an error and failed to launch. ([PR #6846](https://github.com/forcedotcom/salesforcedx-vscode/pull/6846), [ISSUE #6787](https://github.com/forcedotcom/salesforcedx-vscode/issues/6787))

#### salesforcedx-vscode-core

- We fixed an issue in the CLI Integration extension that caused the Agentforce Vibes extension to display the `No Default Org Set` message on startup. ([PR #6847](https://github.com/forcedotcom/salesforcedx-vscode/pull/6847))

# 65.17.2 - February 12, 2026

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6841](https://github.com/forcedotcom/salesforcedx-vscode/pull/6841))

## Fixed

#### salesforcedx-lwc-language-server

- Resolved an issue where the Aura Language Server repeatedly opened and modified customlabels.d.ts in the editor, causing flickering and preventing the file from being closed. The language server no longer forces files open during startup. Thank you [Justin Lyon](https://github.com/justin-lyon) for creating this [issue](https://github.com/forcedotcom/salesforcedx-vscode/issues/6827). ([PR #6832](https://github.com/forcedotcom/salesforcedx-vscode/pull/6832))

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-apex-replay-debugger

#### salesforcedx-vscode-apex-testing

- Running All Tests from the Test Controller now works reliably in large orgs, test results are correctly cleared when switching orgs, and users receive clearer feedback when running empty Apex Test Suites. We also fixed Apex test discovery pagination issues and significantly improved Test Explorer performance when loading large numbers of tests, making the experience faster, more responsive, and easier to trust. A new filter tag, `@sf.apex.testController:in-workspace`, has also been added to make it easy to show only Apex tests that exist in the current project. ([PR #6842](https://github.com/forcedotcom/salesforcedx-vscode/pull/6842))

#### salesforcedx-vscode-core

- We resolved a regression where the default org was not correctly shown in the org picker when only the CLI Integration and Org Management extensions were installed. The org picker now immediately reflects the default org defined in `sfdx-config.json`, without requiring users to manually save the file. ([PR #6837](https://github.com/forcedotcom/salesforcedx-vscode/pull/6837))

#### salesforcedx-vscode-lightning

- We made some changes under the hood. ([PR #6840](https://github.com/forcedotcom/salesforcedx-vscode/pull/6840))

# 65.15.2 - January 28, 2026

## Added

#### salesforcedx-vscode-apex-testing
#### salesforcedx-vscode-services

-   We modernized the Apex testing extension to improve modularity and prepare it for browser-based (web) environments. This update removes legacy dependencies, streamlines configuration and activation behavior, and introduces a new setting to control retrieval of Apex test code coverage results. These changes improve maintainability today and enable broader platform support going forward. ([PR #6774](https://github.com/forcedotcom/salesforcedx-vscode/pull/6774))


## Fixed

#### salesforcedx-vscode-apex-testing

- We fixed an issue where the `test-run-concise` option displayed both passing and failing test results instead of only failures. Thank you [Kyle Capehart](https://github.com/k-capehart) for submitting this issue. ([PR #6794](https://github.com/forcedotcom/salesforcedx-vscode/pull/6794))

#### salesforcedx-vscode-core

- We fixed a reauthorization issue that would leave users stuck after an org session timed out. Required extensions now activate automatically, and clicking Login correctly opens the reauthorization flow in a new tab. ([PR #6797](https://github.com/forcedotcom/salesforcedx-vscode/pull/6797))

- We fixed an issue where `SFDX: Delete This from Project and Org` incorrectly reported project-wide conflicts. The command now properly isolates conflict detection to the specific file being deleted. Thank you [Nicky Torstensson](https://github.com/nickytorstensson) for submitting this issue. ([PR #6798](https://github.com/forcedotcom/salesforcedx-vscode/pull/6798))

#### salesforcedx-vscode-org

- We fixed a regression where leaving the org alias input blank during authorization resulted in an empty alias instead of defaulting to `vscodeOrg`. ([PR #6780](https://github.com/forcedotcom/salesforcedx-vscode/pull/6780))

#### salesforcedx-vscode-services

- We removed the hardcoded theme, ensuring the UI now adapts correctly to user-selected and system themes. ([PR #6776](https://github.com/forcedotcom/salesforcedx-vscode/pull/6776))

#### salesforcedx-aura-language-server

- We added a preventative check so the Aura Language Server doesn’t log errors before it’s ready to process requests. ([PR #6786](https://github.com/forcedotcom/salesforcedx-vscode/pull/6786))

#### salesforcedx-lwc-language-server

- We fixed an issue where `tsconfig.json` wasn't being created by the Lightning Language Server. ([PR #6800](https://github.com/forcedotcom/salesforcedx-vscode/pull/6800))

# 65.13.1 - January 16, 2026

## Added

#### salesforcedx-vscode-apex
#### salesforcedx-vscode-apex-replay-debugger
#### salesforcedx-vscode-apex-testing

- We enhanced Apex test reporting with configurable output formats and sorting. You can now generate test reports in Markdown or plain text, customize sorting by runtime, coverage, or severity, and highlight slow or low-coverage tests using configurable performance and coverage thresholds. Reports are saved with timestamped filenames and automatically opened for easy review. ([PR #6750](https://github.com/forcedotcom/salesforcedx-vscode/pull/6750))

## Fixed

#### salesforcedx-utils-vscode
#### salesforcedx-vscode-lwc

- We fixed some Windows specific config issues. ([PR #6760](https://github.com/forcedotcom/salesforcedx-vscode/pull/6760))

#### salesforcedx-vscode
#### salesforcedx-vscode-apex-oas
#### salesforcedx-vscode-expanded

- We made product name updates to README files. ([PR #6762](https://github.com/forcedotcom/salesforcedx-vscode/pull/6762))

# 65.12.1 - January 9, 2026

## Added

#### salesforcedx-aura-language-server
#### salesforcedx-lightning-lsp-common
#### salesforcedx-lwc-language-server

- We refactored the Lightning language server into the monorepo to improve long-term maintainability. 
- We removed `node:fs` and direct file system calls from the lightning-language-server in favor of asynchronously loading filesystem data into the server. ([PR #6620](https://github.com/forcedotcom/salesforcedx-vscode/pull/6620), ([PR #6658](https://github.com/forcedotcom/salesforcedx-vscode/pull/6658)), ([PR #6666](https://github.com/forcedotcom/salesforcedx-vscode/pull/6666)), ([PR #6711](https://github.com/forcedotcom/salesforcedx-vscode/pull/6711))
- We added UX popups and hover text to clearly communicate the delayed server start. ([PR #6723](https://github.com/forcedotcom/salesforcedx-vscode/pull/6723))

#### salesforcedx-vscode-apex-testing

- We introduced a new Apex test controller, including a redesigned Test Explorer UI, updated configuration settings, and improved test suite discovery and management. ([PR #6704](https://github.com/forcedotcom/salesforcedx-vscode/pull/6704))

#### salesforcedx-vscode-core

- We now scrape Metadata API Developer Guide metadata types using Playwright to power metadata XML hover documentation. This runs weekly via a GitHub Actions workflow. ([PR #6675](https://github.com/forcedotcom/salesforcedx-vscode/pull/6675))

- We moved `SFDX: Stop Apex Debugger Session` and `SFDX: Create and Set Up Project for ISV Debugging` from the CLI Integration extension to the Apex Interactive Debugger extension. ([PR #6727](https://github.com/forcedotcom/salesforcedx-vscode/pull/6727))

- We moved `SFDX: Execute SOQL Query…` and `SFDX: Execute SOQL Query with Currently Selected Text` from the CLI Integration extension to the SOQL extension. ([PR #6747](https://github.com/forcedotcom/salesforcedx-vscode/pull/6747))

# 65.9.1 - December 19, 2025

## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue where code coverage highlights were not applied when navigating between Apex files. Coverage decorations now appear automatically when switching files, as long as Highlight Apex Code Coverage is enabled. ([PR #6721](https://github.com/forcedotcom/salesforcedx-vscode/pull/6721))

#### salesforcedx-vscode-apex-testing

- We fixed an issue where the test panel did not automatically populate local Apex tests when opened. The test view now refreshes on activation and provides clearer feedback when the Apex Language Server is not ready, improving reliability and overall usability. ([PR #6722](https://github.com/forcedotcom/salesforcedx-vscode/pull/6722))

#### salesforcedx-vscode-org

- We fixed an issue where org state was not refreshed after login, logout, or delete operations. You no longer need to reload the VS Code window after authorizing a Dev Hub before creating a scratch org- the extension now immediately reflects the latest org information. ([PR #6720](https://github.com/forcedotcom/salesforcedx-vscode/pull/6720))

#### salesforcedx-utils-vscode

- We made some changes under the hood. ([PR #6712](https://github.com/forcedotcom/salesforcedx-vscode/pull/6712))

# 65.9.0 - December 17, 2025

## Added

#### salesforcedx-utils-vscode

- Under the cover changes ([PR #6712](https://github.com/forcedotcom/salesforcedx-vscode/pull/6712))

# 65.8.2 - December 13, 2025

## Added

#### salesforcedx-vscode

#### salesforcedx-vscode-expanded

- Apex Testing Extension is now part of both of the extension packs. This was missed in previous release and is the fix for [issue #6705](https://github.com/forcedotcom/salesforcedx-vscode/issues/6705). ([PR #6708](https://github.com/forcedotcom/salesforcedx-vscode/pull/6708))

# 65.8.1 - December 11, 2025

## New

#### salesforcedx-vscode-apex-testing

We've created a new extension that contains the features for apex testing [W-20175122] ([PR #6676](https://github.com/forcedotcom/salesforcedx-vscode/pull/6676))

#### salesforcedx-vscode-core
- Schemas for sfdx-project and scratch org definition files now come from the salesforce/core library. [W-20329918] ([PR #6697](https://github.com/forcedotcom/salesforcedx-vscode/pull/6697))

## Fixed

#### salesforcedx-vscode-apex-oas

- We've made a few changes to the schema of ExternalServiceRegistration that are generated from Apex ([PR #6701](https://github.com/forcedotcom/salesforcedx-vscode/pull/6701))

# 65.7.0 - December 3, 2025

## Added

#### salesforcedx-utils-vscode

- [W-20175089] [W-20175097 ]  user setting for switching between api and ls for apex tests discovery ([PR #6653](https://github.com/forcedotcom/salesforcedx-vscode/pull/6653))

#### salesforcedx-vscode-apex

- [W-20175089] [W-20175097 ]  user setting for switching between api and ls for apex tests discovery ([PR #6653](https://github.com/forcedotcom/salesforcedx-vscode/pull/6653))

# 65.6.0 - November 26, 2025

## Added

#### salesforcedx-vscode-apex-oas

- We adapted the External Service Registration (ESR) generation logic to meet General Availability (GA) requirements. The key change is that for org API version 66.0 and above, the operations section is completely removed from the ESR metadata, rather than being included with `active=false`. ([PR #6664](https://github.com/forcedotcom/salesforcedx-vscode/pull/6664))

## Fixed

#### salesforcedx-vscode-org

- We fixed the ordering of the status bar entries so that the "Open Default Org in Browser" button is returned to its original location next to the org picker. ([PR #6652](https://github.com/forcedotcom/salesforcedx-vscode/pull/6652))

# 65.5.0 - November 19, 2025

## Added

#### salesforcedx-utils-vscode

#### salesforcedx-vscode-apex-oas

- OpenAPI (OAS) documents now adjust behavior based on the org’s API version:

**Operations active Flag**

**API < 66.0**: active: true (same as today)

**API ≥ 66.0**: active: false (new GA behavior)

**Beta Info (x-betaInfo)**

**API < 66.0**: Included, indicating the feature is in beta

**API ≥ 66.0**: Removed, reflecting GA status

This ensures OAS documents behave correctly for both pre-GA (earlier versions) and GA (66.0+) orgs. ([PR #6645](https://github.com/forcedotcom/salesforcedx-vscode/pull/6645))


## Fixed

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-apex-replay-debugger

- `skipCodeCoverage` is now passed using your `retrieve-test-code-coverage` setting. If set to `True`, coverage is skipped for faster test runs. ([PR #6650](https://github.com/forcedotcom/salesforcedx-vscode/pull/6650))

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

# 65.3.1 - November 6, 2025

## Added

#### salesforcedx-vscode
#### salesforcedx-vscode-apex
#### salesforcedx-vscode-apex-oas
#### salesforcedx-vscode-automation-tests
#### salesforcedx-vscode-expanded

- We’ve launched a brand-new VS Code extension, salesforcedx-vscode-apex-oas, bringing OpenAPI Specification (OAS) generation and validation to `Apex REST` and `@AuraEnabled` classes. This release includes full packaging, configuration, and workspace integration for easier development and debugging—plus supporting refactors and improved dependency management to keep things running smoothly. ([PR #6601](https://github.com/forcedotcom/salesforcedx-vscode/pull/6601))

#### salesforcedx-vscode-core

- We made some changes under the hood.

## Fixed

#### salesforcedx-vscode-lwc

- We added CodeLens support for describe blocks in LWC tests. The CodeLens appears only when the Jest Runner extension isn’t installed or active, preventing duplicate test run options. ([PR #6594](https://github.com/forcedotcom/salesforcedx-vscode/pull/6594))

#### salesforcedx-vscode-apex
#### salesforcedx-vscode-core
#### salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #6619](https://github.com/forcedotcom/salesforcedx-vscode/pull/6619)),([PR #6625](https://github.com/forcedotcom/salesforcedx-vscode/pull/6625)), ([PR #6606](https://github.com/forcedotcom/salesforcedx-vscode/pull/6606))
- We fixed bugs related to grammar issues with Apex syntax highlighting. ([PR #6610](https://github.com/forcedotcom/salesforcedx-vscode/pull/6610)),([PR #6626](https://github.com/forcedotcom/salesforcedx-vscode/pull/6626))

# 65.0.0 - October 18, 2025

- This release includes the Salesforce v258 major release core alignment and standard post-Dreamforce maintenance updates. No functional or user-facing changes.

# 64.17.2 - October 8, 2025

## Fixed

#### salesforcedx-vscode-core

- We fixed some minor bugs in the hover documentation of metadata XML files. ([PR #6588](https://github.com/forcedotcom/salesforcedx-vscode/pull/6588))

- We added a prompt that pops up to ask the user to reauthenticate to the org when the Code Builder window sits idle for too long and the access token becomes expired. ([PR #6583](https://github.com/forcedotcom/salesforcedx-vscode/pull/6583))

- We re-enabled the auth related commands in Code Builder by adding a check for the environment variable `CODE_BUILDER`. ([PR #6586](https://github.com/forcedotcom/salesforcedx-vscode/pull/6586))

# 64.17.1 - October 8, 2025

## Fixed

#### salesforcedx-vscode-core

- We fixed some minor bugs in the hover documentation of metadata XML files. ([PR #6588](https://github.com/forcedotcom/salesforcedx-vscode/pull/6588))

- We added a prompt that pops up to ask the user to reauthenticate to the org when the Code Builder window sits idle for too long and the access token becomes expired. ([PR #6583](https://github.com/forcedotcom/salesforcedx-vscode/pull/6583))

- We re-enabled the auth related commands in Code Builder by adding a check for the environment variable `CODE_BUILDER`. ([PR #6586](https://github.com/forcedotcom/salesforcedx-vscode/pull/6586))

# 64.16.1 - October 3, 2025

## Added

#### salesforcedx-vscode-core

- Added hover documentation and autocompletion support for metadata XML files for RedHat XML extension. ([PR #6576](https://github.com/forcedotcom/salesforcedx-vscode/pull/6576))

## Fixed

#### salesforcedx-vscode-core, salesforcedx-vscode-lightning

- We made changes under the hood. ([PR #6569](https://github.com/forcedotcom/salesforcedx-vscode/pull/6569), [PR #6566](https://github.com/forcedotcom/salesforcedx-vscode/pull/6566))

# 64.14.0 - September 17, 2025

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6528](https://github.com/forcedotcom/salesforcedx-vscode/pull/6528))

## Fixed

#### salesforcedx-vscode-core

- We fixed the **SFDX: Execute SOQL Query With Currently Selected Text** command so that columns with parent relationship fields now display their actual values instead of [Object]. This brings the output in line with the `sf data query -q` CLI command.

Thank you [jh480](https://github.com/jh480) for logging this issue. ([PR #6539](https://github.com/forcedotcom/salesforcedx-vscode/pull/6539), [ISSUE #6536](https://github.com/forcedotcom/salesforcedx-vscode/issues/6536))

- We improved namespace handling by checking the org auth file to confirm whether a scratch org has a namespace.
    - orgDisplay now shows the namespace.
    - We added support for no-namespace projects during debugging.
    - Fixed an issue where the Apex Replay Debugger could not run on Apex test classes when the project had a namespace but the connected org did not.

Thank you [Justin Lyon](https://github.com/justin-lyon) for logging this issue. ([PR #6467](https://github.com/forcedotcom/salesforcedx-vscode/pull/6467), [ISSUE #6458](https://github.com/forcedotcom/salesforcedx-vscode/issues/6458))

#### salesforce-vscode-visualforce

- We fixed an issue where `<style>` tags in VF pages caused the Visualforce Language Server to throw errors on save or format. VF pages with `<style>` tags now work as expected without breaking formatting or highlighting.

Thank you [Humaira Zaman](https://github.com/humairazaman-devsinc) and [Charlie Jonas](https://github.com/ChuckJonas) for logging issues. ([PR #6527](https://github.com/forcedotcom/salesforcedx-vscode/pull/6527/), [ISSUE #5593](https://github.com/forcedotcom/salesforcedx-vscode/issues/5593), [ISSUE #5602](https://github.com/forcedotcom/salesforcedx-vscode/issues/5602))

# 64.13.1 - September 11, 2025

## Added

#### salesforcedx-vscode-core

- We’ve added new walkthroughs for the Org Browser and Org Picker features—enjoy exploring and learning about them! ([PR #6526](https://github.com/forcedotcom/salesforcedx-vscode/pull/6526))
- We made some changes under the hood. ([PR #6527](https://github.com/forcedotcom/salesforcedx-vscode/pull/6527))

## Fixed

#### salesforcedx-vscode-apex

-  We made some changes under the hood. ([PR #6540](https://github.com/forcedotcom/salesforcedx-vscode/pull/6540))

#### salesforcedx-vscode-apex-debugger

- We removed an incorrect disclaimer from the Apex Interactive Debugger README. ([PR #6537](https://github.com/forcedotcom/salesforcedx-vscode/pull/6537))

#### salesforcedx-vscode-core

- We improved error handling so that org info is returned with clear status when connection or query failures occur. ([PR #6530](https://github.com/forcedotcom/salesforcedx-vscode/pull/6530))

# 64.12.0 - September 3, 2025

## Added

#### salesforcedx-vscode-core

- We refactored the org cleanup logic to ensure expired or deleted orgs are properly removed. The update also adds clearer user feedback through detailed messages and a table view of the remaining orgs. ([PR #6500](https://github.com/forcedotcom/salesforcedx-vscode/pull/6500))

- We improved the bundling of our extensions to reduce the extensions size. ([PR #6490](https://github.com/forcedotcom/salesforcedx-vscode/pull/6490))

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue where org aliases that contain dashes couldn't be set as default orgs. ([PR #6521](https://github.com/forcedotcom/salesforcedx-vscode/pull/6521))

- We fixed an issue where deploy and retrieve were failing when the `Enable Source Tracking For Deploy And Retrieve` setting was enabled for non-source-tracked orgs. ([PR #6507](https://github.com/forcedotcom/salesforcedx-vscode/pull/6507))

# 64.11.1 - August 28, 2025
## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6491](https://github.com/forcedotcom/salesforcedx-vscode/pull/6491))

- We made some changes under the hood to `SFDX: Delete This from Project and Org` command. It now runs faster. ([PR #6466](https://github.com/forcedotcom/salesforcedx-vscode/pull/6466))

- We made some changes under the hood to `SFDX: Pull This Source from Org` that make the command run faster. You can now view file differences when there are conflicts. You can also ignore the differences and proceed. ([PR #6438](https://github.com/forcedotcom/salesforcedx-vscode/pull/6438))


#### salesforcedx-vscode-soql

- You can now access a walkthrough (step-by-step guide) for creating SOQL queries with the SOQL Query Builder. Find it on the VS Code Welcome page or launch it anytime by running `Open SOQL Walkthrough` from the Command Palette. ([PR #6497](https://github.com/forcedotcom/salesforcedx-vscode/pull/6497))


## Fixed

#### salesforcedx-vscode-lightning

- We made some changes under the hood. ([PR #6496](https://github.com/forcedotcom/salesforcedx-vscode/pull/6496), [PR #6492](https://github.com/forcedotcom/salesforcedx-vscode/pull/6492))

#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #6492](https://github.com/forcedotcom/salesforcedx-vscode/pull/6492))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6495](https://github.com/forcedotcom/salesforcedx-vscode/pull/6495))

# 64.11.0 - August 27, 2025

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6491](https://github.com/forcedotcom/salesforcedx-vscode/pull/6491))

- We made some changes under the hood to `SFDX: Delete This from Project and Org` command. It now runs faster. ([PR #6466](https://github.com/forcedotcom/salesforcedx-vscode/pull/6466))

- We made some changes under the hood to `SFDX: Pull This Source from Org` that make the command run faster. You can now view file differences when there are conflicts. You can also ignore the differences and proceed. ([PR #6438](https://github.com/forcedotcom/salesforcedx-vscode/pull/6438))

## Fixed

#### salesforcedx-vscode-lightning

- We made some changes under the hood. ([PR #6496](https://github.com/forcedotcom/salesforcedx-vscode/pull/6496), [PR #6492](https://github.com/forcedotcom/salesforcedx-vscode/pull/6492))

#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #6492](https://github.com/forcedotcom/salesforcedx-vscode/pull/6492))

# 64.10.1 - August 20, 2025

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6468](https://github.com/forcedotcom/salesforcedx-vscode/pull/6468))

# 64.10.0 - August 20, 2025

## Added

#### salesforcedx-vscode-core

- @W-18491237 refactor - migrate to @salesforce/o11y-reporter package ([PR #6468](https://github.com/forcedotcom/salesforcedx-vscode/pull/6468))

# 64.9.1 - August 13, 2025

## Added

#### salesforcedx-vscode
#### salesforcedx-vscode-expanded

- We’ve raised our minimum supported VS Code version to the latest minus two releases. If you’re on an older version, update VS Code to stay compatible and keep installing extension updates. ([PR #6452](https://github.com/forcedotcom/salesforcedx-vscode/pull/6452))

## Fixed

#### salesforcedx-vscode-core

- We fixed a bug where trace flags from Developer Console were showing up in VS Code. Now, trace flags created in each stay separate. ([PR #6465](https://github.com/forcedotcom/salesforcedx-vscode/pull/6465))

# 64.8.0 - August 6, 2025

## Added

#### salesforcedx-vscode-core

- We improved the extension activation logic so that the extension no longer activate as soon as a project with an `sfdx-project.json` is opened. Instead:

  - Debugger extensions (Replay and Interactive) activate only when a debugger command is run.
  - The Visualforce extension activates only when a `.page` or `.component` file is opened.
  - Aura and LWC extensions activate only if your project contains `aura/` or `lwc/` folders.
    This update improves startup performance by limiting unnecessary activations. ([PR #6397](https://github.com/forcedotcom/salesforcedx-vscode/pull/6397))

- Push operations now use a shared library instead of running a CLI command. ([PR #6422](https://github.com/forcedotcom/salesforcedx-vscode/pull/6422)).

#### salesforedx-vscode-apex

- Our new TypeScript-based Apex Language Server is stepping in for some tasks previously handled by the Java-based version. If you experience issues, use the new **Enable LSP Parity Capabilities** setting to switch back to the old behavior. ([PR #6433](https://github.com/forcedotcom/salesforcedx-vscode/pull/6433))

# 64.7.1 - July 31, 2025

## Fixed

#### salesforcedx-utils-vscode

- @W-18793417 - modify o11yService to support extension specific telemetry configuration ([PR #6354](https://github.com/forcedotcom/salesforcedx-vscode/pull/6354))

#### salesforcedx-vscode-apex

- @W-18793417 - modify o11yService to support extension specific telemetry configuration ([PR #6354](https://github.com/forcedotcom/salesforcedx-vscode/pull/6354))

#### salesforcedx-vscode-core

- Launch extensions was not working ([PR #6436](https://github.com/forcedotcom/salesforcedx-vscode/pull/6436))

# 64.5.1 - July 18, 2025

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6400](https://github.com/forcedotcom/salesforcedx-vscode/pull/6400), [PR #6395](https://github.com/forcedotcom/salesforcedx-vscode/pull/6395))

## Fixed

#### salesforcedx-vscode-apex

- We fixed a bug that was causing Apex test diagnostics to appear under an "unknown" label in the Problems Tab. ([PR #6405](https://github.com/forcedotcom/salesforcedx-vscode/pull/6405))

#### salesforcedx-vscode-core

- We fixed a bug where unsaved manifests were being created when the **SFDX: Generate Manifest File** command is escaped. ([PR #6391](https://github.com/forcedotcom/salesforcedx-vscode/pull/6391))

- We made an improvement to the user experience in the org browser.  Users no longer need to click the **SFDX: Refresh Types** button every time they switch between orgs; the metadata types for the new org are now populated automatically. ([PR #6401](https://github.com/forcedotcom/salesforcedx-vscode/pull/6401))

- We improved the **SFDX: Turn On Apex Debug Logs for Replay Debugger** command so it doesn't call the `sf data:create:record` CLI command under the hood.  With that change comes a huge performance improvement - now the command completes in about 1/3 of the original runtime! ([PR #6386](https://github.com/forcedotcom/salesforcedx-vscode/pull/6386))

# 64.3.0 - July 2, 2025

## Fixed

#### salesforcedx-vscode-apex

- Under the cover changes ([PR #6384](https://github.com/forcedotcom/salesforcedx-vscode/pull/6384)),([PR #6374](https://github.com/forcedotcom/salesforcedx-vscode/pull/6374))

#### salesforcedx-vscode-apex-replay-debugger

- Under the cover changes ([PR #6384](https://github.com/forcedotcom/salesforcedx-vscode/pull/6384))

# 64.2.1 - June 25, 2025

## Added

#### salesforcedx-sobjects-faux-generator
#### salesforcedx-utils-vscode
#### salesforcedx-vscode-apex
#### salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #6322](https://github.com/forcedotcom/salesforcedx-vscode/pull/6322), [PR #6331](https://github.com/forcedotcom/salesforcedx-vscode/pull/6331))


## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue with the Apex Language Server that caused database corruption. ([PR #6371](https://github.com/forcedotcom/salesforcedx-vscode/pull/6371))

#### salesforcedx-vscode-core

- We fixed an issue where refreshing of SObjects definition wouldn't stop when no default org was set. ([PR #6367](https://github.com/forcedotcom/salesforcedx-vscode/pull/6367))

- We added a helpful 'No components retrieved' message in the Output Tab when a manifest that contains no valid components is retrieved. You're welcome! ([PR #6357](https://github.com/forcedotcom/salesforcedx-vscode/pull/6357))

# 64.1.0 - June 18, 2025

## Fixed

#### salesforcedx-vscode-apex

- We made some changes under the hood. ([#6353](https://github.com/forcedotcom/salesforcedx-vscode/issues/6353))

# 64.0.3 - June 15, 2025

## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue so that the "Rename Symbol (F2)" function in Visual Studio Code now correctly renames symbols in an Apex file. Thank you [Pawel Wozniak](https://github.com/PawelWozniak) for creating the issue.
 ([Issue #5613](https://github.com/forcedotcom/salesforcedx-vscode/issues/5613)) ([PR #6351](https://github.com/forcedotcom/salesforcedx-vscode/pull/6351))

#### salesforcedx-vscode-core

- We added support for the `ContentTypeBundle` metadata type in the Org Browser. You no longer need to use the CLI commands to retrieve this type. ([PR #6348](https://github.com/forcedotcom/salesforcedx-vscode/pull/6348))

# 63.16.3 - June 6, 2025

## Fixed

#### salesforcedx-vscode-apex

- We resolved an issue that caused a run-time error when activating the Apex Language Server. ([Issue #6317](https://github.com/forcedotcom/salesforcedx-vscode/issues/6317)) ([PR #6316](https://github.com/forcedotcom/salesforcedx-vscode/pull/6316))

# 63.15.1 - May 30, 2025

## Added

#### salesforcedx-vscode-apex

- We modified the Apex language server restart behavior and added new options:

  **From the status bar**: Respects the configured `Restart Behavior` setting.
     
     - **prompt**: Prompts with `Restart Only` selected by default.
     
     - **restart**: Restarts immediately.
     
     -  **reset**: Cleans Apex DB and restarts.
     
  **From the command palette**: Always prompts the user, with the selection prehighlighted based on the configured setting. ([PR #6292](https://github.com/forcedotcom/salesforcedx-vscode/pull/6292))

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6302](https://github.com/forcedotcom/salesforcedx-vscode/pull/6302))

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-soql

- Syntax highlighting now works correctly when the `@isTest` annotation is on the same line as the test method. ([PR #6304](https://github.com/forcedotcom/salesforcedx-vscode/pull/6304))

# 63.14.1 - May 21, 2025

## Fixed

#### salesforcedx-vscode-core

- We reverted the check we added in v63.11.0. The check limited the visibility of org-related `SFDX` commands to only valid files. We removed it due to performance issues on large projects. ([PR #6289](https://github.com/forcedotcom/salesforcedx-vscode/pull/6289))
- We bumped the versions of the Salesforce shared libraries to support deploying and retrieving the `WorkflowFlowAutomation` metadata type. ([PR #6280](https://github.com/forcedotcom/salesforcedx-vscode/pull/6280))
- We updated the `SFDX: Turn Off Apex Debug Log for Replay Debugger` command. Now it doesn't call the `sf data:delete:record` CLI command under the hood. This change significantly improves how fast the command runs. ([#6259](https://github.com/forcedotcom/salesforcedx-vscode/pull/6259))

# 63.12.0 - May 7, 2025

## Added

#### salesforcedx-vscode
#### salesforcedx-vscode-expanded

We removed the ESLint and Apex PMD extensions from the Salesforce Expanded Pack. Instead, we recommend that you use the ESLint and PMD engines included in the Salesforce Code Analyzer extension, which we also added to the Salesforce Standard Pack. To learn more about the Code Analyzer extension, go to https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/analyze-vscode.html.

If you’re already familiar with Code Analyzer v4 (which is soon reaching its end of life), use this document to migrate to Code Analyzer v5: https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/migrate.html.

If you use ESLint and have custom ESLint configurations, see this document to learn how to use and configure the ESLint engine of Code Analyzer v5: https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/engine-eslint.html. Code Analyzer v5 currently supports only ESLint v8.x, and not v9.x.

Similarly, if you use PMD and have custom PMD configurations, see this document to learn how to use and configure the PMD engine of Code Analyzer v5: https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/engine-pmd.html.

# 63.11.0 - April 30, 2025

## Fixed

#### salesforcedx-vscode-core

- The following commands are now only visible and executable for files and folders within the paths specified in the `packageDirectories` array of `sfdx-project.json`:

- `SDFX:Deploy to Org`

-  `SFDX:Retrieve from Org`

 - `SFDX:Diff Against Org`

 - `SFDX:Delete from Org`

 - `SFDX:Create Manifest`

These commands no longer appear in the Explorer View context menu, Editor View context menu, or Command Palette for resources outside the defined `packageDirectories`, including anything outside the `force-app` directory. Previously, attempting to run these commands on files or folders outside the configured package directories resulted in errors during deployment or retrieval. ([PR #6224](https://github.com/forcedotcom/salesforcedx-vscode/pull/6224))

# 63.10.0 - April 23, 2025

## Added

#### salesforcedx-vscode-core

- We've now [deprecated](https://github.com/forcedotcom/salesforcedx-vscode/issues/6199) the `SFDX: Create a Lightning Web Component Test` command. It's no longer available from the command palette. ([PR #6225](https://github.com/forcedotcom/salesforcedx-vscode/pull/6225))

- We bumped SDR and some libraries to catch up with the latest. This update fixed an issue with deploying and retrieving `DigitalExperienceBundle` metadata. ([PR #6223](https://github.com/forcedotcom/salesforcedx-vscode/pull/6223))

- We enhanced telemetry for Agentforce for Developers by making changes under the hood. ([PR #6171](https://github.com/forcedotcom/salesforcedx-vscode/pull/6171))

## Fixed

#### salesforcedx-vscode-apex

- We updated the text for the Java home setting to reflect currently supported versions. ([PR #6228](https://github.com/forcedotcom/salesforcedx-vscode/pull/6228), [PR #6229](https://github.com/forcedotcom/salesforcedx-vscode/pull/6229))

# 63.9.2 - April 17, 2025

## Fixed

#### salesforcedx-vscode-core

- We fixed the import in the Lightning web components (LWC) test template so that newly created LWC tests won't contain any errors in the Problems Tab. ([PR #661](https://github.com/forcedotcom/salesforcedx-templates/pull/661), [PR #662](https://github.com/forcedotcom/salesforcedx-templates/pull/662), [PR #6207](https://github.com/forcedotcom/salesforcedx-vscode/pull/6207), [PR #6209](https://github.com/forcedotcom/salesforcedx-vscode/pull/6209))

#### salesforcedx-vscode-apex

- We fixed an issue where an Apex variable with a number in the middle of its name was previously treated as two separate variables. ([PR #6184](https://github.com/forcedotcom/salesforcedx-vscode/pull/6184))
- We fixed an issue where the `SFDX: Restart Apex Language Server` command wasn't always visible. Now it's always visible. ([PR #6187](https://github.com/forcedotcom/salesforcedx-vscode/pull/6187))
- We improved the UX for restarting the Apex Language Server by making the notification in the Apex menu seamlessly guide users to the new `SFDX: Restart Apex Language Server` command in the Command Palette. This ensures a smoother, and more intuitive workflow. ([PR #6194](https://github.com/forcedotcom/salesforcedx-vscode/pull/6194))
- We now support any Java version that is 11 or higher. ([PR #6201](https://github.com/forcedotcom/salesforcedx-vscode/pull/6201))
- We made some changes under the hood. ([PR #6187](https://github.com/forcedotcom/salesforcedx-vscode/pull/6187), [PR #6195](https://github.com/forcedotcom/salesforcedx-vscode/pull/6195), [PR #6189](https://github.com/forcedotcom/salesforcedx-vscode/pull/6189))

#### salesforcedx-apex-replay-debugger

- We made some changes under the hood. ([PR #6206](https://github.com/forcedotcom/salesforcedx-vscode/pull/6206))

# 63.9.1 - April 17, 2025

## Fixed

#### salesforcedx-vscode-core

- We fixed the import in the Lightning web components (LWC) test template so that newly created LWC tests won't contain any errors in the Problems Tab. ([PR #6207](https://github.com/forcedotcom/salesforcedx-vscode/pull/6207))

#### salesforcedx-vscode-apex

- We fixed an issue where an Apex variable with a number in the middle of its name was previously treated as two separate variables. ([PR #6184](https://github.com/forcedotcom/salesforcedx-vscode/pull/6184))
- We fixed an issue where the `SFDX: Restart Apex Language Server` command wasn't always visible. Now it's always visible. ([PR #6187](https://github.com/forcedotcom/salesforcedx-vscode/pull/6187))
- We improved the UX for restarting the Apex Language Server by making the notification in the Apex menu seamlessly guide users to the new `SFDX: Restart Apex Language Server` command in the Command Palette. This ensures a smoother, and more intuitive workflow. ([PR #6194](https://github.com/forcedotcom/salesforcedx-vscode/pull/6194))
- We now support any Java version that is 11 or higher. ([PR #6201](https://github.com/forcedotcom/salesforcedx-vscode/pull/6201))
- We made some changes under the hood. ([PR #6187](https://github.com/forcedotcom/salesforcedx-vscode/pull/6187), [PR #6195](https://github.com/forcedotcom/salesforcedx-vscode/pull/6195), [PR #6189](https://github.com/forcedotcom/salesforcedx-vscode/pull/6189))

#### salesforcedx-apex-replay-debugger

- We made some changes under the hood. ([PR #6206](https://github.com/forcedotcom/salesforcedx-vscode/pull/6206))

# 63.8.2 - April 11, 2025

## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue where an Apex variable with a number in the middle of its name was previously treated as two separate variables. ([PR #6184](https://github.com/forcedotcom/salesforcedx-vscode/pull/6184))
- We fixed an issue where the `SFDX: Restart Apex Language Server` command wasn't always visible. Now it's always visible. ([PR #6187](https://github.com/forcedotcom/salesforcedx-vscode/pull/6187))
- We improved the UX for restarting the Apex Language Server by making the notification in the Apex menu seamlessly guide users to the new `SFDX: Restart Apex Language Server`command in the Command Palette. This ensures a smoother, and more intuitive workflow.([PR #6194](https://github.com/forcedotcom/salesforcedx-vscode/pull/6194))
- We made some changes under the hood. ([PR #6187](https://github.com/forcedotcom/salesforcedx-vscode/pull/6187), [PR #6195](https://github.com/forcedotcom/salesforcedx-vscode/pull/6195), [PR #6189](https://github.com/forcedotcom/salesforcedx-vscode/pull/6189))

# 63.8.0 - April 9, 2025

## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue where an Apex variable with a number in the middle of its name was previously treated as two separate variables. ([PR #6184](https://github.com/forcedotcom/salesforcedx-vscode/pull/6184))
- We fixed an issue where the `SFDX: Restart Apex Language Server` command wasn't always visible. Now it's always visible. ([PR #6187](https://github.com/forcedotcom/salesforcedx-vscode/pull/6187))
- We made some changes under the hood. ([PR #6187](https://github.com/forcedotcom/salesforcedx-vscode/pull/6187))

# 63.7.0 - April 2, 2025

## Added

#### salesforcedx-vscode-core
#### salesforcedx-vscode-apex

- We updated the Org Browser to include more lightning component types. ([PR #6174](https://github.com/forcedotcom/salesforcedx-vscode/pull/6174))
- Use the new `SFDX: Restart Apex Language Server` command to restart the Apex Language Server. ([PR #6177](https://github.com/forcedotcom/salesforcedx-vscode/pull/6177))
- Code coverage colors now match your VS Code theme, so you can create a personalized coding experience. In the past, these colors were static. ([PR #6155](https://github.com/forcedotcom/salesforcedx-vscode/pull/6155))



## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #6163](https://github.com/forcedotcom/salesforcedx-vscode/pull/6163))

# 63.6.0 - March 26, 2025

## Added

#### salesforcedx-vscode
#### salesforcedx-vscode-expanded

 🚀  **Agentforce for Developers Elevated to Salesforce Extension Pack**

With its elevated presence in the Salesforce Extension Pack, Agentforce for Developers is now a core part of the Salesforce developer experience. This change improves discoverability, making it easier for developers to find and install Agentforce for Developers as part of their workflow. ([PR #6097](https://github.com/forcedotcom/salesforcedx-vscode/pull/6097))


## Fixed

#### salesforcedx-vscode-core

- We updated the org browser icon. ([PR #6152](https://github.com/forcedotcom/salesforcedx-vscode/pull/6152))

# 63.5.0 - March 19, 2025

## Fixed

#### salesforcedx-vscode-apex

- We made some changes under the hood. ([PR #6146](https://github.com/forcedotcom/salesforcedx-vscode/pull/6146), [PR #6148](https://github.com/forcedotcom/salesforcedx-vscode/pull/6148), [PR #6150](https://github.com/forcedotcom/salesforcedx-vscode/pull/6150))

# 63.4.1 - March 14, 2025

## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue that caused missing descriptions to be handled incorrectly when creating an OpenAPI document. ([PR #6125](https://github.com/forcedotcom/salesforcedx-vscode/pull/6125))

- We improved the OpenAPI document generation so that the generated fields appear in a specific order. ([PR #6129](https://github.com/forcedotcom/salesforcedx-vscode/pull/6129))

- We made some changes under the hood. ([PR #6140](https://github.com/forcedotcom/salesforcedx-vscode/pull/6140))

#### salesforcedx-vscode-core

- We added some labels in the Org Browser. ([PR #6139](https://github.com/forcedotcom/salesforcedx-vscode/pull/6139))

- We made some changes under the hood. ([PR #6124](https://github.com/forcedotcom/salesforcedx-vscode/pull/6124), [PR #6128](https://github.com/forcedotcom/salesforcedx-vscode/pull/6128))

#### salesforcedx-vscode-lightning
#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #6141](https://github.com/forcedotcom/salesforcedx-vscode/pull/6141))

# 63.2.3 - February 28, 2025

## Added

#### salesforcedx-vscode-apex

- 🚀 Create Custom Agent Actions from Your Apex REST Classes using the new `SFDX: Create OpenAPI Document from this Class (Beta)` command. The command generates an OpenAPI document for your Apex REST class using Salesforce's secure, custom generative AI model.  Easily deploy the generated document to your org's API Catalog. Then, use it to create an agent action using Agent Studio. ([PR #6102](https://github.com/forcedotcom/salesforcedx-vscode/pull/6102))

## Fixed

#### salesforcedx-vscode-apex

- We corrected the URL for the "Set your Java version" link. ([PR #6106](https://github.com/forcedotcom/salesforcedx-vscode/pull/6106))

# 63.1.1 - February 19, 2025

## Added

#### salesforcedx-vscode-core

- We updated our dependencies to support the latest metadata types. As a result, you can now deploy all the latest metadata types using the VSCode extensions. ([PR #6083](https://github.com/forcedotcom/salesforcedx-vscode/pull/6083))

# 63.0.0 - February 13, 2025

## Added

#### salesforcedx-vscode-apex

- We've made some updates to the Apex LSP to prepare for an upcoming Salesforce release bump.([PR #6062](https://github.com/forcedotcom/salesforcedx-vscode/pull/6062))

## Fixed

#### salesforcedx-utils-vscode

- We fixed an under-the-hood issue with our telemetry. ([PR #6006](https://github.com/forcedotcom/salesforcedx-vscode/pull/6006))

#### salesforcedx-vscode

- Our VS Code Marketplace page now shows the minimum VS Code version that’s required by the Salesforce Extension Pack.([PR #6044](https://github.com/forcedotcom/salesforcedx-vscode/pull/6044))

# 62.14.1 - January 15, 2025

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5996](https://github.com/forcedotcom/salesforcedx-vscode/pull/5996), [PR #6003](https://github.com/forcedotcom/salesforcedx-vscode/pull/6003))

- We got rid of that pesky warning that you saw every time you opened the `sfdx-project.json` file in your project. ([PR #6000](https://github.com/forcedotcom/salesforcedx-vscode/pull/6000))

# 62.13.0 - January 8, 2025

## Fixed

#### salesforcedx-utils-vscode

- We updated the configuration used to check if telemetry is enabled from `enableTelemetry` to `telemetryLevel`. ([PR #5986](https://github.com/forcedotcom/salesforcedx-vscode/pull/5986))

# 62.12.0 - January 1, 2025

## Fixed

#### salesforcedx-visualforce-language-server

- We fixed an issue where the Visualforce Language Server threw a `Request textDocument/documentHighlight failed with message: Debug Failure. False expression. Code: -32603` error when JavaScript code in the embedded `<script>` tag was selected. Thank you [AndrewStopchenko-SO](https://github.com/AndrewStopchenko-SO) for this contribution. ([PR #5975](https://github.com/forcedotcom/salesforcedx-vscode/pull/5975))

# 62.9.1 - December 12, 2024

## Added

#### salesforcedx-vscode-apex

- We've added a new Visual Studio Code configuration that lets you enable error telemetry from the Apex Language Server. We turned off this feature by default so that we can reduce noise. ([PR #5969](https://github.com/forcedotcom/salesforcedx-vscode/pull/5969))

## Fixed

#### salesforcedx-vscode-core

- We fixed some labels in the Org Browser.([PR #5967](https://github.com/forcedotcom/salesforcedx-vscode/pull/5967))

# 62.5.1 - November 14, 2024

## Added

#### salesforcedx-vscode-apex

- We improved the accuracy of the range for Class, Enum, and Interface symbols in the Apex LSP `.jar` file. We also modified document symbol creation to introduce a nested symbol hierarchy in the Outline View, improving clarity of the outline. ([PR #5945](https://github.com/forcedotcom/salesforcedx-vscode/pull/5945))

#### salesforcedx-vscode-core

- When you push or deploy on save, you’ll no longer automatically switch to the output panel view by default. You can toggle this setting with the `salesforcedx-vscode-core.push-or-deploy-on-save.showOutputPanel` setting. Thank you [Jason Venable](https://github.com/tehnrd) for this contribution. ([PR #5904](https://github.com/forcedotcom/salesforcedx-vscode/pull/5904))
- We made some changes under the hood. ([PR #5939](https://github.com/forcedotcom/salesforcedx-vscode/pull/5939))

## Fixed

#### salesforcedx-vscode-core

- To ensure smooth operation the Salesforce Extension Pack needs to run with a minimum supported Visual Studio Code version. We support only Visual Studio Code 1.90.0 or higher. ([PR #5937](https://github.com/forcedotcom/salesforcedx-vscode/pull/5937))

# 62.3.1 - November 1, 2024

## Fixed

#### salesforcedx-vscode-apex

- We fixed a bug where deleted folders still showed Apex tests in the Testing sidebar. Now, when you delete a folder, it will be completely removed. No more pesky leftover tests! We did this by adding a new file watcher that triggers when an entire folder is deleted. ([PR #5901](https://github.com/forcedotcom/salesforcedx-vscode/pull/5901))

- 🚀 We improved the startup time of the Apex extension by 30%. This was achieved by moving our check for orphaned Apex Language Server instances outside the activation loop. This means that Apex extensions start up faster, so you can get to work more quickly. ([PR #5900](https://github.com/forcedotcom/salesforcedx-vscode/pull/5900))

- We made some changes under the hood. ([PR #5930](https://github.com/forcedotcom/salesforcedx-vscode/pull/5930))

# 62.2.0 - October 23, 2024

## Added

#### salesforcedx-vscode-apex

- We added telemetry to the Apex Language Server, so you can track all errors and exceptions. To see them, select the "Apex Language Server" dropdown in the Output tab. Want to enable or disable telemetry? Use the `Salesforcedx-vscode-core › Telemetry` setting. ([PR #5897](https://github.com/forcedotcom/salesforcedx-vscode/pull/5897))

# 62.0.0 - October 9, 2024

## Fixed

#### salesforcedx-vscode-apex

- We updated the Java Home Setting description to include Java 21. ([PR #5878](https://github.com/forcedotcom/salesforcedx-vscode/pull/5878))
- We updated the Apex Language Server to support the latest features and improvements of the language. When you activate the new version of the Apex extension for the first time, you could experience some lag while your workspace is upgraded to 252 Apex artifacts and your project is fully indexed. ([PR #5887](https://github.com/forcedotcom/salesforcedx-vscode/pull/5887))

#### salesforcedx-vscode-core

- We fixed some labels in the Org Browser. ([PR #5714](https://github.com/forcedotcom/salesforcedx-vscode/pull/5888)) ([PR #5844](https://github.com/forcedotcom/salesforcedx-vscode/pull/5888))
- We bumped SDR to catch up with the latest and fixed an issue where the `SFDX: Retrieve Source from Org` command nested a duplicate parent folder. Thank you [Alan Reader](https://github.com/readeral) for creating the issue. ([PR #5889](https://github.com/forcedotcom/salesforcedx-vscode/pull/5889), [ISSUE #2997](https://github.com/forcedotcom/cli/issues/2977))

## Added

### salesforcedx-vscode-apex
### salesforcedx-vscode-apex-replay-debugger
### salesforcedx-vscode-core
### salesforcedx-vscode-lightning
### salesforcedx-vscode-lwc
### salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #5889](https://github.com/forcedotcom/salesforcedx-vscode/pull/5889)).

# 61.16.0 - October 2, 2024

## Fixed

#### salesforcedx-vscode-soql

- We fixed an issue where the "Switch Between SOQL Builder and Text Editor" icon went missing. ([PR #5868](https://github.com/forcedotcom/salesforcedx-vscode/pull/5868), [ISSUE #5841](https://github.com/forcedotcom/salesforcedx-vscode/issues/5841))

# 61.15.0 - September 25, 2024

## Added

#### salesforcedx-vscode-lwc

- To improve developer productivity and code quality, now you can use Salesforce TypeScript type definitions to develop Lightning web components (LWCs). For now, support for a limited number of Salesforce type definitions is in developer preview. To learn more, see [TypeScript Support for LWC (Developer Preview)](https://developer.salesforce.com/docs/platform/lwc/guide/ts.html).

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5714](https://github.com/forcedotcom/salesforcedx-vscode/pull/5714)) ([PR #5844](https://github.com/forcedotcom/salesforcedx-vscode/pull/5844))

## Fixed

#### salesforcedx-vscode-core

- To help you quickly connect to the right default org, we’ve added handy indicators to let you know if your default org has expired, or isn’t valid. ([PR #5835](https://github.com/forcedotcom/salesforcedx-vscode/pull/5835))

- We fixed an issue where the `SFDX:Push Source to Default Org` and `SFDX:Pull Source from Default Org` commands would hang without throwing an error message when the error wasn’t related to files in the project. ([PR #5838](https://github.com/forcedotcom/salesforcedx-vscode/pull/5838))

- We made some changes under the hood. ([PR #5857](https://github.com/forcedotcom/salesforcedx-vscode/pull/5857)), ([PR #5830](https://github.com/forcedotcom/salesforcedx-vscode/pull/5830)), ([PR #5786](https://github.com/forcedotcom/salesforcedx-vscode/pull/5786))


#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #5821](https://github.com/forcedotcom/salesforcedx-vscode/pull/5821))

# 61.12.0 - September 4, 2024

## Fixed

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We fixed an issue where the `paths` property was incorrectly placed in jsconfig.json. ([PR #597](https://github.com/forcedotcom/lightning-language-server/pull/597), [PR #5798](https://github.com/forcedotcom/salesforcedx-vscode/pull/5798))

# 61.11.0 - August 28, 2024

## Added

#### salesforcedx-vscode-core

- Increase minimum vscode version to 1.86.0 ([PR #5733](https://github.com/forcedotcom/salesforcedx-vscode/pull/5733))

## Fixed

#### salesforcedx-vscode-core

- "SFDX: Generate Manifest File" command should not exist for manifest files ([PR #5731](https://github.com/forcedotcom/salesforcedx-vscode/pull/5731))

# 61.10.0 - August 21, 2024

## Added

#### salesforcedx-vscode
#### salesforcedx-vscode-expanded

- To ensure smooth operation, the Salesforce Extension Pack needs to run with a minimum supported Visual Studio Code version. We support only Visual Studio Code 1.86 or higher. ([PR #5715](https://github.com/forcedotcom/salesforcedx-vscode/pull/5715))

#### salesforcedx-vscode-core

- Good news! We’ve made the core extension smaller and better. By bundling more libraries, we’ve reduced the size from 8.9MB to 2.8MB. That’s a big win for everyone. ([PR #5705](https://github.com/forcedotcom/salesforcedx-vscode/pull/5705))

## Fixed

#### docs

- We made some changes under the hood. ([PR #5707](https://github.com/forcedotcom/salesforcedx-vscode/pull/5707))

#### salesforcedx-apex-replay-debugger
#### salesforcedx-vscode-apex-replay-debugger

- To give us better insight into its behavior, we’ve added more telemetry to the Apex Replay Debugger. ([PR #5724](https://github.com/forcedotcom/salesforcedx-vscode/pull/5724))

#### salesforcedx-vscode
#### salesforcedx-vscode-expanded

- We made helpful clarifications in Marketplace READMEs. ([PR #5716](https://github.com/forcedotcom/salesforcedx-vscode/pull/5716))

#### salesforcedx-vscode-core

- We fixed an issue with the `SFDX: Diff Folder Against Org` and `SFDX: Diff File Against Org` commands. These commands now work correctly when you have a file in your project, but not in your org. You won’t see a notification that says the command is running when it’s not. ([PR #5722](https://github.com/forcedotcom/salesforcedx-vscode/pull/5722))

- You can now rename Lightning Web Component (LWC) components when the Aura folder isn’t present, and vice versa. We’ve also added checks when creating new LWC and Aura components to ensure that the name doesn't already exist. ([PR #5718](https://github.com/forcedotcom/salesforcedx-vscode/pull/5718), [ISSUE #5692](https://github.com/forcedotcom/salesforcedx-vscode/issues/5692))

# 61.8.1 - August 8, 2024

## Added

#### salesforcedx-vscode-expanded

- The Code Analyzer extension is now part of our Expanded Pack. Use this extension to scan your code against multiple rule engines to produce lists of violations and improve your code. ([PR #5702](https://github.com/forcedotcom/salesforcedx-vscode/pull/5702))

## Fixed

#### salesforcedx-utils

#### salesforcedx-utils-vscode

- We fixed a bug that caused some CLI commands to return ANSI color characters in JSON results. This change removes those characters before the JSON strings are parsed. ([PR #5708](https://github.com/forcedotcom/salesforcedx-vscode/pull/5708), [ISSUE #5695](https://github.com/forcedotcom/salesforcedx-vscode/issues/5695))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5699](https://github.com/forcedotcom/salesforcedx-vscode/pull/5699))

# 61.7.0 - July 31, 2024

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood.

# 61.6.0 - July 24, 2024

## Added

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-lwc

- Now you can collapse all Apex and LWC tests in the testing side panel. ([PR #5684](https://github.com/forcedotcom/salesforcedx-vscode/pull/5684))

#### salesforcedx-vscode-core

- We made a major upgrade to the `@salesforce/apex-node-bundle` library. With this upgrade, the Apex test results now display information about test setup methods and test setup time, improving your testing experience. ([PR #5691](https://github.com/forcedotcom/salesforcedx-vscode/pull/5691)).

## Fixed

#### docs

- We've made some under-the-hood improvements to enhance security.([PR #5690](https://github.com/forcedotcom/salesforcedx-vscode/pull/5690))

# 61.5.0 - July 17, 2024

## Added

#### salesforcedx-vscode-lwc

- We added support for the LWC Lightning Record Picker component. You can now use features like hover and auto-completion when you're working with this component in VS Code. ([PR #5683](https://github.com/forcedotcom/salesforcedx-vscode/pull/5683)).

# 61.4.0 - July 10, 2024

## Added

#### salesforcedx-vscode-core

- We made a major upgrade to the version of the `@salesforce/core` library. ([PR #5665](https://github.com/forcedotcom/salesforcedx-vscode/pull/5665), [PR #5676](https://github.com/forcedotcom/salesforcedx-vscode/pull/5676))

## Fixed

- We fixed an issue that prevented extensions from activating when the beta feature to decompose components was used in `sfdx-project.json`. Thank you [KevinGossentCap](https://github.com/KevinGossentCap) for reporting the issue. ([PR #1359](https://github.com/forcedotcom/source-deploy-retrieve/pull/1359), [ISSUE #5664](https://github.com/forcedotcom/salesforcedx-vscode/issues/5664))

# 61.2.1 - June 26, 2024

## Added

#### salesforcedx-vscode-core

- 🚀 🚀 We're happy to announce that we've made our extension pack smaller and faster. We've bundled more Salesforce libraries that the extension pack depends on into the extension pack, which reduced its size by 40 MB. You should see substantial improvements in startup time and performance.

## Fixed

#### docs

- We updated our documentation with information about installing JDK 21. ([PR #5655](https://github.com/forcedotcom/salesforcedx-vscode/pull/5655))

- We made updates to our Apex Debugger documentation.  ([PR #5649](https://github.com/forcedotcom/salesforcedx-vscode/pull/5649))


#### salesforcedx-vscode-core

- We fixed an issue where an incorrect caching strategy caused metadata files to deploy with outdated content. ([PR #5650](https://github.com/forcedotcom/salesforcedx-vscode/pull/5650), [ISSUE #5612](https://github.com/forcedotcom/salesforcedx-vscode/issues/5612))

# 61.1.202406191959 - June 20, 2024

See [GitHub Release](https://github.com/forcedotcom/salesforcedx-vscode/releases/tag/v61.1.202406191959) for details.


# 61.1.2 - June 21, 2024

## Added

#### salesforcedx-vscode-apex

- We fixed an issue where `sf apex get test` and `sf apex run test` threw heap out of memory in large projects. Thank you [Paweł Idczak](https://github.com/pawel-id) for creating the issue. ([PR #5647](https://github.com/forcedotcom/salesforcedx-vscode/pull/5647), [ISSUE #5589](https://github.com/forcedotcom/salesforcedx-vscode/issues/5589))

#### salesforcedx-vscode-apex-replay-debugger

- We made some changes under the hood. ([PR #5647](https://github.com/forcedotcom/salesforcedx-vscode/pull/5647))

## Fixed

#### docs

- We removed trailing slashes from URLs in docs to improve SEO. Thank you [Jason Rogers](https://github.com/jmrog) for your work on this PR. ([PR #5632](https://github.com/forcedotcom/salesforcedx-vscode/pull/5632))

#### salesforcedx-vscode-soql

- We fixed an issue where users were unable to filter by NULL values if the SObject field type was a string. ([PR #5646](https://github.com/forcedotcom/salesforcedx-vscode/pull/5646))

# 61.1.1 - June 21, 2024

## Added

#### salesforcedx-vscode-apex

- We fixed an issue where `sf apex get test` and `sf apex get test` in large projects threw heap out of memory. Thank you [Paweł Idczak](https://github.com/pawel-id) for creating the issue. ([PR #5647](https://github.com/forcedotcom/salesforcedx-vscode/pull/5647), [ISSUE #5589](https://github.com/forcedotcom/salesforcedx-vscode/issues/5589))

#### salesforcedx-vscode-apex-replay-debugger

- We made some changes under the hood. ([PR #5647](https://github.com/forcedotcom/salesforcedx-vscode/pull/5647))

## Fixed

#### docs

- We removed trailing slashes from URLs in docs to improve SEO. ([PR #5632](https://github.com/forcedotcom/salesforcedx-vscode/pull/5632))

#### salesforcedx-vscode-soql

- We fixed an issue where users were unable to filter by NULL values if the SObject field type was a string. ([PR #5646](https://github.com/forcedotcom/salesforcedx-vscode/pull/5646))

# 61.0.202406132249 - June 14, 2024

See [GitHub Release](https://github.com/forcedotcom/salesforcedx-vscode/releases/tag/v61.0.202406132249) for details.


# 61.0.1 - June 14, 2024

## Added

#### salesforcedx-vscode-apex

- :tada: We're excited to announce that our extensions now support Java 21! :rocket: ([PR #5621](https://github.com/forcedotcom/salesforcedx-vscode/pull/5621))

- Apex language server has been updated to support the latest features and improvements of the language. When you activate the new version of the Apex extension for the first time, there might be a noticeable delay while your workspace is upgraded to 250 Apex artifacts and your project is fully indexed. ([PR #5635](https://github.com/forcedotcom/salesforcedx-vscode/pull/5635))

## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue where the output of the "Apex Code Coverage by Class" table in the Apex test results were missing when "Store Only Aggregated Code Coverage" is enabled in the Apex Test Execution settings. Thank you [Matthias Rolke](https://github.com/amtrack) for bringing this to our attention. ([PR #370](https://github.com/forcedotcom/salesforcedx-apex/pull/370), [PR #5629](https://github.com/forcedotcom/salesforcedx-vscode/pull/5629))

#### salesforcedx-vscode-expanded

- We resolved an issue where the Apex PMD extension was missing from the Salesforce Extension Pack Expanded when published in the Open VSX Registry. ([PR #5639](https://github.com/forcedotcom/salesforcedx-vscode/pull/5639))

# 60.15.202405302148 - May 30, 2024

See [GitHub Release](https://github.com/forcedotcom/salesforcedx-vscode/releases/tag/v60.15.202405302148) for details.


# 60.15.0 - May 29, 2024

## Added

#### Features

🚀 We’re thrilled to announce that Einstein for Developers (Beta) is now a part of the [Salesforce Expanded Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-expanded)! 🚀
Here’s what you can expect with this change -

* Access to powerful generative AI tooling that is grounded in the context your org’s data, and is backed by the promise of Salesforce’s Trust Layer. See [Additional Terms of Use](https://developer.salesforce.com/tools/vscode/en/einstein/einstein-termsofuse) for information.
* Seamless updating of extension versions. Weekly extension releases include new features and enhancements that we continue to make to Einstein for Developers!
* Einstein for Developers is enabled by default in our VS Code desktop application. Follow these [steps](https://developer.salesforce.com/tools/vscode/en/einstein/einstein-setup) to enable it in Code Builder.

We’re excited that we’ve made it easier for you to give Einstein for Developers a spin, and we hope you’ll give it a try.  We’d love your [feedback](https://developer.salesforce.com/tools/vscode/en/einstein/einstein-feedback)! 📝

## Fixed

#### docs

- We made more prominent notes for known issue with trusted IP ranges for Code Builder. ([PR #5606](https://github.com/forcedotcom/salesforcedx-vscode/pull/5606))

- We updated the Code Builder content for licenses for add-ons ([PR #5605](https://github.com/forcedotcom/salesforcedx-vscode/pull/5605))

#### salesforcedx-vscode-expanded

- We made updates to the guidelines for Einstein for Developers. ([PR #5596](https://github.com/forcedotcom/salesforcedx-vscode/pull/5596))

# 60.13.1 - May 16, 2024

# 60.13.0 - May 15, 2024

## Fixed

#### docs

- We made updates to the troubleshooting guidelines for Einstein for Developers. ([PR #5587](https://github.com/forcedotcom/salesforcedx-vscode/pull/5587))

#### salesforcedx-vscode-core

- We got rid of the annoying `"Warning: Ignoring extra certs from null, load failed: error:80000002:system library::No such file or directory"` warning when the `Salesforcedx-vscode-core: NODE_EXTRA_CA_CERTS` setting is missing. ([PR #5575](https://github.com/forcedotcom/salesforcedx-vscode/pull/5575))

# 60.13.0 - May 15, 2024

## Fixed

#### docs

- We made updates to the troubleshooting guidelines for Einstein for Developers. ([PR #5587](https://github.com/forcedotcom/salesforcedx-vscode/pull/5587))

#### salesforcedx-vscode-core

- We got rid of the annoying `"Warning: Ignoring extra certs from null, load failed: error:80000002:system library::No such file or directory"` warning when the `Salesforcedx-vscode-core: NODE_EXTRA_CA_CERTS` setting is missing. ([PR #5575](https://github.com/forcedotcom/salesforcedx-vscode/pull/5575))

# 60.12.0 - May 8, 2024

## Added

#### salesforcedx-vscode-core

- We made a major upgrade to the version of the @salesforce/core library. ([PR #5556](https://github.com/forcedotcom/salesforcedx-vscode/pull/5556))

- We no longer prompt you for a directory location when you use the context menu to run an Apex command to create a class. We just gather the information from the context, making things a little more convenient for you. Thank you [Heber](https://github.com/aheber) for this awesome contribution.  #5544 ([PR #5561](https://github.com/forcedotcom/salesforcedx-vscode/pull/5561))

## Fixed

#### docs

- We updated the replay debugger content with some helpful information. ([PR #5566](https://github.com/forcedotcom/salesforcedx-vscode/pull/5566))

# 60.11.0 - May 1, 2024

## Fixed

#### salesforcedx-utils-vscode

- We made some changes under the hood. ([PR #5540](https://github.com/forcedotcom/salesforcedx-vscode/pull/5540))

#### salesforcedx-vscode-apex

- An abstract method is now correctly displayed in the Outline view. ([PR #5555](https://github.com/forcedotcom/salesforcedx-vscode/pull/5555), [ISSUE #5553](https://github.com/forcedotcom/salesforcedx-vscode/issues/5553))

# 60.10.0 - April 24, 2024

## Added

#### salesforcedx-vscode-lwc

- We now support the `lightning_UrlAddressable` enumeration type in LWC components. Thank you 
[Mike Senn](https://github.com/mpsenn) for this contribution. ([PR #5328](https://github.com/forcedotcom/salesforcedx-vscode/pull/5328))

## Fixed

#### salesforcedx-apex-debugger
#### salesforcedx-utils
#### salesforcedx-utils-vscode
#### salesforcedx-vscode-apex-debugger

- We fixed an issue where the ISV Debugger threw a project configuration error when you clicked the **Launch Apex Debugger** button.  Now you should be able to start the debugger without any issues. We'd love to hear your feedback on the ISV Debugger, and happy debugging! ([PR #5522](https://github.com/forcedotcom/salesforcedx-vscode/pull/5522))

#### salesforcedx-vscode-apex
#### salesforcedx-vscode-apex-replay-debugger
#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5537](https://github.com/forcedotcom/salesforcedx-vscode/pull/5537),[PR #5543](https://github.com/forcedotcom/salesforcedx-vscode/pull/5543))

# 60.9.0 - April 17, 2024

## Added

#### salesforcedx-vscode-lwc

- Add lightning__UrlAddressable enumeration ([PR #5328](https://github.com/forcedotcom/salesforcedx-vscode/pull/5328))

## Fixed

#### salesforcedx-apex-debugger

- ISV Debugger no longer throws project configuration error when 'Launch Apex Debugger' button is clicked ([PR #5522](https://github.com/forcedotcom/salesforcedx-vscode/pull/5522))

#### salesforcedx-utils

- ISV Debugger no longer throws project configuration error when 'Launch Apex Debugger' button is clicked ([PR #5522](https://github.com/forcedotcom/salesforcedx-vscode/pull/5522))

#### salesforcedx-utils-vscode

- ISV Debugger no longer throws project configuration error when 'Launch Apex Debugger' button is clicked ([PR #5522](https://github.com/forcedotcom/salesforcedx-vscode/pull/5522))

#### salesforcedx-vscode-apex-debugger

- ISV Debugger no longer throws project configuration error when 'Launch Apex Debugger' button is clicked ([PR #5522](https://github.com/forcedotcom/salesforcedx-vscode/pull/5522))

#### salesforcedx-vscode-core

- Bump apex-node apply json dangling comma bug ([PR #5537](https://github.com/forcedotcom/salesforcedx-vscode/pull/5537))

# 60.8.0 - April 10, 2024

## Added

#### forcedotcom/salesforcedx-apex

- We added detailed elapsed time debug log data as an investigative step in trying to diagnose Apex test commands that are taking a long time to run. ([PR #349](https://github.com/forcedotcom/salesforcedx-apex/pull/349))

- We now use streams to handle Apex test results, which prevents string length violation errors for very large test results. ([PR #352](https://github.com/forcedotcom/salesforcedx-apex/pull/352))

## Fixed

#### forcedotcom/salesforcedx-apex

- We added guards that properly deal with an undefined test summary when formatting Apex test run results. ([PR #354](https://github.com/forcedotcom/salesforcedx-apex/pull/354))

# 60.7.0 - April 3, 2024

## Fixed

#### docs

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-core

- We completed the transition from Salesforce CLI sfdx commands to sf (v2) commands. All sfdx commands and flags have been updated to their sf equivalents. **Action Required**: Users must install the sf (v2) Salesforce CLI to continue working with the Salesforce Extension Pack. You can learn more about the migration process in the [Salesforce CLI Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_move_to_sf_v2.htm).
If you run Salesforce CLI commands in the terminal, use the newer sf commands. See the [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_unified.htm) and [Migration Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_migrate.htm). ([PR #5435](https://github.com/forcedotcom/salesforcedx-vscode/pull/5435), [PR #5466](https://github.com/forcedotcom/salesforcedx-vscode/pull/5466), [PR #5523](https://github.com/forcedotcom/salesforcedx-vscode/pull/5523))

# 60.5.1 - March 21, 2024

## Fixed

#### docs

- We made updates to the [Java Setup](https://developer.salesforce.com/tools/vscode/en/vscode-desktop/java-setup) topic to include troubleshooting tips. ([PR #5502](https://github.com/forcedotcom/salesforcedx-vscode/pull/5502))

#### salesforcedx-utils-vscode

- We fixed an issue where users who worked within a symbolic link could not run deploy and retrieve commands. ([PR #5507](https://github.com/forcedotcom/salesforcedx-vscode/pull/5507))

#### salesforcedx-vscode-core

- We fixed an issue in `SFDX: Create and Set Up Project for ISV Debugging` where error notifications were being displayed for steps that run successfully. ([PR #5500](https://github.com/forcedotcom/salesforcedx-vscode/pull/5500))

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We updated some dependencies to accommodate an external contribution. ([PR #584](https://github.com/forcedotcom/lightning-language-server/pull/584), [PR #5505](https://github.com/forcedotcom/salesforcedx-vscode/pull/5505))

# 60.4.1 - March 14, 2024

## Fixed

#### salesforcedx-utils-vscode

- We fixed an issue where conflict and error cases details weren't being displayed in the Output tab for push and pull commands. ([PR #5498](https://github.com/forcedotcom/salesforcedx-vscode/pull/5498))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5465](https://github.com/forcedotcom/salesforcedx-vscode/pull/5465))

# 60.3.2 - March 5, 2024

# 60.3.1 - March 4, 2024

## Added

#### docs

- Alongside this release, the Einstein for Developers extension release includes a host of new features that we hope you'll test drive. See the Einstein for Developers [change log](https://marketplace.visualstudio.com/items/salesforce.salesforcedx-einstein-gpt/changelog) for more details.

# 60.3.1 - March 4, 2024

## Added

#### docs

- Alongside this release, the Einstein for Developers extension release includes a host of new features that we hope you'll test drive. See the Einstein for Developers [change log](https://marketplace.visualstudio.com/items/salesforce.salesforcedx-einstein-gpt/changelog) for more details.

# 60.2.3 - February 29, 2024

## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue where code lens stopped working for anonymous apex files. Thank you [Mohith Shrivastava](https://github.com/msrivastav13) for creating the issue. ([PR #5468](https://github.com/forcedotcom/salesforcedx-vscode/pull/5468), [ISSUE #5467](https://github.com/forcedotcom/salesforcedx-vscode/issues/5467))

- We made some changes under the hood. ([PR #5452](https://github.com/forcedotcom/salesforcedx-vscode/pull/5452))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5451](https://github.com/forcedotcom/salesforcedx-vscode/pull/5451), [PR #5446](https://github.com/forcedotcom/salesforcedx-vscode/pull/5446))

- We enabled debug logging for libraries that consume the env var SF_LOG_LEVEL. ([PR #5444](https://github.com/forcedotcom/salesforcedx-vscode/pull/5444))

#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #5429](https://github.com/forcedotcom/salesforcedx-vscode/pull/5429))

# 60.1.2 - February 22, 2024

## Fixed

#### salesforcedx-vscode-apex
- We made some changes under the hood. ([PR #5427](https://github.com/forcedotcom/salesforcedx-vscode/pull/5427), [PR #5442](https://github.com/forcedotcom/salesforcedx-vscode/pull/5442))

#### salesforcedx-vscode-lwc
- We made some changes under the hood. ([PR #5428](https://github.com/forcedotcom/salesforcedx-vscode/pull/5428))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5424](https://github.com/forcedotcom/salesforcedx-vscode/pull/5424), [PR #5409](https://github.com/forcedotcom/salesforcedx-vscode/pull/5409), [PR #5418](https://github.com/forcedotcom/salesforcedx-vscode/pull/5418))

- We fixed an issue where error messages thrown by push commands weren't showing up in the Output tab. ([PR #5441](https://github.com/forcedotcom/salesforcedx-vscode/pull/5441))

- We fixed an uncaught error that occurs when the Cancel button is clicked to cancel a retrieve in progress. ([PR #5443](https://github.com/forcedotcom/salesforcedx-vscode/pull/5443))

# 60.0.0 - February 14, 2024

## Added

#### salesforcedx-vscode-core

- Bump SDR to 10.3.3 ([PR #5400](https://github.com/forcedotcom/salesforcedx-vscode/pull/5400))

#### salesforcedx-vscode-apex

- We updated the Apex Language Server to support the null coalescing operator. Thank you [Gianluca Riboldi](https://github.com/gian-ribo) for creating the issue. ([PR #5385](https://github.com/forcedotcom/salesforcedx-vscode/pull/5385), [ISSUE #5384](https://github.com/forcedotcom/salesforcedx-vscode/issues/5384)). 

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue so that logging out of the default org results in a single notification, making for a more pleasant user experience.  ([PR #5407](https://github.com/forcedotcom/salesforcedx-vscode/pull/5407))

- We fixed an issue with the Org Browser so that custom objects with a namespace can now be refreshed. ([PR #5403](https://github.com/forcedotcom/salesforcedx-vscode/pull/5403))

- We no longer show you commands that require a default org when no default org is set. ([PR #5406](https://github.com/forcedotcom/salesforcedx-vscode/pull/5406))

- We migrated some more commands to the new `sf style`. ([PR #5379](https://github.com/forcedotcom/salesforcedx-vscode/pull/5379), [PR #5388](https://github.com/forcedotcom/salesforcedx-vscode/pull/5388))

# 59.17.0 - February 7, 2024

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with the `SFDX:Deploy this Source to Org` command not throwing an error when the command failed. ([PR #5392](https://github.com/forcedotcom/salesforcedx-vscode/pull/5392))

- We migrated some more commands to the new `sf style`. ([PR #5362](https://github.com/forcedotcom/salesforcedx-vscode/pull/5362))

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #5393](https://github.com/forcedotcom/salesforcedx-vscode/pull/5393))

# 59.16.0 - January 31, 2024

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood to make the java version validation more reliable. Thank you [Saranchuk Viktor](https://github.com/Blackbackroom) for creating the issue.
 ([PR #5363](https://github.com/forcedotcom/salesforcedx-vscode/pull/5363), [ISSUE #5358](https://github.com/forcedotcom/salesforcedx-vscode/issues/5358))

# 59.15.0 - January 26, 2024

## Added

#### salesforcedx-vscode-core

- We made a major upgrade to the version of the `@salesforce/core` library. ([PR #5332](https://github.com/forcedotcom/salesforcedx-vscode/pull/5332))

## Fixed

#### docs

- We added information about purchasing additional Code Builder licenses. ([PR #5329](https://github.com/forcedotcom/salesforcedx-vscode/pull/5329))

#### salesforcedx-utils-vscode

#### salesforcedx-vscode-apex

- We fixed an issue with the Apex Replay Debugger that was preventing it from being launched from an Apex test file. ([PR #5326](https://github.com/forcedotcom/salesforcedx-vscode/pull/5326))

- We made some changes under the hood. ([PR #5342](https://github.com/forcedotcom/salesforcedx-vscode/pull/5342))

- We made some changes so that the no coverage warning now only pops up for Apex classes and Apex triggers. We also added a setting to move the warning from notifications to the Output panel. ([PR #5320](https://github.com/forcedotcom/salesforcedx-vscode/pull/5320))

#### salesforcedx-vscode-core

- We migrated some more commands to the new `sf style` to get rid of more warnings. ([PR #5297](https://github.com/forcedotcom/salesforcedx-vscode/pull/5297), [PR #5298](https://github.com/forcedotcom/salesforcedx-vscode/pull/5298))

- We reverted CLI version validation ([PR #5185](https://github.com/forcedotcom/salesforcedx-vscode/pull/5185)) to resolve issues for users who were affected by it. ([PR #5343](https://github.com/forcedotcom/salesforcedx-vscode/pull/5343))

#### salesforcedx-vscode-apex-debugger

- We made some changes under the hood. ([PR #5341](https://github.com/forcedotcom/salesforcedx-vscode/pull/5341))

#### salesforcedx-vscode-apex-replay-debugger

- We made some changes under the hood. ([PR #5341](https://github.com/forcedotcom/salesforcedx-vscode/pull/5341))

# 59.14.0 - January 17, 2024

## Added

#### salesforcedx-vscode-core

- We made a major upgrade to the version of the `@salesforce/core` library. ([PR #5332](https://github.com/forcedotcom/salesforcedx-vscode/pull/5332))

## Fixed

#### docs

- We added information about purchasing additional Code Builder licenses. ([PR #5329](https://github.com/forcedotcom/salesforcedx-vscode/pull/5329))

#### salesforcedx-utils-vscode

#### salesforcedx-vscode-apex

- We fixed an issue with the Apex Replay Debugger that was preventing it from being launched from an Apex test file. ([PR #5326](https://github.com/forcedotcom/salesforcedx-vscode/pull/5326))

#### salesforcedx-vscode-core

- We migrated some more commands to the new `sf style` to get rid of more warnings. ([PR #5297](https://github.com/forcedotcom/salesforcedx-vscode/pull/5297), [PR #5298](https://github.com/forcedotcom/salesforcedx-vscode/pull/5298))

# 59.13.0 - January 11, 2024

## Added

#### salesforcedx-vscode-core

- We now validate your CLI version during activation of the CLI Integration extension and let you know if you need to make any updates. The validation ensures that your CLI version is compatible with the rest of our extension pack. We hope this update takes away some of the guesswork around which CLI version you should be on, and helps keep your CLI up to date. ([PR #5185](https://github.com/forcedotcom/salesforcedx-vscode/pull/5185))

## Fixed

#### docs

- We added new information about prompt context and grounding to our docs. Now you can write prompts using context and also better understand grounding. All this to ask the right questions and get back higher quality responses from Einstein for Developers. ([PR #5264](https://github.com/forcedotcom/salesforcedx-vscode/pull/5264))
- We made some changes under the hood. ([PR #5307](https://github.com/forcedotcom/salesforcedx-vscode/pull/5307))

#### salesforcedx-utils-vscode

- We made some changes under the hood. ([PR #5316](https://github.com/forcedotcom/salesforcedx-vscode/pull/5316))

#### salesforcedx-vscode-apex

- We updated the @salesforce/apex-node dependency to correct an existing bug where Apex test result records were dropped during fetch from org. ([PR #5269](https://github.com/forcedotcom/salesforcedx-vscode/pull/5269))
- We fixed an issue where the Apex Replay Debugger was throwing an error that the logs directory did not exist when users tried to debug anonymous Apex for the first time. ([PR #5316](https://github.com/forcedotcom/salesforcedx-vscode/pull/5316))

#### salesforcedx-vscode-core

- We updated the @salesforce/templates version so that the latest API version 59.0 is used. ([PR #5260](https://github.com/forcedotcom/salesforcedx-vscode/pull/5260))
- We updated several commands to the new `sf style` to remove some more pesky warnings. ([PR #5273](https://github.com/forcedotcom/salesforcedx-vscode/pull/5273), [PR #5294](https://github.com/forcedotcom/salesforcedx-vscode/pull/5294), [PR #5295](https://github.com/forcedotcom/salesforcedx-vscode/pull/5295), [PR #5303](https://github.com/forcedotcom/salesforcedx-vscode/pull/5303))
- We made some changes under the hood. ([PR #5318](https://github.com/forcedotcom/salesforcedx-vscode/pull/5318))

# 59.12.2 - January 5, 2024

## Fixed

#### docs

- We added new information about prompt context and grounding to our docs. Now you can write prompts using context and also better understand grounding. All this to ask the right questions and get back higher quality responses from Einstein for Developers. ([PR #5264](https://github.com/forcedotcom/salesforcedx-vscode/pull/5264))
- We made some changes under the hood. ([PR #5307](https://github.com/forcedotcom/salesforcedx-vscode/pull/5307))

#### salesforcedx-utils-vscode

- We made some changes under the hood. ([PR #5316](https://github.com/forcedotcom/salesforcedx-vscode/pull/5316))

#### salesforcedx-vscode-apex

- We updated the @salesforce/apex-node dependency to correct an existing bug where Apex test result records were dropped during fetch from org. ([PR #5269](https://github.com/forcedotcom/salesforcedx-vscode/pull/5269))
- We fixed an issue where the Apex Replay Debugger was throwing an error that the logs directory did not exist when users tried to debug anonymous Apex for the first time. ([PR #5316](https://github.com/forcedotcom/salesforcedx-vscode/pull/5316))

#### salesforcedx-vscode-core

- We updated the @salesforce/templates version so that the latest API version 59.0 is used. ([PR #5260](https://github.com/forcedotcom/salesforcedx-vscode/pull/5260))
- We updated several commands to the new `sf style` to remove some more pesky warnings. Use the new VSCode setting to set the `SF_LOG_LEVEL` environment variable that is now required for the `SFDX: Create a Default Scratch Org` command. Documentation for Salesforce CLI log levels here: https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_dev_cli_log_messages.htm
  ([PR #5273](https://github.com/forcedotcom/salesforcedx-vscode/pull/5273), [PR #5294](https://github.com/forcedotcom/salesforcedx-vscode/pull/5294), [PR #5295](https://github.com/forcedotcom/salesforcedx-vscode/pull/5295))

# 59.12.1 - January 4, 2024

## Fixed

#### docs

- We added new information about prompt context and grounding to our docs. Now you can write prompts using context and also better understand grounding. All this to ask the right questions and get back higher quality responses from Einstein for Developers. ([PR #5264](https://github.com/forcedotcom/salesforcedx-vscode/pull/5264))
- We made some changes under the hood. ([PR #5307](https://github.com/forcedotcom/salesforcedx-vscode/pull/5307))

#### salesforcedx-utils-vscode
- We made some changes under the hood. ([PR #5316](https://github.com/forcedotcom/salesforcedx-vscode/pull/5316))

#### salesforcedx-vscode-apex

- We updated the @salesforce/apex-node dependency to correct an existing bug where Apex test result records were dropped during fetch from org. ([PR #5269](https://github.com/forcedotcom/salesforcedx-vscode/pull/5269))
- We fixed an issue where the Apex Replay Debugger was throwing an error that the logs directory did not exist when users tried to debug anonymous Apex for the first time. ([PR #5316](https://github.com/forcedotcom/salesforcedx-vscode/pull/5316))

#### salesforcedx-vscode-core

- We updated the @salesforce/templates version so that the latest API version 59.0 is used. ([PR #5260](https://github.com/forcedotcom/salesforcedx-vscode/pull/5260))
- We updated several commands to the new `sf style` to remove some more pesky warnings. ([PR #5273](https://github.com/forcedotcom/salesforcedx-vscode/pull/5273), [PR #5294](https://github.com/forcedotcom/salesforcedx-vscode/pull/5294), [PR #5295](https://github.com/forcedotcom/salesforcedx-vscode/pull/5295))

# 59.12.0 - January 3, 2024

## Fixed

#### docs

- We added new information about prompt context and grounding to our docs. Now you can write prompts using context and also better understand grounding. All this to ask the right questions and get back higher quality responses from Einstein for Developers. ([PR #5264](https://github.com/forcedotcom/salesforcedx-vscode/pull/5264))

#### salesforcedx-vscode-apex

- We updated the @salesforce/apex-node dependency to correct an existing bug where Apex test result records were dropped during fetch from org. ([PR #5269](https://github.com/forcedotcom/salesforcedx-vscode/pull/5269))

#### salesforcedx-vscode-core

- We updated the @salesforce/templates version so that the latest API version 59.0 is used. ([PR #5260](https://github.com/forcedotcom/salesforcedx-vscode/pull/5260))
- We updated the `SFDX: List All Config Variables` and `SFDX: Set a Default Org` commands to the new `sf style` to remove some more pesky warnings. ([PR #5273](https://github.com/forcedotcom/salesforcedx-vscode/pull/5273))

# 59.10.0 - December 20, 2023

## Fixed

#### docs

- We added new information about prompt context and grounding to our docs. Now you can write prompts using context and also better understand grounding. All this to ask the right questions and get back higher quality responses from Einstein for Developers. ([PR #5264](https://github.com/forcedotcom/salesforcedx-vscode/pull/5264))

#### salesforcedx-vscode-apex

- Update @salesforce/apex-node dependency to correct an existing bug where Apex test result records were dropped during fetch from org. ([PR #5269](https://github.com/forcedotcom/salesforcedx-vscode/pull/5269))

#### salesforcedx-vscode-core

- We updated @salesforce/templates version so that the latest API version 59.0 is used. ([PR #5260](https://github.com/forcedotcom/salesforcedx-vscode/pull/5260))

# 59.9.0 - December 13, 2023

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5253](https://github.com/forcedotcom/salesforcedx-vscode/pull/5253))
  
#### docs

- We made updates to the Org Browser docs topic. ([PR #5254](https://github.com/forcedotcom/salesforcedx-vscode/pull/5254))

# 59.8.0 - December 6, 2023

## Added

#### salesforcedx-vscode-apex
#### salesforcedx-vscode-expanded
#### salesforcedx-vscode-lightning
#### salesforcedx-vscode-lwc
#### salesforcedx-vscode-soql


- We made some changes to the order in which extensions that are part of the Salesforce Extension Pack, are enabled when the extension pack is activated. This update enables faster activation of our Extension Pack. ([PR #5250](https://github.com/forcedotcom/salesforcedx-vscode/pull/5250))

## Fixed

#### salesforcedx-vscode-apex
#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5257](https://github.com/forcedotcom/salesforcedx-vscode/pull/5257), [PR #5243](https://github.com/forcedotcom/salesforcedx-vscode/pull/5243))

# 59.7.0 - November 29, 2023

## Added

#### salesforcedx-vscode-apex

- We added a new setting that allows you to change the log levels of the Apex Language Server. ([PR #5235](https://github.com/forcedotcom/salesforcedx-vscode/pull/5235))

#### salesforcedx-vscode-core

- Use the new `SFDX: Create Apex Unit Test Class` command to quickly create Apex unit tests. ([PR #5237](https://github.com/forcedotcom/salesforcedx-vscode/pull/5237))

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5245](https://github.com/forcedotcom/salesforcedx-vscode/pull/5245))

# 59.5.1 - November 16, 2023

## Added

#### salesforcedx-vscode-apex

- We made some changes under the hood. ([PR #5205](https://github.com/forcedotcom/salesforcedx-vscode/pull/5205), [PR #5225](https://github.com/forcedotcom/salesforcedx-vscode/pull/5225))

## Fixed

#### docs

- We made updates to our documentation. ([PR #5213](https://github.com/forcedotcom/salesforcedx-vscode/pull/5213), [PR #5218](https://github.com/forcedotcom/salesforcedx-vscode/pull/5218))


#### salesforcedx-vscode-apex

- We made some updates so that closing of a workspace results in a clean shut down of the Apex language client. ([PR #5217](https://github.com/forcedotcom/salesforcedx-vscode/pull/5217))

- We made some changes under the hood. ([PR #5212](https://github.com/forcedotcom/salesforcedx-vscode/pull/5212))

#### salesforcedx-vscode-core

- We migrated from `TSLint` to `ESLint`. We can now support both TypeScript and JavaScript linting. ([PR #5203](https://github.com/forcedotcom/salesforcedx-vscode/pull/5203))

- We’ve removed support for Functions from the Salesforce Extension Pack. You can still use the SF CLI to access this functionality. ([PR #5204](https://github.com/forcedotcom/salesforcedx-vscode/pull/5204))

#### salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #5212](https://github.com/forcedotcom/salesforcedx-vscode/pull/5212))

# 59.4.0 - November 10, 2023

## Fixed

#### docs

- We made some doc updates. ([PR #5197](https://github.com/forcedotcom/salesforcedx-vscode/pull/5197))

# 59.3.1 - November 3, 2023

## Added

#### salesforcedx-vscode-apex

- We made some changes under the hood. ([PR #5184](https://github.com/forcedotcom/salesforcedx-vscode/pull/5184))

- Our Apex extension can now detect orphaned language servers at startup. You can view the processes in the Output channel and then do as you please with them. Terminate them, or ignore them. The choice is yours. Always remember though, with great power comes great responsibility! ([PR #5160](https://github.com/forcedotcom/salesforcedx-vscode/pull/5160))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5155](https://github.com/forcedotcom/salesforcedx-vscode/pull/5155))

## Fixed

#### docs

- We added a helpful note to the Local Development Server topic. Thank you [Brett](https://github.com/BrettMN) for your contribution. ([PR #5170](https://github.com/forcedotcom/salesforcedx-vscode/pull/5170))

#### forcedotcom/lightning-language-server

- We made some updates to the Lightning Language Server so that it no longer crashes on startup. Thank you [Itachi Uchiha](https://github.com/salesforceProDev) for creating the issue. Thank you [Rob Baillie](https://github.com/bobalicious) and [Răzvan Racolța](https://github.com/Razvan-Racolta) for helping us with testing. We appreciate each one of you. ([PR #583](https://github.com/forcedotcom/lightning-language-server/pull/583), [ISSUE #5069](https://github.com/forcedotcom/salesforcedx-vscode/issues/5069))

# 59.2.0 - October 27, 2023

## Added

#### salesforcedx-vscode-apex

- Our Apex extension can now detect orphaned language servers at startup. You can view the processes in the Output channel and then do as you please with them. Terminate them, or ignore them. The choice is yours. Remember this though --with great power comes great responsibility. ([PR #5160](https://github.com/forcedotcom/salesforcedx-vscode/pull/5160))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5155](https://github.com/forcedotcom/salesforcedx-vscode/pull/5155))

# 59.1.2 - October 19, 2023

## Fixed

#### salesforcedx-sobjects-faux-generator

- We added `Asset` and `Domain` objects to the current list of standard objects. ([PR #5125](https://github.com/forcedotcom/salesforcedx-vscode/pull/5125))

#### salesforcedx-vscode-apex

- We released a new version of the Apex Language Server. ([PR #5152](https://github.com/forcedotcom/salesforcedx-vscode/pull/5152))

#### salesforcedx-vscode-core

- We added a missing label. ([PR #5162](https://github.com/forcedotcom/salesforcedx-vscode/pull/5162))

- We upgraded the VS Code language client to version 9. ([PR #5127](https://github.com/forcedotcom/salesforcedx-vscode/pull/5127))

#### salesforcedx-vscode-lightning

- We changed the scope name of `html` grammar in the Aura extension so that `php` and `html` code is correctly parsed and highlighted. ([PR #5159](https://github.com/forcedotcom/salesforcedx-vscode/pull/5159))

# 59.1.1 - October 19, 2023

## Fixed

#### salesforcedx-sobjects-faux-generator

- We added `Asset` and `Domain` objects to the current list of standard objects. ([PR #5125](https://github.com/forcedotcom/salesforcedx-vscode/pull/5125))

#### salesforcedx-vscode-apex

- We released a new version of the Apex Language Server. ([PR #5152](https://github.com/forcedotcom/salesforcedx-vscode/pull/5152))

#### salesforcedx-vscode-core

- We added a missing label. ([PR #5162](https://github.com/forcedotcom/salesforcedx-vscode/pull/5162))

- We upgraded the VS Code language client to version 9. ([PR #5127](https://github.com/forcedotcom/salesforcedx-vscode/pull/5127))

#### salesforcedx-vscode-lightning

- We changed the scope name of `html` grammar in the Aura extension so that `php` and `html` code is correctly parsed and highlighted. ([PR #5159](https://github.com/forcedotcom/salesforcedx-vscode/pull/5159))

# 59.1.0 - October 20, 2023

## Fixed

#### salesforcedx-sobjects-faux-generator

- We added `Asset` and `Domain` objects to the current list of standard objects. ([PR #5125](https://github.com/forcedotcom/salesforcedx-vscode/pull/5125))

#### salesforcedx-vscode-apex

- We released a new version of the Apex Language Server. ([PR #5152](https://github.com/forcedotcom/salesforcedx-vscode/pull/5152))

#### salesforcedx-vscode-core

- We added a missing label. ([PR #5162](https://github.com/forcedotcom/salesforcedx-vscode/pull/5162))

- We upgraded the VS Code language client to version 9. ([PR #5127](https://github.com/forcedotcom/salesforcedx-vscode/pull/5127))

#### salesforcedx-vscode-lightning

- We changed the scope name of `html` grammar in the Aura extension so that `php` and `html` code is correctly parsed and highlighted. ([PR #5159](https://github.com/forcedotcom/salesforcedx-vscode/pull/5159))

# 59.0.0 - October 13, 2023

## Fixed

#### salesforcedx-vscode-core

- We updated the `SFDX: List All Aliases` command to the new `sf style` and got rid of more of those pesky warnings. You're welcome. ([PR #5112](https://github.com/forcedotcom/salesforcedx-vscode/pull/5112))

# 58.16.0 - October 4, 2023

## Added

#### salesforcedx-vscode-apex

- We fixed an Apex snippet and added some cool new ones. Thank you [Vishal Skywalker](https://github.com/Vishal-skywalker) for your contribution. It is greatly appreciated. ([PR #5108](https://github.com/forcedotcom/salesforcedx-vscode/pull/5108))

## Fixed

#### salesforcedx-vscode-core
- We made an update to the STL implementation so that Deploy and Retrieve operations are now faster. ([PR #5115](https://github.com/forcedotcom/salesforcedx-vscode/pull/5115), [ISSUE #4865](https://github.com/forcedotcom/salesforcedx-vscode/issues/4865))
- We migrated breakpoints and debugging commands and flags to the new `sf-style`. We also migrated org display commands and flags to `sf-style`. More reprieve from those annoying warnings!  ([PR #5072](https://github.com/forcedotcom/salesforcedx-vscode/pull/5072), [PR #5111](https://github.com/forcedotcom/salesforcedx-vscode/pull/5111))

#### forcedotcom/lightning-language-server
- We fixed the LWC Language Server so that it no longer crashes on startup. Thank you [divmain](https://github.com/divmain) for your contribution. ([PR #578](https://github.com/forcedotcom/lightning-language-server/pull/578), [ISSUE #4994](https://github.com/forcedotcom/salesforcedx-vscode/issues/4994))

# 58.15.0 - September 22, 2023

## Fixed

#### salesforcedx-vscode-apex

- We've formally withdrawn support for Java 8. ([PR #5078](https://github.com/forcedotcom/salesforcedx-vscode/pull/5078))

#### salesforcedx-vscode-core

- We migrated some commands that used `sfdx-style` to the new `sf-style`. You should now get some reprieve from those annoying warnings! ([PR #5071](https://github.com/forcedotcom/salesforcedx-vscode/pull/5071), [PR #5060](https://github.com/forcedotcom/salesforcedx-vscode/pull/5060),  [PR #5061](https://github.com/forcedotcom/salesforcedx-vscode/pull/5061), [PR #5059](https://github.com/forcedotcom/salesforcedx-vscode/pull/5059), [PR #5058](https://github.com/forcedotcom/salesforcedx-vscode/pull/5058))

# 58.14.2 - September 8, 2023

## Added

- We released a brand new [Einstein for Developers](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-einstein-gpt) extension 🎉 🎉! Use this extension to generate boilerplate code from natural language instructions in a sidebar, so you can work with your editor and the tool side by side, without any interruptions to your workflow. You can also get code suggestions within an existing Apex class, trigger, or anonymous Apex file. Simply enter in a prompt describing what you'd like to build and see Apex code generated within your editor. 

#### docs
- We added documentation for Einstein for Developers (Beta) ([PR #5053](https://github.com/forcedotcom/salesforcedx-vscode/pull/5053))

# 58.14.1 - September 1, 2023

## Fixed

#### salesforcedx-vscode-core

- We made improvements to the `SFDX: Create and Set Up Project for ISV Debugging` command by greatly reducing the number of steps involved in the retrieval of metadata and packages. We recommend that you use `sfdx-cli v7.192.2` or above to run this command successfully. We hope you find this update helpful. Thank you [Jelle van Geuns](https://github.com/jvg123) for opening the issue. Happy debugging! ([PR #5038](https://github.com/forcedotcom/salesforcedx-vscode/pull/5038), [ISSUE #5032](https://github.com/forcedotcom/salesforcedx-vscode/issues/5032))
- We made some changes that prevent the output panel from opening when the `SFDX: Refresh SObject Definitions` command is run in container mode. ([PR #5042](https://github.com/forcedotcom/salesforcedx-vscode/pull/5042))

#### docs

- We added a new Apex Language Server topic to documentation. The topic highlights the new Apex LSP status bar feature. ([PR #5044](https://github.com/forcedotcom/salesforcedx-vscode/pull/5044))

# 58.13.1 - August 25, 2023

## Added

#### salesforcedx-vscode-apex

- We added a brand spanking new icon to the status bar that displays the status of the Apex Language Server. Now you always know where you stand with the Apex LSP. :star2: :white_check_mark: 🎉. ([PR #4991](https://github.com/forcedotcom/salesforcedx-vscode/pull/4991))

## Fixed

#### salesforcedx-utils-vscode
#### salesforcedx-vscode-apex

- We made performance improvements to the Apex Language Server, so you should see faster startup times after the initial activation. The Language Server now only indexes changed files in your workspace. ([PR #4956](https://github.com/forcedotcom/salesforcedx-vscode/pull/4956))
- We fixed an issue where `Go To Definition` was throwing an error for built-in Apex classes. ([PR #4956](https://github.com/forcedotcom/salesforcedx-vscode/pull/4956), [ISSUE #4762](https://github.com/forcedotcom/salesforcedx-vscode/issues/4762))

# 58.11.0 - August 17, 2023

## Added

#### salesforcedx-vscode-core

- We made a major upgrade to the version of the `@salesforce/core` library. ([PR #5001](https://github.com/forcedotcom/salesforcedx-vscode/pull/5001))

## Fixed

#### salesforcedx-vscode-core

- We updated the `SFDX_CONTAINER_MODE` variable to `SF_CONTAINER_MODE` to resolve an issue with running the `SFDX: Authorize an Org` command in a container. ([PR #5020](https://github.com/forcedotcom/salesforcedx-vscode/pull/5020))

- We fixed issues under the hood so that the `SFDX: Create and Set Up project for ISV Debugging` command can now be run without displaying CLI warning messages. ([PR #5021](https://github.com/forcedotcom/salesforcedx-vscode/pull/5021))

- We fixed an issue under the hood so that the `SFDX: Set a Default Org` command can now be run without displaying CLI warning messages. ([PR #5015](https://github.com/forcedotcom/salesforcedx-vscode/pull/5015))

#### salesforcedx-vscode-lwc

- We made an update to a dashboard name to reflect a product name change. ([PR #5007](https://github.com/forcedotcom/salesforcedx-vscode/pull/5007))

# 58.9.1 - August 4, 2023

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #4993](https://github.com/forcedotcom/salesforcedx-vscode/pull/4993))

- We disabled LWC preview in container code. An error message that explains why the command is disabled, is displayed when the command is run in a container. ([PR #4983](https://github.com/forcedotcom/salesforcedx-vscode/pull/4983))

## Fixed

#### salesforcedx-utils-vscode

- We made some changes under the hood. ([PR #5011](https://github.com/forcedotcom/salesforcedx-vscode/pull/5011))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5005](https://github.com/forcedotcom/salesforcedx-vscode/pull/5005))

# 58.7.1 - July 21, 2023

## Added

#### salesforcedx-apex-debugger
#### salesforcedx-utils
#### salesforcedx-utils-vscode

- We updated environment variables for the Apex Interactive Debugger to reflect the new SF CLI style. ([PR #4980](https://github.com/forcedotcom/salesforcedx-vscode/pull/4980))

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with `Push-on-save` so that the command now works as expected. As a part of this fix, the `Problems` tab is now cleared after a successful push. ([PR #4975](https://github.com/forcedotcom/salesforcedx-vscode/pull/4975))

# 58.6.2 - July 13, 2023

## Added

#### salesforcedx-vscode-lightning

- We made an update to the lightning language server version. ([PR #4964](https://github.com/forcedotcom/salesforcedx-vscode/pull/4964))

#### salesforcedx-vscode-lwc

- We made an update to the lightning language server version. ([PR #4964](https://github.com/forcedotcom/salesforcedx-vscode/pull/4964))

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- We made some changes under the hood. ([PR #4948](https://github.com/forcedotcom/salesforcedx-vscode/pull/4948))

#### salesforcedx-vscode-core

- We fixed an issue with the problems tab not clearing errors. ([PR #4962](https://github.com/forcedotcom/salesforcedx-vscode/pull/4962))

#### salesforcedx-vscode-lwc

- We added new snippets for LWC HTML. Thank you [Mark Vogelgesang](https://github.com/mvogelgesang) for creating the issue. ([PR #4946](https://github.com/forcedotcom/salesforcedx-vscode/pull/4946), [ISSUE #4857](https://github.com/forcedotcom/salesforcedx-vscode/issues/4857))

# 58.4.1 - June 29, 2023

## Fixed

#### salesforcedx-vscode-apex

- We made updated dependencies in the Apex LSP and made some changes under the hood to enhance the debugging experience. ([PR #4950](https://github.com/forcedotcom/salesforcedx-vscode/pull/4950))


#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #4941](https://github.com/forcedotcom/salesforcedx-vscode/pull/4941))

# 58.3.1 - June 21, 2023

## Added

#### salesforcedx-vscode-core

- Backed out a change from the v58.3.0 release to fix https://github.com/forcedotcom/salesforcedx-vscode/issues/4938.

# 58.3.0 - June 21, 2023

## Added

#### salesforcedx-vscode-core

- We updated telemetry data to include Org Id. ([PR #4917](https://github.com/forcedotcom/salesforcedx-vscode/pull/4917))

# 58.2.0 - June 13, 2023

## Added

#### salesforcedx-vscode-core

- Deploy and retrieve commands now use the correct source API version. ([PR #4891](https://github.com/forcedotcom/salesforcedx-vscode/pull/4891))

- We made some changes under the hood. ([PR #4913](https://github.com/forcedotcom/salesforcedx-vscode/pull/4913))

# 58.1.1 - June 7, 2023

## Added

#### salesforcedx-vscode-apex

- We updated the Apex Language Server to include new and modified class. This update also fixed an issue with autocompletion not working for Slack classes. ([PR #4907](https://github.com/forcedotcom/salesforcedx-vscode/pull/4907))

## Fixed

#### salesforcedx-sobjects-faux-generator

- SObject refresh now uses the correct API version. ([PR #4883](https://github.com/forcedotcom/salesforcedx-vscode/pull/4883))

#### salesforcedx-vscode-apex

- We made some changes under the hood. ([PR #4906](https://github.com/forcedotcom/salesforcedx-vscode/pull/4906))

#### salesforcedx-vscode-apex-replay-debugger

- We made some changes under the hood. ([PR #4906](https://github.com/forcedotcom/salesforcedx-vscode/pull/4906))

# 58.0.1 - June 2, 2023

## Added

#### salesforcedx-vscode-core

- We added a setting that enables or disables source tracking for deploy and retrieve operations. ([PR #4885](https://github.com/forcedotcom/salesforcedx-vscode/pull/4885))

- We exposed the `TelemetryService` class in the core extension API ([PR #4879](https://github.com/forcedotcom/salesforcedx-vscode/pull/4879))

#### salesforcedx-vscode-lwc

- We now support custom property editors in `.js-meta.xml` validation. With this update you can now get syntax insights when configuring a component for custom property editing. ([PR #4874](https://github.com/forcedotcom/salesforcedx-vscode/pull/4874))

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue where local changes were being detected as conflicts in conjunction with the "Detect Conflicts At Sync" setting. ([PR #4853](https://github.com/forcedotcom/salesforcedx-vscode/pull/4853))

#### salesforcedx-vscode-soql

- We updated the copyright template so that it shows the current year ([PR #4850](https://github.com/forcedotcom/salesforcedx-vscode/pull/4850))

# 57.15.0 - May 24, 2023

## Added

#### salesforcedx-vscode-core

- We enabled our Org Browser functionality when users are working with Scratch Orgs ([PR #4810](https://github.com/forcedotcom/salesforcedx-vscode/pull/4810))

- We added a setting "Prefer deploy on save" that will run a deploy instead of a push when "Push or deploy on save" is enabled. ([PR #4820](https://github.com/forcedotcom/salesforcedx-vscode/pull/4820))

- We published our extensions to Open VSX for the first time, and automated the process to publish there going forward. ([PR #4855](https://github.com/forcedotcom/salesforcedx-vscode/pull/4855))

## Fixed

#### salesforcedx-vscode-apex

- We updated the Apex language server so that the syntax for Database class methods like _insert_ and _delete_ include _accessLevel_ parameters. ([PR #4866](https://github.com/forcedotcom/salesforcedx-vscode/pull/4866))

#### salesforcedx-vscode-core

- We fixed an issue where a MetadataApiRetrieveError was displayed when attempting to deploy an empty project ([PR #4845](https://github.com/forcedotcom/salesforcedx-vscode/pull/4845))

- We made some changes under the hood. ([PR #4793](https://github.com/forcedotcom/salesforcedx-vscode/pull/4793))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- We've made an update to the lightning language server version that may help the server load faster for users with large projects. Thank you [mwaddoupffdc](https://github.com/mwaddoupffdc) for contributing this improvement! ([PR #4872](https://github.com/forcedotcom/salesforcedx-vscode/pull/4872))

# 57.14.1 - May 17, 2023

## Fixed

#### salesforcedx-vscode-soql

- Updated SOQL Builder so that it does not show an error when there is no default org set and a SOQL file is not currently open. ([PR #4847](https://github.com/forcedotcom/salesforcedx-vscode/pull/4847))

# 57.13.1 - May 10, 2023

## Added

#### salesforcedx-vscode-apex

- We updated the Apex language server so that new syntax such as _insert_, _as user_, _as system_ and _Assert_ is now available in VS Code. Replay debugger is now available for Anonymous Apex as a result of this update. ([PR #4819](https://github.com/forcedotcom/salesforcedx-vscode/pull/4819))

#### salesforcedx-vscode-core

- We enabled the following Deploy and Retrieve commands for scratch orgs ([PR #4809](https://github.com/forcedotcom/salesforcedx-vscode/pull/4809)):
  * **SFDX: Deploy Source to Org**
  * **SFDX: Deploy This Source to Org**
  * **SFDX: Deploy Source in Manifest to Org**
  * **SFDX: Retrieve Source from Org**
  * **SFDX: Retrieve This Source from Org**
  * **SFDX: Retrieve Source in Manifest from Org**

- **SFDX: Delete This from Project and Org** and **SFDX: Delete from Project and Org** commands are now available in the Command Palette and in the context menu for scratch orgs. ([PR #4757](https://github.com/forcedotcom/salesforcedx-vscode/pull/4757))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- We've made an update to the lightning language server version. ([PR #4821](https://github.com/forcedotcom/salesforcedx-vscode/pull/4821))

## Fixed

#### salesforcedx-vscode-core

- We fixed some issues with **Deploy** commands for source-tracked orgs. ([PR #4824](https://github.com/forcedotcom/salesforcedx-vscode/pull/4824))

- We fixed some issues with **Retrieve** commands for source-tracked orgs. ([PR #4773](https://github.com/forcedotcom/salesforcedx-vscode/pull/4773))

- We made some changes under the hood. ([PR #4749](https://github.com/forcedotcom/salesforcedx-vscode/pull/4749))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #4807](https://github.com/forcedotcom/salesforcedx-vscode/pull/4807))

#### salesforcedx-vscode-apex-debugger, salesforcedx-vscode-apex-replay-debugger, salesforcedx-vscode-lightning, salesforcedx-vscode-lwc, salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #4828](https://github.com/forcedotcom/salesforcedx-vscode/pull/4828))

# 57.10.2 - April 13, 2023

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue where some metadata labels in the org browser weren't correctly displayed. ([PR #4772](https://github.com/forcedotcom/salesforcedx-vscode/pull/4772))

- We fixed an issue so that Source-Tracking Commands (Push*, Pull*, View Changes\*) are now available Source-Tracked Sandboxes. ([PR #4755](https://github.com/forcedotcom/salesforcedx-vscode/pull/4755))

- We removed legacy source tracking commands from the command palette. ([PR #4771](https://github.com/forcedotcom/salesforcedx-vscode/pull/4771))

- We fixed an issue where retrieving the ExperiencePropertyType metadata type would throw an error. Thank you [Kaaviyan](https://github.com/Kaaviyan) for your PR. ([PR #4784](https://github.com/forcedotcom/salesforcedx-vscode/pull/4784), [PR #4761](https://github.com/forcedotcom/salesforcedx-vscode/pull/4761))

#### salesforcedx-vscode-soql

- We fixed an issue with SOQL Builder where Code Builder users would see an empty file upon saving a query result. ([PR #4754](https://github.com/forcedotcom/salesforcedx-vscode/pull/4754))

# 57.7.0 - March 22, 2023

## Added

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- We updated the version of the lightning language server. The new version now includes additional code completion and helpful hover text. ([PR #4736](https://github.com/forcedotcom/salesforcedx-vscode/pull/4736))

## Fixed

#### salesforcedx-vscode-soql

- We fixed an issue so that the default directory for unsaved query results is now correctly set to the home directory instead of root. ([PR #4742](https://github.com/forcedotcom/salesforcedx-vscode/pull/4742))

# 57.6.0 - March 15, 2023

## Fixed

#### salesforcedx-vscode-core

We removed the `SFDX: Start Function in Container` command from the Command Palette. ([PR #4707](https://github.com/forcedotcom/salesforcedx-vscode/pull/4707)).

We made some changes under the hood. ([#4723](https://github.com/forcedotcom/salesforcedx-vscode/pull/4723)).

# 57.3.0 - February 24, 2023

## Fixed

#### salesforcedx-vscode-apex-replay-debugger, salesforcedx-utils-vscode

We fixed an issue where checkpoints were being set and removed in an unreliable manner. ([PR #4686](https://github.com/forcedotcom/salesforcedx-vscode/pull/4686)).

#### salesforcedx-vscode-apex-replay-debugger, salesforcedx-utils-vscode, salesforcedx-vscode-apex, salesforcedx-vscode-lwc

We fixed an issue where test icons were not appearing for Apex or LWC tests. ([PR #4686](https://github.com/forcedotcom/salesforcedx-vscode/pull/4686)).

#### salesforcedx-vscode-lwc

We fixed an issue where debugging an individual Lightning Web Component test was not working as expected. ([PR #4688](https://github.com/forcedotcom/salesforcedx-vscode/pull/4688))

#### salesforcedx-vscode-core

We made some updates under the hood. ([PR #4677](https://github.com/forcedotcom/salesforcedx-vscode/pull/4677)), ([PR #4682](https://github.com/forcedotcom/salesforcedx-vscode/pull/4682)).

# 57.2.1 - February 16, 2023

## Fixed

#### salesforcedx-utils-vscode, salesforcedx-utils

We made some updates under the hood. ([PR #4661](https://github.com/forcedotcom/salesforcedx-vscode/pull/4661))

# 56.16.0 - January 25, 2023
## Fixed

#### salesforcedx-vscode-core

- You can now run the `SFDX: Create Project` command in a new VS Code window without creating a local workspace in advance. Previously, the command would throw an error when it didn't find a workspace folder. ([PR #4622](https://github.com/forcedotcom/salesforcedx-vscode/pull/4622))

# 56.14.0 - January 11, 2023

## Added

#### salesforcedx-vscode-core

- You can now give an alias to the Devhub that you are authorizing. Thank you, [Andruts](https://github.com/andruts), for contributing this new feature! We love contributions from the community, and look forward to many more.([PR #4579](https://github.com/forcedotcom/salesforcedx-vscode/pull/4579), [ISSUE #2278](https://github.com/forcedotcom/salesforcedx-vscode/issues/2278))

- We now validate the maximum number of characters (40) for an apex class or trigger name and throw an error when this number is exceeded. ([PR #4580](https://github.com/forcedotcom/salesforcedx-vscode/pull/4580))

## Fixed

#### salesforcedx-vscode-apex-debugger

- We updated the apex interactive debugger package to include the `@salesforce/core` library so the debugger now activates correctly. ([PR #4538](https://github.com/forcedotcom/salesforcedx-vscode/pull/4538))

#### salesforcedx-vscode-core

- Clicking on the “No Default Org Set” in the status bar now displays a list of possible org authorization commands instead of throwing an unhelpful error.([PR #4584](https://github.com/forcedotcom/salesforcedx-vscode/pull/4584))

- We updated the metadata for the API version for Apex classes and triggers created from the default apex template, to version 56. We also made minor fixes to the generated code outline. ([PR #4581](https://github.com/forcedotcom/salesforcedx-vscode/pull/4581))

#### salesforcedx-vscode-lwc

- We added missing Experience Cloud targets for LWR sites. ([PR #4578](https://github.com/forcedotcom/salesforcedx-vscode/pull/4578))

# 56.5.1 - November 9, 2022

- We made some large updates to the Quick Start and Overviews section of our Apex Documentation. ([PR #4522](https://github.com/forcedotcom/salesforcedx-vscode/pull/4522))
- We continue some under the hood work on the `@salesforce/core` library. ([PR #4521](https://github.com/forcedotcom/salesforcedx-vscode/pull/4521))

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- We fixed an issue where the interactive debugger was not loading for Windows users. ([PR #4536](https://github.com/forcedotcom/salesforcedx-vscode/issues/4536))

# 56.4.1 - November 3, 2022

- We continued some under the hood work on the `@salesforce/core` library. ([PR #4509](https://github.com/forcedotcom/salesforcedx-vscode/pull/4509), [PR #4510](https://github.com/forcedotcom/salesforcedx-vscode/pull/4510), [PR #4516](https://github.com/forcedotcom/salesforcedx-vscode/pull/4516), [PR #4517](https://github.com/forcedotcom/salesforcedx-vscode/pull/4517))
- We updated contributing docs for the jest unit updates we made last week. ([PR #4503](https://github.com/forcedotcom/salesforcedx-vscode/pull/4503))
- We updated our bundling of the core extension to exclude `functions-core`. ([PR #4532](https://github.com/forcedotcom/salesforcedx-vscode/pull/4532))

# 56.3.1 - October 29, 2022

We made lots of under the hood updates in this release that involved:
  - Addition of new jest unit tests for test infrastructure hardening.
  - A major upgrade to the version of the `@salesforce/core` library to reach parity with CLI dependencies. 
  - A new way of bundling extensions that resulted in a smaller increase in the size of the Extension Pack.

## Added

#### salesforcedx-vscode-core

- We added support for renaming aura event bundles. ([PR #4441](https://github.com/forcedotcom/salesforcedx-vscode/pull/4441))

- You can now run the new `SFDX: Open Documentation` command from an open file to access in context documentation. ([PR #4414](https://github.com/forcedotcom/salesforcedx-vscode/pull/4414))

## Fixed

#### salesforcedx-vscode-core

- We made some updates under the hood. ([PR #4408](https://github.com/forcedotcom/salesforcedx-vscode/pull/4408))

#### salesforcedx-utils

- We made some updates under the hood. ([PR #4470](https://github.com/forcedotcom/salesforcedx-vscode/pull/4470))

#### salesforcedx-utils-vscode

- We made some updates under the hood.([PR #4517](https://github.com/forcedotcom/salesforcedx-vscode/pull/4517), [PR #4470](https://github.com/forcedotcom/salesforcedx-vscode/pull/4470))

#### salesforcedx-vscode-core

- We made some updates under the hood. ([PR #4502](https://github.com/forcedotcom/salesforcedx-vscode/pull/4502), [PR #4449](https://github.com/forcedotcom/salesforcedx-vscode/pull/4449), [PR #4426](https://github.com/forcedotcom/salesforcedx-vscode/pull/4426), [PR #4411](https://github.com/forcedotcom/salesforcedx-vscode/pull/4411), [PR #4388](https://github.com/forcedotcom/salesforcedx-vscode/pull/4388), [PR #4353](https://github.com/forcedotcom/salesforcedx-vscode/pull/4353), [PR #4362](https://github.com/forcedotcom/salesforcedx-vscode/pull/4362))

- We fixed an issue that caused SOQL and Anonymous Apex files to deploy on save. ([PR #4410](https://github.com/forcedotcom/salesforcedx-vscode/pull/4410))


#### salesforcedx-vscode-lightning
#### salesforcedx-vscode-lwc

- We fixed an issue that caused double logging from lwc language server on error. ([PR #4473](https://github.com/forcedotcom/salesforcedx-vscode/pull/4473))

# 55.12.2022091401 - September 14, 2022

## Pre-Release Beta

To test the beta:
- Open VS Code (or VS Code Insiders if that's what you use)
- Download all of the .vsix files attached to this release
- On the Extensions tab, select 'Install from VSIX'
![Screen Shot 2022-08-24 at 4 17 57 PM](https://user-images.githubusercontent.com/9795193/186516281-74132bad-2774-4c39-994e-00e388996237.png)
- Select all of the .vsix files you just downloaded
- Wait for all of the extensions to show 'Reload Required' (other than the SLDS Validator; not included)
![Screen Shot 2022-08-24 at 4 20 37 PM](https://user-images.githubusercontent.com/9795193/186516376-bd3d5dfa-7e1e-4c65-90ee-de6cd45e0071.png)
- Select any of the Reload Required buttons
- Open VS Code and confirm the updated version.

If you run into any issues, navigate to the Salesforce Extensions Pack in the Extensions tab, and select an older version (55.8.0 was the last one published). Otherwise, you'll be updated like normal when the next version is published through the VS Code Marketplace.

## Fixed

- We made some changes under the hood. (PR #4419, PR #4412, PR #4370)
- We rolled back a change that introduced a bug with the generate manifest command (#4411)
- We added the "SFDX: Open Documentation" command to easily open the VS Code Extensions for Salesforce documentation from the IDE (#4414)
- We fixed an issue where .soql and Anonymous Apex files would attempt to deploy on save (#4410)

# 55.11.2022083101 - September 1, 2022

## Pre-Release Beta

To test the beta:
- Open VS Code (or VS Code Insiders if that's what you use)
- Download all of the .vsix files attached to this release
- On the Extensions tab, select 'Install from VSIX'
![Screen Shot 2022-08-24 at 4 17 57 PM](https://user-images.githubusercontent.com/9795193/186516281-74132bad-2774-4c39-994e-00e388996237.png)
- Select all of the .vsix files you just downloaded
- Wait for all of the extensions to show 'Reload Required' (other than the SLDS Validator; not included)
![Screen Shot 2022-08-24 at 4 20 37 PM](https://user-images.githubusercontent.com/9795193/186516376-bd3d5dfa-7e1e-4c65-90ee-de6cd45e0071.png)
- Select any of the Reload Required buttons
- Open VS Code and confirm the updated version.

If you run into any issues, navigate to the Salesforce Extensions Pack in the Extensions tab, and select an older version (55.8.0 was the last one published). Otherwise, you'll be updated like normal when the next version is published through the VS Code Marketplace.

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #4378](https://github.com/forcedotcom/salesforcedx-vscode/pull/4378))

# 55.10.2022082401 - August 24, 2022

## Pre-Release Beta

To test the beta:
- Open VS Code (or VS Code Insiders if that's what you use)
- Download all of the .vsix files attached to this release
- On the Extensions tab, select 'Install from VSIX'
![Screen Shot 2022-08-24 at 4 17 57 PM](https://user-images.githubusercontent.com/9795193/186516281-74132bad-2774-4c39-994e-00e388996237.png)
- Select all of the .vsix files you just downloaded
- Wait for all of the extensions to show 'Reload Required' (other than the SLDS Validator; not included)
![Screen Shot 2022-08-24 at 4 20 37 PM](https://user-images.githubusercontent.com/9795193/186516376-bd3d5dfa-7e1e-4c65-90ee-de6cd45e0071.png)
- Select any of the Reload Required buttons
- Open VS Code and confirm the updated version.

If you run into any issues, navigate to the Salesforce Extensions Pack in the Extensions tab, and select an older version (55.8.0 was the last one published). Otherwise, you'll be updated like normal when the next version is published through the VS Code Marketplace.

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with an error message for the SObject refresh process being incorrectly displayed. ([PR #4353](https://github.com/forcedotcom/salesforcedx-vscode/pull/4353))
- We re-fixed an issue where making only a case change when renaming an Apex class caused an error. ([PR #4362](https://github.com/forcedotcom/salesforcedx-vscode/pull/4362))

#### salesforcedx-vscode-core, salesforcedx-sojbects-faux-gennerator, salesforcedx-vscode-apex, salesforcedx-utils-vscode, salesforcedx-vscode-apex-replay-debugger, salesforcedx-vscode-lightning, salesforcedx-vscode-lwc, salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #4342](https://github.com/forcedotcom/salesforcedx-vscode/pull/4342))

# 55.8.0 - August 4, 2022

## Added

#### salesforcedx-vscode-core

- We added a notification that warns you about scratch org expiration in advance so that you can back up any relevant data  or settings. ([PR #4304](https://github.com/forcedotcom/salesforcedx-vscode/pull/4304))

#### salesforcedx-vscode-core, salesforcedx-vscode-apex, salesforcedx-utils-vscode, salesforcedx-vscode-apex-replay-debugger

-  We added a setting that lets you choose the option to clear the current content of the output tab before a new command is executed. ([PR #4318](https://github.com/forcedotcom/salesforcedx-vscode/pull/4318))

# 55.7.0 - July 27, 2022

## Fixed

#### docs, #### salesforcedx-vscode-apex

- We updated some Java installation links in our docs. ([PR #4305](https://github.com/forcedotcom/salesforcedx-vscode/pull/4305))

# 55.6.0 - July 21, 2022

## Fixed

#### salesforcedx-vscode-core

- Fixed an issue where users were unable to rename an LWC component inside of the `__tests__` directory. ([PR #4225](https://github.com/forcedotcom/salesforcedx-vscode/pull/4225))

#### docs

- We made some updates under the hood. ([PR #4277](https://github.com/forcedotcom/salesforcedx-vscode/pull/4277))

# 55.4.1 - July 8, 2022

## Fixed

#### salesforcedx-vscode-core, salesforcedx-vscode-apex

- We reverted changes assoicated with PR #4240 due to issues with deploy/retrieve on windows.

# 55.4.0 - July 9, 2022

## Fixed

#### salesforcedx-vscode-core

- The links in the problems tab now correctly point to error locations in a file. ([PR #4246](https://github.com/forcedotcom/salesforcedx-vscode/pull/4246), [PR #4241](https://github.com/forcedotcom/salesforcedx-vscode/pull/4241))

- Fixed an issue where making only a case change when renaming an Apex class caused an error. ([PR #4240](https://github.com/forcedotcom/salesforcedx-vscode/pull/4240))

# 55.3.0 - June 29, 2022

## Fixed

#### salesforcedx-vscode-core

- You can now access the `SFDX Create Apex Class` command when you right-click on a sub-folder of the `classes` project folder. ([PR #4224](https://github.com/forcedotcom/salesforcedx-vscode/pull/4224))

# 55.2.0 - June 22, 2022

## Fixed

#### docs

- We made some updates under the hood. ([PR #4147](https://github.com/forcedotcom/salesforcedx-vscode/pull/4147))

#### salesforcedx-vscode-core

- We fixed an issue where you could run the `SFDX Generate Manifest File` command to create a manifest file from any folder in your project. The command is now only available by right clicking on any folder or file in the `force-app` package directory folder.  ([PR #4208](https://github.com/forcedotcom/salesforcedx-vscode/pull/4208))

- We updated @salesforce/templates to 55.0.0 to give you a default unit test in addition to the other component files when you create a new LWC component using the template. ([PR #4203](https://github.com/forcedotcom/salesforcedx-vscode/pull/4203))

# 55.0.0 - June 10, 2022

## Added

#### salesforcedx-vscode-core

- Thanks to a contribution from @shunkosa, we updated our Japanese commands. We love our Open Source community.  ([PR #4186](https://github.com/forcedotcom/salesforcedx-vscode/pull/4186))

## Fixed

#### salesforcedx-vscode-core

- We made some updates under the hood. ([PR #4165](https://github.com/forcedotcom/salesforcedx-vscode/pull/4165))

- We fixed an issue where the `SFDX: Create Lightning Web Component Test` command threw an error when you exited out of the command prematurely. ([PR #4143](https://github.com/forcedotcom/salesforcedx-vscode/pull/4143))

# 54.15.0 - June 1, 2022

## Added

#### salesforcedx-vscode-core

- The **SFDX: Rename Component** command now prevents you from renaming an LWC or Aura component if the new name breaks any naming rules. New LWC component names are automatically revised to start with a lower-case letter if they don't already. ([PR #4145](https://github.com/forcedotcom/salesforcedx-vscode/pull/4145))

#### salesforcedx-vscode-lightning
#### salesforcedx-vscode-lwc

- You can now use **Ctrl+Space** to retrigger autocomplete within code braces ({}) in an HTML file. Previously, if you moved away from or deleted content within code braces, you lost autocompletion. ([PR #4144](https://github.com/forcedotcom/salesforcedx-vscode/pull/4144))

# 54.12.0 - May 14, 2022

## Fixed

#### salesforcedx-vscode-core

- We added the ability to stop containerless function ([PR #4025](https://github.com/forcedotcom/salesforcedx-vscode/pull/4025))

# 54.11.0 - May 4, 2022

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with the _SFDX: Rename Component_ command so that it prevents a component from being renamed if the component bundle already contains a file with that name. ([PR #4039](https://github.com/forcedotcom/salesforcedx-vscode/pull/4039)).
- Fixed some under-the-hood issues. ([PR #4069](https://github.com/forcedotcom/salesforcedx-vscode/pull/4069)).

# 54.9.0 - April 21, 2022

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with the _SFDX: Rename Component_ command so that it now correctly renames the file in the `__tests__` folder for LWC components that has the same name as the component being renamed ([PR #4020](https://github.com/forcedotcom/salesforcedx-vscode/pull/4020)). 
- We added support for debugging JavaScript in containerless functions ([PR#4001](https://github.com/forcedotcom/salesforcedx-vscode/pull/4001)).
- We fixed an issue that prevented `Standard Value Sets` from being displayed in the Org Browser([PR # 3992](https://github.com/forcedotcom/salesforcedx-vscode/pull/3992)). Fixes Issue https://github.com/forcedotcom/salesforcedx-vscode/issues/1579

# 54.8.0 - April 13, 2022

## Fixed

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

We now consume the latest lightning-language-server packages, which fixes the textDocument/hover error when the package incorrectly parsed the content of `.js` files ([PR #4003](https://github.com/forcedotcom/salesforcedx-vscode/pull/4003)). Fixes Issue https://github.com/forcedotcom/salesforcedx-vscode/issues/3929.

#### salesforcedx-vscode-core

We now strip leading and trailing white spaces from the project name when you create a project using the `SFDX: Create Project` command. ([PR #3950](https://github.com/forcedotcom/salesforcedx-vscode/pull/3950)). Fixes Issue https://github.com/forcedotcom/salesforcedx-vscode/issues/2605

# 54.7.0 - April 6, 2022

## Added

#### salesforcedx-vscode-core

- Use the new _SFDX: Rename Component_ command to quickly rename all the files of an LWC component (`js, html, css, js-meta.xml` file types) or an Aura component (`auradoc, cmp, cmp-meta.xml, css, design, svg, contoller, helper, renderer, js` file types) using a single command.

# 54.6.1 - March 23, 2022

## Fixed

- Fixed inconsistent published package versions caused by issues with the availability of the VSCode Marketplace during publish of v54.6.0.

#### docs

- Improved documentation regarding org browser behavior ([PR #3941](https://github.com/forcedotcom/salesforcedx-vscode/pull/3941)) and fixed broken links ([PR #3939](https://github.com/forcedotcom/salesforcedx-vscode/pull/3939)).