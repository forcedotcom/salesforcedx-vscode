---
name: paths
description: Prefer vscode-uri over node:path. Use when .ts files in /src import from node:path or use path.join, path.basename, path.dirname, path.resolve.
---

# Paths

Scope: .ts files in /src

- Prefer vscode-uri URIs over paths (file, memfs; cross-platform; FsService/workspace.fs accept URIs)
- Use `Utils` from vscode-uri instead of node:path:
  - `Utils.joinPath(baseUri, 'a', 'b')` — path.join
  - `Utils.basename(uri)`, `Utils.dirname(uri)`, `Utils.extname(uri)` — path.\*
  - `Utils.resolvePath(baseUri, 'rel')` — path.resolve
- URI↔path via FsService: `toUri(filePath)` / `uriToPath(uri)` (Effect; extensions with salesforcedx-vscode-services)
- Raw path→URI: `URI.file(path)` or `toUri` for memfs in web
- FsService setup: [services-extension-consumption](../services-extension-consumption/SKILL.md)
- Exit hatch: build scripts, esbuild configs, tests, desktop-only extension, host-FS-only tooling → node:path ok
