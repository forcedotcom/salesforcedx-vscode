# salesforcedx-vscode-org

This extension provides Salesforce org and authorization management commands for Visual Studio Code.

## Features

### Authorization Commands

- **Authorize an Org** - Connect to a Salesforce org using web-based login flow
- **Authorize a Dev Hub** - Connect to a Dev Hub org for scratch org management
- **Authorize an Org using Session ID** - Connect using an access token
- **Log Out from Default Org** - Remove authorization for the current default org
- **Log Out from All Authorized Orgs** - Remove all stored org authorizations

### Org Management Commands

- **Create a Default Scratch Org** - Create a new scratch org and set it as default
- **Open Default Org** - Launch your default org in a browser
- **Display Org Details** - Show information about your orgs
- **Delete Org** - Remove an org
- **Remove Deleted and Expired Orgs** - Clean up stale org authorizations
- **Set a Default Org** - Choose which org to use for development commands

### Org Picker

Visual org picker in the VS Code status bar showing your current default org, with quick access to switch between authorized orgs.

## Requirements

- Visual Studio Code v1.90.0 or higher
- Salesforce CLI (sf)
- Salesforce Extensions for VS Code (Core)

## Extension Settings

This extension contributes commands but does not add any VS Code settings.

## Documentation

For more information and detailed documentation, visit:

- [Salesforce Extensions for VS Code](https://developer.salesforce.com/tools/vscode/)
- [Salesforce CLI Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/)

---

Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions' Authenticity](../../SHA256.md) to learn how to verify the extensions.

---
