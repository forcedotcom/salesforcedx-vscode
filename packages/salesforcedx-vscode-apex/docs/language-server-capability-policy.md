# Jorje Language Server Capability Policy

This document is internal maintainer guidance for the Jorje-backed Apex extension.

## Source Of Truth

The client catalog is `src/languageServerCapabilities.ts`. Verify all changes against the Apex Jorje LSP server:

- Initialization capability advertisement defines standard LSP providers.
- `@JsonDelegate` services define non-standard requests and notifications.
- Existing VS Code call sites are not a complete inventory: the server can support an endpoint that this extension does not yet call.

Jorje requires a JVM and is never-web. Do not add web-platform branching to this policy.

## Inventory

| Kind | Jorje capability | Default | Configuration |
| --- | --- | --- | --- |
| LSP provider | `provideCodeActions` | enabled | hidden setting |
| LSP provider | `provideCodeLenses` | enabled | hidden setting |
| LSP provider | `provideCompletions` | enabled | hidden setting |
| LSP provider | `provideDefinition` | enabled | hidden setting |
| LSP provider | `provideDocumentSymbols` | disabled | hidden setting; legacy parity fallback |
| LSP provider | `provideHover` | enabled | hidden setting |
| LSP provider | `provideReferences` | enabled | hidden setting |
| LSP provider | `provideRenameEdits` | enabled | hidden setting |
| Custom request | `apexoas/gatherContext` | enabled | hidden setting |
| Custom request | `apexoas/isEligible` | enabled | hidden setting |
| Custom request | `debugger/exceptionBreakpoints` | enabled | hidden setting |
| Custom request | `debugger/lineBreakpoints` | enabled | hidden setting |
| Custom request | `test/getTestMethods` | enabled | hidden setting |
| Internal notification | `indexer/done` | enabled | never configurable |

`indexer/done` is a server-completion signal consumed only by the client. It remains inventory-only and must always be handled when `wait-init-jobs` is disabled.

## Hidden Settings

The settings are intentionally omitted from `package.json` contributes.configuration and therefore do not appear in the VS Code Settings UI. Set them directly in `settings.json` under `salesforcedx-vscode-apex.advanced.capabilities`.

```json
{
  "salesforcedx-vscode-apex.advanced.capabilities.disableHover": true,
  "salesforcedx-vscode-apex.advanced.capabilities.disableApexoasGatherContext": true
}
```

An absent setting preserves the production baseline. A setting set to `true` disables the named capability. Changes under `advanced.capabilities` automatically invoke the existing `sf.apex.languageServer.restart` command so the client starts with a refreshed policy snapshot.

### Setting Names

LSP providers:

- `disableCodeActions`
- `disableCodeLenses`
- `disableCompletions`
- `disableDefinition`
- `disableDocumentSymbols`
- `disableHover`
- `disableReferences`
- `disableRenameEdits`

Custom requests:

- `disableApexoasGatherContext`
- `disableApexoasIsEligible`
- `disableDebuggerExceptionBreakpoints`
- `disableDebuggerLineBreakpoints`
- `disableTestGetTestMethods`

`advanced.lspParityCapabilities` remains the compatibility fallback for document symbols only. An explicit hidden `provideDocumentSymbols` value takes precedence.

## Enforcement

- Standard LSP providers are disabled with `LanguageClient` middleware. The policy snapshot is captured when a client starts, so restart the language server after changing one.
- Custom requests must be gated at `LanguageClientManager` or exported Apex API boundaries. Disabled paths must not call `sendRequest` and must return the existing consumer's supported empty value or `undefined`.
- Do not send client policy settings in `initializationOptions`.
- Keep `indexer/done` handling unconditional; it is not an opt-out capability.

## Testing

- Update `test/unit/languageServerCapabilities.test.ts` for catalog baseline and resolver matrix changes.
- Update request-owner tests to prove enabled dispatch and disabled non-dispatch.
- Cover observable provider lifecycle behavior in desktop E2E only when it adds value. Unit tests, not UI inference, validate outbound request suppression.
- Desktop fixtures must pin released settings and must not depend on developer profile defaults.
