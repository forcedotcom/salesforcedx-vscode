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

