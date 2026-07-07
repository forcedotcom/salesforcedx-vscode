# 67.4.0 - July 8, 2026

## Fixed

#### salesforcedx-vscode-apex-testing

- We fixed a bug where the **Apex Tests** view kept showing tests from a disconnected org after you logged out or deleted the default org. The test tree now clears automatically without requiring a window reload. ([PR #7605](https://github.com/forcedotcom/salesforcedx-vscode/pull/7605))

- We fixed a bug where org-only Apex test files stayed open in stale virtual editors after logout. Those editors now close and their cached contents are purged when the org is lost. ([PR #7611](https://github.com/forcedotcom/salesforcedx-vscode/pull/7611))

- We fixed a bug where the **Re-Run Last Class** and **Re-Run Last Method** commands never appeared after running tests from the Command Palette or the **Testing** sidebar. The last run is now cached from those entry points too. ([PR #7627](https://github.com/forcedotcom/salesforcedx-vscode/pull/7627))

#### salesforcedx-vscode-metadata

- We fixed a bug where refreshing SObject definitions failed with a generic "An error has occurred" toast. The notification now shows the underlying cause of the failure. ([PR #7658](https://github.com/forcedotcom/salesforcedx-vscode/pull/7658), [ISSUE #7632](https://github.com/forcedotcom/salesforcedx-vscode/issues/7632))

- We fixed a bug where the in-manifest deploy and retrieve commands did not appear for manifest files with custom names such as `sfdxPackage.xml`. Any file matching `*Package.xml` now gets these commands, even outside a `manifest/` directory. ([PR #7616](https://github.com/forcedotcom/salesforcedx-vscode/pull/7616))

#### salesforcedx-vscode-services

- We fixed a bug where the trace flag status bar kept showing an expiration date after the trace flag tracking the current user was removed. The status bar now changes back to **No Tracing** when that happens. ([PR #7670](https://github.com/forcedotcom/salesforcedx-vscode/pull/7670))

## Under the Hood

- We made some under the hood changes. ([PR #7667](https://github.com/forcedotcom/salesforcedx-vscode/pull/7667), [PR #7673](https://github.com/forcedotcom/salesforcedx-vscode/pull/7673), [PR #7675](https://github.com/forcedotcom/salesforcedx-vscode/pull/7675))
