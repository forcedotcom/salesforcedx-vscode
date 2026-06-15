# Package with `vsce package` directly, not the bundled-extension script

Newer extensions package with `vsce package` directly and `.vscodeignore` what shouldn't ship, so they build in parallel. The legacy `vsce-bundled-extension` script mutated `package.json` at build time, built in temp dirs, ran `npm install --production` (forcing a second install to restore devDependencies), and changed `cwd` so it had to run one package at a time — avoid it; migrate legacy packages off it.

## Considered Options

- **`vsce-bundled-extension` script** — rejected for new packages: in-place pjson mutation, temp-dir builds, production reinstall, and serial-only execution. See [simplify-packaging-org-ext.md](../../.cursor/plans/simplify-packaging-org-ext.md) for migration details.
