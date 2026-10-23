# Jorje Language Server Capability Policy

This document is internal maintainer guidance for the Jorje-backed Apex extension.

## Source Of Truth

The client catalog is `src/languageServerCapabilities.ts`. Verify all changes against the Apex Jorje LSP server:

- Initialization capability advertisement defines standard LSP providers.
- `@JsonDelegate` services define non-standard requests and notifications.
- Existing VS Code call sites are not a complete inventory: the server can support an endpoint that this extension does not yet call.

Jorje requires a JVM and is never-web. Do not add web-platform branching to this policy.

## Configurable Inventory

| Kind | Jorje capability | Default | Configuration |
| --- | --- | --- | --- |
| LSP provider | `provideCodeActions` | enabled | public setting |
| LSP provider | `provideCodeLenses` | enabled | public setting |
| LSP provider | `provideCompletions` | enabled | public setting |
| LSP provider | `provideDefinition` | enabled | public setting |
| LSP provider | `provideDocumentSymbols` | disabled | public setting |
| LSP provider | `provideHover` | enabled | public setting |
| LSP provider | `provideReferences` | enabled | public setting |
| LSP provider | `provideRenameEdits` | enabled | public setting |

`indexer/done` is a server-completion signal consumed only by the client, not a capability-policy item. The existing handler must remain registered when `wait-init-jobs` is disabled.

## Settings

Each setting is contributed through `package.json`, appears in the VS Code Settings UI, and accepts exactly `enabled` or `disabled`.

```json
{
  "salesforcedx-vscode-apex.advanced.capabilities.hover": "disabled"
}
```

The `package.json` default is the shipped policy. `enabled` and `disabled` explicitly control the capability without truthiness or absent-setting semantics. Changes under `advanced.capabilities` automatically invoke the existing `sf.apex.languageServer.restart` command so the client starts with a refreshed policy snapshot.

### Setting Names

LSP providers:

- `codeActions`
- `codeLenses`
- `completions`
- `definition`
- `documentSymbols`
- `hover`
- `references`
- `renameEdits`

The document-symbol setting replaces the legacy parity setting. The `disabled` default preserves the shipped behavior. Custom Jorje requests are protocol implementation details and are always available to their extension consumers; they are not customer-configurable capabilities.

## Enforcement

- Standard LSP providers are disabled with `LanguageClient` middleware. The policy snapshot is captured when a client starts, so restart the language server after changing one.
- Custom requests are dispatched through `LanguageClientManager` or exported Apex API boundaries and are not subject to capability settings.
- Do not send client policy settings in `initializationOptions`.
- `indexer/done` remains outside this policy and is handled unconditionally by `LanguageClientManager` when `wait-init-jobs` is disabled.

## Testing

- Update `test/unit/languageServerCapabilities.test.ts` for catalog baseline and resolver matrix changes.
- Cover request-owner behavior in the extension that consumes the custom endpoint.
- Cover observable provider lifecycle behavior in desktop E2E only when it adds value. Unit tests, not UI inference, validate outbound request suppression.
- Desktop fixtures must pin released settings and must not depend on developer profile defaults.
