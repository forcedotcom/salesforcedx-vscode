# Web/Node dual-target split at bundle time, not runtime

Extensions that target both desktop and web build two bundles with `ESBUILD_PLATFORM` defined as `'node'` or `'web'`, so the dead platform's *call* is folded — not branched at runtime. tsc emits a top-level CJS `require` for each static import; that `require` survives the define (`spans.ts` → `spansNode`). Node-only modules: `import()` in the node branch (`servicesLayers.ts` → `crossSpawnCommandExecutor`). See [Build.md](../Build.md) and `scripts/bundling/node.mjs`/`scripts/bundling/web.mjs`.
