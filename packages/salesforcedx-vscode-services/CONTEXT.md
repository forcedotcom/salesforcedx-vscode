# salesforcedx-vscode-services Context

## Glossary

### HashableUri

- structural wrapper around `vscode-uri` `URI` adding Effect `Hash`/`Equal` symbols
- shape: `{ readonly uri: URI; [Hash.symbol](); [Equal.symbol](that) }`
- Equal/Hash are structural — compare/hash `uri.toString()` so cross-bundle works (cross-bundle: each ext bundles own copy; `instanceof` fails)
- structural Equal also requires `Equal.symbol` on the candidate — rejects plain `{uri}` literals so the Equal contract stays symmetric with `Hash`
- access underlying URI via `.uri` (no `.path`/`.scheme`/`.toUri()` etc. on wrapper)
- construct via `HashableUri.fromUri(uri)`; `HashableUri.with(self, change)` (or curried `HashableUri.with(change)(self)`) returns new wrapper
- Windows drive letters lowercased on `fromUri` only when `scheme === 'file'`; non-file URIs are not normalized
- consumers: import value+type from `salesforcedx-vscode-services` (root)
- `Utils.*` (vscode-uri) and `uriToPath` need plain `URI` — pass `hashable.uri`, not `hashable`
- vscode RPC (e.g. `vscode.diff`, `showTextDocument`) — pass `hashable.uri`, not `hashable`
