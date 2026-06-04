# salesforcedx-vscode-services Context

## Glossary

### HashableUri

- structural wrapper around `vscode-uri` `URI` adding Effect `Hash`/`Equal` symbols
- shape: `{ readonly uri: URI; [Hash.symbol](); [Equal.symbol](that) }`
- Equal/Hash are structural — compare/hash `uri.toString()` so cross-bundle works (each extension bundles its own `vscode-uri`; `instanceof URI` would fail)
- access underlying URI via `.uri` (no `.path`/`.scheme`/`.toUri()` etc. on the wrapper)
- construct via `HashableUri.fromUri(uri)`; `HashableUri.with(self, change)` (or curried `HashableUri.with(change)(self)`) returns a new wrapper
- Windows drive letters lowercased on `fromUri` so HashSet dedupe works regardless of casing source
- consumers: import value+type from `salesforcedx-vscode-services` (root); enforced by ESLint `local/no-direct-hashableuri-imports`
- `Utils.*` (vscode-uri) and `uriToPath` need plain `URI` — pass `hashable.uri`, not `hashable`
- vscode RPC (e.g. `vscode.diff`, `showTextDocument`) — pass `hashable.uri`, not `hashable`
