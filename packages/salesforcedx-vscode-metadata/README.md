# Salesforce Metadata

This extension provides metadata operations for Salesforce development in VS Code.

## Features

- Deploy, retrieve, and diff source
- Change tracking operations
- Manifest generation and operations

## Requirements

- VS Code 1.90.0 or higher
- Salesforce CLI
- Authenticated Salesforce org

## Installation

This extension is part of the Salesforce Extensions for VS Code package.

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `salesforcedx-vscode-core.push-or-deploy-on-save.enabled` | boolean | `false` | Specifies whether or not to automatically push (for source-tracked orgs) or deploy (for non-source-tracked orgs) when a local source file is saved. |
| `salesforcedx-vscode-core.push-or-deploy-on-save.ignoreConflictsOnPush` | boolean | `false` | Specifies whether to always use --ignore-conflicts when you run project:deploy:start on save. |
| `salesforcedx-vscode-core.detectConflictsForDeployAndRetrieve` | boolean | `false` | When enabled, check for conflicts before deploy/retrieve on orgs that don't support source tracking. Orgs with tracking always check conflicts. |
| `salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds` | number | `60` | Interval in seconds to poll for remote source tracking changes. Set to 0 to disable polling. |
| `salesforcedx-vscode-metadata.show-success-notification` | boolean | `false` | Show an information notification on successful deploy, retrieve, or delete. |

## Usage

Documentation coming soon.

## Contributing

Please see the [contributing guide](../../CONTRIBUTING.md) for details on how to contribute to this project.

## License

[BSD 3-Clause License](LICENSE.txt)
