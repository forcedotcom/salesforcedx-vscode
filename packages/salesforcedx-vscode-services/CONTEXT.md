# salesforcedx-vscode-services Context

## Glossary

### Web Console

- browser build of (some) extensions running in VS Code for the Web (vscode.dev / github.dev style); no local CLI or filesystem
- Salesforce libraries run in-process (`@salesforce/core`, SDR, source-tracking); files via memfs + IndexedDB through `vscode.workspace.fs`; auth injected via settings
- invariant: **always single-org** — only the org it started in, no cross-org switch (why the org extension is excluded)
- _Avoid_: "web extension" (ambiguous), "vscode.dev mode", "browser mode"

### Effect boundary

- the exported `async` function that calls `getRuntime().runPromise(effectFn())` and owns all user-facing error display for that command
- every VS Code command that uses Effect has exactly one; errors that escape the Effect channel surface here as Promise rejections and are caught with `.catch()`
- error display belongs here, not inside the Effect pipeline — the pipeline should let failures propagate through the channel
- contrast: an **imperative core** is an `async` function that sits inside the boundary but hasn't been fully Effect-ified — it handles some errors internally via try/catch, leaving others to escape unhandled; this is a partially migrated state, not the target pattern

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
