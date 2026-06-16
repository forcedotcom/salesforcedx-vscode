# Web/Node dual-target split at bundle time, not runtime

Extensions that target both desktop and web build two bundles with `ESBUILD_PLATFORM` defined as `'node'` or `'web'`, so the dead platform's code (e.g. `child_process`) is tree-shaken out — not branched at runtime. This keeps node-only APIs out of the web bundle entirely. See [Build.md](../Build.md) and `scripts/bundling/node.mjs`/`scripts/bundling/web.mjs`.
