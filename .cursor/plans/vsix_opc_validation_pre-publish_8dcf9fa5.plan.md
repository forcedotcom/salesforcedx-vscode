---
name: VSIX OPC validation pre-publish
overview: Add a VSIX validation step that checks for invalid OPC Part URIs (e.g., trailing spaces in filenames) before publish. vsce has no dry-run; the marketplace validates on upload and rejects invalid packages. A custom script can catch these at build time.
todos: []
isProject: false
---

# VSIX OPC Validation Before Publish

## Context

- **vsce has no dry-run** — `vsce publish` does not support `--dry-run` or any pre-upload validation mode. The marketplace server validates OPC when it receives the upload.
- **Error source** — [vscode-vsce#315](https://github.com/microsoft/vscode-vsce/issues/315): OPC Part URI errors (trailing spaces, spaces in paths) are rejected by the .NET `System.IO.Packaging` library on the marketplace server. The issue was closed as out-of-scope; no client-side validator was added to vsce.
- **Current flow** — [buildAll.yml](.github/workflows/buildAll.yml) runs `vscode:package` → uploads artifacts → [tagAndRelease](.github/workflows/tagAndRelease.yml) creates release → [publishVSCode.yml](.github/workflows/publishVSCode.yml) downloads and runs `vsce publish` per VSIX.

## Approach

Add a validation script that inspects each VSIX (ZIP) and checks entry paths against OPC Part URI rules. Run it **after packaging, before upload** in buildAll so bad VSIX never reach the release.

### OPC Part URI rules (from ECMA-376 / [vscode-vsce#315](https://github.com/microsoft/vscode-vsce/issues/315))

- No leading/trailing whitespace in paths
- No spaces in path segments (spaces violate RFC 3986 for Part URIs)
- Paths map to Part URIs (e.g. `extension/foo/bar` → `/extension/foo/bar`)

### Implementation

1. **Create `scripts/validate-vsix-opc.mjs`** (or `.ts` if preferred)

- Accept glob or dir of `.vsix` files
- Use `JSZip` (already in lockfile via vscode-extension-tester) or add `yauzl` as devDep
- For each VSIX: open as ZIP, iterate entry names
- For each entry path:
  - Fail if `path !== path.trim()` (leading/trailing space)
  - Fail if `path.includes(' ')` (space in path)
- Exit 1 on first invalid path; log which VSIX and which path
- Exit 0 if all valid

1. **Wire into buildAll** — Add step after `vscode:package`, before "Stage Artifacts":

```yaml
- name: Validate VSIX OPC Part URIs
  run: node scripts/validate-vsix-opc.mjs ./packages
```

1. **Optional: publishVSCode defense-in-depth** — Run the same validation before the publish loop so we fail fast before hitting the marketplace (instead of failing on the Nth extension). Useful because publish downloads from release and re-validates the same files.

### Dependency

- `JSZip` is transitive (vscode-extension-tester). Add `jszip` as a direct devDep for the script to avoid relying on hoisting, or use `unzip -l` + parse (no new deps, but parsing is brittle). **Recommendation**: add `jszip` as devDep for a clean, reliable implementation.

### Verification

- Run `npm run vscode:package` locally, then `node scripts/validate-vsix-opc.mjs ./packages` — should pass
- To test failure: temporarily add a file with trailing space to an extension's bundled output, repackage, run validator — should fail with clear message
