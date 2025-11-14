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

- Salesforce CLI Integration extension
- Apex extension
- Agentforce for Developers extension (for AI-powered generation)
- A Salesforce DX project with an authenticated org

## Configuration

This extension contributes the following settings:

- `salesforcedx-vscode-apex-oas.general.class.access-modifiers`: Class access modifiers eligible for OAS generation (default: `["global", "public"]`)
- `salesforcedx-vscode-apex-oas.general.method.access-modifiers`: Method access modifiers eligible for OAS generation (default: `["global", "public"]`)
- `salesforcedx-vscode-apex-oas.general.property.access-modifiers`: Property access modifiers eligible for OAS generation (default: `["global", "public"]`)
- `salesforcedx-vscode-apex-oas.generation_strategy`: Strategy for OAS generation (default: `"LEAST_CALLS"`)
- `salesforcedx-vscode-apex-oas.generation_include_schema`: Include OpenAPI schema in generation (default: `false`)
- `salesforcedx-vscode-apex-oas.generation_output_token_limit`: Maximum number of tokens for generation output (default: `750`)

## Dependencies

This extension depends on:

- `salesforce.salesforcedx-vscode-apex`
- `salesforce.salesforcedx-vscode-core`
- `salesforce.salesforcedx-einstein-gpt`

## Activation

This extension activates on demand when you run one of its commands. It does not activate automatically at workspace startup.

## Resources

- [Salesforce Extensions Documentation](https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide)
- [GitHub Repository](https://github.com/forcedotcom/salesforcedx-vscode)
