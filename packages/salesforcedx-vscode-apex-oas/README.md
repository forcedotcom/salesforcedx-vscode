# Apex OpenAPI Specification Extension

This extension provides OpenAPI Specification (OAS) generation capabilities for Apex REST and AuraEnabled classes in Salesforce development.

## Features

- **Generate OpenAPI Documents**: Create OpenAPI v3 specifications from Apex classes annotated with `@RestResource` or `@AuraEnabled`
- **Validate OpenAPI Documents**: Validate existing OpenAPI documents against Salesforce-specific rules
- **Spectral Validation**: Uses Spectral to ensure compliance with OpenAPI standards and Salesforce best practices

## Commands

- `SFDX: Create OpenAPI Document from This Class` - Generate an OpenAPI document from an Apex class
- `SFDX: Validate OpenAPI Document` - Validate an existing OpenAPI document

## Requirements

- Salesforce CLI extension
- Apex extension
- A Salesforce DX project with an authenticated org

### REST Generation Requirements

For REST classes (`@RestResource` with `@HttpGet`, `@HttpPost`, etc.):
- An LLM (AI model) service must be available through the VS Code service provider. This is supplied by an extension that provides this service; if no provider has registered the service, REST generation fails with a clear error.

### AuraEnabled Generation Requirements

For AuraEnabled classes (`@AuraEnabled` annotation):
- Requires only an authenticated org connection (no AI/LLM required)

## Configuration

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `salesforcedx-vscode-apex-oas.general.class.access-modifiers` | array | `["global", "public"]` | Class access modifiers eligible for OAS generation. |
| `salesforcedx-vscode-apex-oas.general.method.access-modifiers` | array | `["global", "public"]` | Method access modifiers eligible for OAS generation. |
| `salesforcedx-vscode-apex-oas.general.property.access-modifiers` | array | `["global", "public"]` | Property access modifiers eligible for OAS generation. |
| `salesforcedx-vscode-apex-oas.generation_strategy` | string | `"LEAST_CALLS"` | Strategy for OAS generation. Options: `"LEAST_CALLS"`, `"MOST_CALLS"`. |
| `salesforcedx-vscode-apex-oas.generation_include_schema` | boolean | `false` | Include OpenAPI schema in generation. |
| `salesforcedx-vscode-apex-oas.generation_output_token_limit` | number | `750` | Maximum number of tokens for generation output. |
| `salesforcedx-vscode-apex-oas.enableRestOASGen` | boolean | `false` | Enable OpenAPI document generation for Apex REST (`@RestResource`) classes. Disabled by default because it depends on an external AI model service; AuraEnabled classes are unaffected. |
| `salesforcedx-vscode-apex-oas.extensionLevelNotifications` | string | — | Controls notifications for all Apex OAS commands. Overrides the global `salesforcedx-vscode-services.notifications` setting. Individual commands can be further overridden in `salesforcedx-vscode-apex-oas.commandLevelNotifications`. |
| `salesforcedx-vscode-apex-oas.commandLevelNotifications` | object | — | Per-command notification settings (Create OpenAPI Document uses `progressToastSuccessToast`, `progressToastSuccessOff`, `progressStatusBarSuccessStatusBar`, or `progressStatusBarSuccessOff`; Validate OpenAPI Document uses `successToast` or `successStatusBar`). Overrides extension-level setting for specific commands. |

## Dependencies

This extension depends on:

- `salesforce.salesforcedx-vscode-apex`
- `salesforce.salesforcedx-vscode-core`

REST class generation additionally needs an LLM (AI model) service registered with the VS Code service provider — obtained at runtime through the service provider rather than declared as a hard extension dependency, and is not required for AuraEnabled class generation.

**Note:** As of A4V v4.1.0 "Agentforce Vibes" (2026-06-13), the LLM integration required for OAS generation is temporarily unavailable. v4 removed the `salesforcedx-einstein-gpt.isEnabled` context key that gates the OAS commands' visibility (so they no longer appear) and the `getLLMServiceInstance` command that generation invokes. E2E tests are skipped pending migration off the A4V LLM service.

## Activation

This extension activates on demand when you run one of its commands. It does not activate automatically at workspace startup.

## Resources

- [Salesforce Extensions Documentation](https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide)
- [GitHub Repository](https://github.com/forcedotcom/salesforcedx-vscode)
