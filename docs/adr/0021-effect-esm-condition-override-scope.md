# Effect ESM condition override scope

To shrink bundles, esbuild resolves `effect`'s ESM build via `conditions: ['import', 'module', 'default']` so unused submodules (e.g. fast-check via `Schema`) tree-shake out. This started as a shared **opt-in** constant `effectEsmConditions` (`scripts/bundling/effect.mjs`), consumed per-package. Both promotion criteria below are now met, so `conditions` is baked into `nodeConfig` (all node builds) and `commonConfigBrowser` (all browser builds); the opt-in constant and its file are removed.

## Considered Options

- **Local copy per package** — rejected: 3+ near-identical override blocks drift independently.
- **Default in `nodeConfig`** — rejected: `conditions` changes module resolution for *every* dependency in a bundle, not just effect; baking it into the always-on default silently alters resolution for all 15 node consumers (several Playwright-/scratch-org-gated), any of which could ship a broken ESM entry — unvalidated blast radius.
- **Shared opt-in constant** — chosen: DRY with per-package opt-in, no unvalidated blast radius.

## Consequences

Node promotion criterion (met — folded into `nodeConfig`): fold `effectEsmConditions` into `nodeConfig` as an always-on default only after ≥3 packages opt in **and** a full `npm run vscode:bundle` across all node consumers is green with no resolution regressions. Opt-ins were counted at package granularity on extension builds; several LS/debug-adapter node builds that never individually opted in (soql `server.js`, lwc LS node, lightning aura server, apex-replay-debugger's second build) are newly conditioned by the fold — validated by the full `vscode:bundle` green clause + desktop e2e, not by prior opt-in.

Browser promotion criterion (met — folded into `commonConfigBrowser`; distinct from node, do not reuse the node-scoped gate): the browser side had only **1** opt-in (`org-browser`'s browser build spreads `effectEsmConditions`); the other 5 effect-in-graph packages (apex-log, apex-testing, lwc, metadata, services, soql) condition only their node builds, so their browser bundles were never validated with the override. `conditions` alters module resolution for *every* dependency in each browser bundle, and browser bundles ship to web / Web Console — a hard-to-reverse blast radius. Browser resolution differs from node (`mainFields: ['browser', 'module', 'main']`, polyfill aliases), so node's green bundle does not vouch for it. Criterion: fold into `commonConfigBrowser` as an always-on default only after the per-package web e2e specs for each newly-conditioned browser build run green on branch:

- apex-log: `logRetrieval.headless.spec.ts`
- apex-testing: `runApexTestsCommandPalette.headless.spec.ts`
- lwc: `lwcGenerateComponent.headless.spec.ts`
- metadata: `deploySourcePath.headless.spec.ts`
- services: `retrieveOnLoadMetadata.headless.spec.ts`
- soql: `soql-run-query.spec.ts`

lwc and soql each emit two browser bundles — an extension build and an LS web-worker build (`lwcServer.js`, `serverWorker.js`) — both newly conditioned by the fold. The listed spec drives the worker via activation: lwc registers its generate command only after `client.start()` (worker load + LSP initialize), and soql starts its language client on `onLanguage:soql` before the Run Query code lens. The specs validate the worker loads and initializes without crashing; they don't exhaustively exercise every effect code path inside the worker (soql's worker graph contains no effect at all). Residual: a silent, non-crashing misresolution deep in a worker's effect paths could still slip the gate.

Trade-off: the per-package e2e gate costs validation time up front, but folding without it risks shipping a broken ESM resolution to web/Web Console where regressions are expensive to reverse — validation cost is preferred over shipping velocity for the browser fold.

`salesforcedx-vscode-visualforce`'s **extension** build (`dist/index.js`) has effect in its graph and inherits `conditions` from `nodeConfig`. Its **language-server** build (`dist/visualforceServer.js`, W-19480954 LS bundling) also inherits `conditions` from `nodeConfig` — its former literal `conditions` pair is redundant and removed; it keeps only its `mainFields` override.
