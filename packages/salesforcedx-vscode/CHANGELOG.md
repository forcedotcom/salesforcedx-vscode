# 64.8.0 - August 6, 2025

## Added

#### Targetted extension activations

- @W-18759649 less eager ext activations ([PR #6397](https://github.com/forcedotcom/salesforcedx-vscode/pull/6397))

Previously, every Salesforce extension would activate when you open any project with a `sfdx-project.json` file. To improve startup performance, we're now more selective about activation.

- Debuggers (Replay and Interactive) will only activate when you run a debugger command.
- The Visualforce extension will only activate when have a Visualforce `.page` or `.component` open.
- Aura and LWC extensions will activate only if your project contains those folders (`aura/` and `lwc/` respectively)

#### salesforcedx-vscode-core

- @W-18991079 - Push operations now use the source-deploy-retrieve instead of running a CLI command ([PR #6422](https://github.com/forcedotcom/salesforcedx-vscode/pull/6422)).

#### salesforedx-vscode-apex

- @W-18809074 add lsp parity configuration ([PR #6433](https://github.com/forcedotcom/salesforcedx-vscode/pull/6433))

Our new Typescript-based Apex Language Server is taking over a few duties from the Java-based one. You shouldn't notice a difference, but if you do, the new `Enable LSP parity capabilities` setting can be disabled to restore the previous behavior.
