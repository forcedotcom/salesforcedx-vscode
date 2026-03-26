---
name: paths
description: Prefer vscode-uri over node:path and vscode.Uri. Use when .ts files in /src import from node:path, use path.join/basename/dirname/resolve, or type params as vscode.Uri unnecessarily.
---

# Paths

Scope: .ts files in /src

## node:path → vscode-uri Utils

- Prefer vscode-uri URIs over paths (file, memfs; cross-platform; FsService/workspace.fs accept URIs)
- Use `Utils` from vscode-uri instead of node:path:
  - `Utils.joinPath(baseUri, 'a', 'b')` — path.join
  - `Utils.basename(uri)`, `Utils.dirname(uri)`, `Utils.extname(uri)` — path.\*
  - `Utils.resolvePath(baseUri, 'rel')` — path.resolve
- URI↔path via FsService: `toUri(filePath)` / `uriToPath(uri)` (Effect; extensions with salesforcedx-vscode-services)
- Raw path→URI: `URI.file(path)` or `toUri` for memfs in web
- FsService setup: [services-extension-consumption](../services-extension-consumption/SKILL.md)
- Exit hatch: build scripts, esbuild configs, tests, desktop-only extension, host-FS-only tooling → node:path ok

## vscode.Uri vs vscode-uri URI

- `vscode.Uri` — VS Code API type; use **only** at the VS Code boundary (values that come from or go to VS Code APIs, e.g. `extensionContext.extensionUri`, `workspace.workspaceFolders[n].uri`)
- `vscode-uri.URI` — prefer for all internal URI construction and manipulation; works without a VS Code mock in tests
- When a function receives a `vscode.Uri` from VS Code API, convert immediately: `const base = URI.from(vsCodeUri)`, then work with `URI` internally
- Never widen a function's parameter to `vscode.Uri` just to avoid the `URI.from()` call at the boundary
