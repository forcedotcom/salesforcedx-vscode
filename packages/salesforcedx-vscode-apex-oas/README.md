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

This extension contributes the following settings:

- `salesforcedx-vscode-apex-oas.general.class.access-modifiers`: Class access modifiers eligible for OAS generation (default: `["global", "public"]`)
- `salesforcedx-vscode-apex-oas.general.method.access-modifiers`: Method access modifiers eligible for OAS generation (default: `["global", "public"]`)
- `salesforcedx-vscode-apex-oas.general.property.access-modifiers`: Property access modifiers eligible for OAS generation (default: `["global", "public"]`)
- `salesforcedx-vscode-apex-oas.generation_strategy`: Strategy for OAS generation (default: `"LEAST_CALLS"`)
- `salesforcedx-vscode-apex-oas.generation_include_schema`: Include OpenAPI schema in generation (default: `false`)
- `salesforcedx-vscode-apex-oas.generation_output_token_limit`: Maximum number of tokens for generation output (default: `750`)
- `salesforcedx-vscode-apex-oas.enableRestOASGen`: Enable OpenAPI document generation for Apex REST (`@RestResource`) classes (default: `false`). Disabled by default because it depends on an external AI model service; AuraEnabled classes are unaffected.

## Dependencies

This extension depends on:

- `salesforce.salesforcedx-vscode-apex`
- `salesforce.salesforcedx-vscode-core`

REST class generation additionally needs an LLM (AI model) service registered with the VS Code service provider — obtained at runtime through the service provider rather than declared as a hard extension dependency, and is not required for AuraEnabled class generation.

## Activation

This extension activates on demand when you run one of its commands. It does not activate automatically at workspace startup.

## Resources

- [Salesforce Extensions Documentation](https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide)
- [GitHub Repository](https://github.com/forcedotcom/salesforcedx-vscode)
