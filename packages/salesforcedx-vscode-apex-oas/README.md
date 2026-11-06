# Apex OpenAPI Specification Extension

This extension provides OpenAPI Specification (OAS) generation for AuraEnabled Apex classes in Salesforce development.

## Features

- **Generate OpenAPI Documents**: Create OpenAPI v3 specifications from Apex classes with `@AuraEnabled` methods
- **Validate OpenAPI Documents**: Validate existing OpenAPI documents against Salesforce-specific rules
- **Spectral Validation**: Uses Spectral to ensure compliance with OpenAPI standards and Salesforce best practices

## Commands

- `SFDX: Create OpenAPI Document from This Class` - Generate an OpenAPI document from an Apex class
- `SFDX: Validate OpenAPI Document` - Validate an existing OpenAPI document

## Requirements

- Salesforce CLI extension
- Apex Language Server extension
- A Salesforce DX project with an authenticated org

### AuraEnabled Generation Requirements

For AuraEnabled classes (`@AuraEnabled` annotation):
- Requires only an authenticated org connection (no AI/LLM required)

## Configuration

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `salesforcedx-vscode-apex-oas.general.class.access-modifiers` | array | `["global", "public"]` | Class access modifiers eligible for OAS generation. |
| `salesforcedx-vscode-apex-oas.general.method.access-modifiers` | array | `["global", "public"]` | Method access modifiers eligible for OAS generation. |
| `salesforcedx-vscode-apex-oas.general.property.access-modifiers` | array | `["global", "public"]` | Property access modifiers eligible for OAS generation. |
| `salesforcedx-vscode-apex-oas.extensionLevelNotifications` | string | — | Controls notifications for all Apex OAS commands. Overrides the global `salesforcedx-vscode-services.notifications` setting. Individual commands can be further overridden in `salesforcedx-vscode-apex-oas.commandLevelNotifications`. |
| `salesforcedx-vscode-apex-oas.commandLevelNotifications` | object | — | Per-command notification settings (Create OpenAPI Document uses `progressToastSuccessToast`, `progressToastSuccessOff`, `progressStatusBarSuccessStatusBar`, or `progressStatusBarSuccessOff`; Validate OpenAPI Document uses `successToast` or `successStatusBar`). Overrides extension-level setting for specific commands. |

## Dependencies

This extension depends on:

- `salesforce.apex-language-server-extension`
- `salesforce.salesforcedx-vscode-services`

## Activation

This extension activates on demand when you run one of its commands. It does not activate automatically at workspace startup.

## Resources

- [Salesforce Extensions Documentation](https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide)
- [GitHub Repository](https://github.com/forcedotcom/salesforcedx-vscode)
