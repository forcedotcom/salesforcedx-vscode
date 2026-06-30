---
name: paths
description: Prefer vscode-uri over node:path. Use when .ts files in /src import node:path or use path.join/basename/dirname/resolve, URI.file, or memfs paths.
---

<!-- always-applicable: hardcoded in .claude/workflows/review-diff.js ALWAYS_APPLICABLE_SKILLS; injected on every review regardless of description match. Description triggers are load-bearing only if that hardcode is removed. -->

# Paths

Scope: .ts files in /src

- prefer vscode-uri URIs over paths (file, memfs; cross-platform; FsService/workspace.fs accept URIs)
- `Utils` from vscode-uri instead of node:path:
  - `Utils.joinPath(baseUri, 'a', 'b')` — path.join
  - `Utils.basename(uri)`, `Utils.dirname(uri)`, `Utils.extname(uri)` — path.\*
  - `Utils.resolvePath(baseUri, 'rel')` — path.resolve
- URI↔path via FsService: `toUri(filePath)` / `uriToPath(uri)` (Effect; extensions with salesforcedx-vscode-services)
- raw path→URI: `URI.file(path)`, or `toUri` for memfs in web
- FsService setup: [services-extension-consumption](../services-extension-consumption/SKILL.md)
- exit hatch: build scripts, esbuild configs, tests, desktop-only extension, host-FS-only tooling → node:path ok
