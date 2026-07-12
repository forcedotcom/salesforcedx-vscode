# Effect ESM condition override scope

To shrink bundles, esbuild resolves `effect`'s ESM build via `conditions: ['import', 'module', 'default']` so unused submodules (e.g. fast-check via `Schema`) tree-shake out. This override lives in a shared **opt-in** constant `effectEsmConditions` (`scripts/bundling/effect.mjs`), consumed per-package — it is **not** baked into `nodeConfig`.

## Considered Options

- **Local copy per package** — rejected: 3+ near-identical override blocks drift independently.
- **Default in `nodeConfig`** — rejected: `conditions` changes module resolution for *every* dependency in a bundle, not just effect; baking it into the always-on default silently alters resolution for all 15 node consumers (several Playwright-/scratch-org-gated), any of which could ship a broken ESM entry — unvalidated blast radius.
- **Shared opt-in constant** — chosen: DRY with per-package opt-in, no unvalidated blast radius.

## Consequences

Node promotion criterion: fold `effectEsmConditions` into `nodeConfig` as an always-on default only after ≥3 packages opt in **and** a full `npm run vscode:bundle` across all node consumers is green with no resolution regressions.

Browser promotion criterion (distinct from node — do not reuse the node-scoped gate): the browser side had only **1** opt-in (`org-browser`'s browser build spreads `effectEsmConditions`); the other 5 effect-in-graph packages (apex-log, apex-testing, lwc, metadata, services, soql) condition only their node builds, so their browser bundles were never validated with the override. `conditions` alters module resolution for *every* dependency in each browser bundle, and browser bundles ship to web / Web Console — a hard-to-reverse blast radius. Browser resolution differs from node (`mainFields: ['browser', 'module', 'main']`, polyfill aliases), so node's green bundle does not vouch for it. Criterion: fold into `commonConfigBrowser` as an always-on default only after the per-package web e2e specs for each newly-conditioned browser build run green on branch:

- apex-log: `logRetrieval.headless.spec.ts`
- apex-testing: `runApexTestsCommandPalette.headless.spec.ts`
- lwc: `lwcGenerateComponent.headless.spec.ts`
- metadata: `deploySourcePath.headless.spec.ts`
- services: `retrieveOnLoadMetadata.headless.spec.ts`
- soql: `soql-run-query.spec.ts`

Trade-off: the per-package e2e gate costs validation time up front, but folding without it risks shipping a broken ESM resolution to web/Web Console where regressions are expensive to reverse — validation cost is preferred over shipping velocity for the browser fold.

`salesforcedx-vscode-visualforce`'s **extension** build (`dist/index.js`) consumes shared `effectEsmConditions` (effect in its graph). Its **language-server** build (`dist/visualforceServer.js`) keeps its own literal `conditions` + `mainFields` pair (no effect in graph; W-19480954 LS bundling, a distinct concern) — out of the shared-effect scope.
