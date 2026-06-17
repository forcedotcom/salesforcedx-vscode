# Package with `--allow-package-all-secrets`

We package extensions with `vsce package --allow-package-all-secrets`, disabling vsce's built-in secret scan, because it relies on `secretlint`, which doesn't support npm-workspace monorepos: on `3.6.0` it fails resolving `@secretlint/node` (esm/import/eval), and pinned back to `3.5.0` it emits false positives on minified code (e.g. `SG.promises.mkdir` flagged as a Sendgrid key). We already have enough secret scanners in place, so don't re-enable it.

## Considered Options

- **vsce's `secretlint` scan** — disabled: monorepo-incompatible (`@secretlint/node` resolution failure on 3.6.0) and false-positive-prone on minified bundles (3.5.0). References: [vscode-git-monolithic-extension PR #127](https://github.com/Silic0nS0ldier/vscode-git-monolithic-extension/pull/127/files), [vscode-vsce#1154](https://github.com/microsoft/vscode-vsce/issues/1154).
