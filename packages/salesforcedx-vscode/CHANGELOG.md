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

