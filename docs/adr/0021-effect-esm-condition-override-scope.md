# Effect ESM condition override scope

To shrink bundles, esbuild resolves `effect`'s ESM build via `conditions: ['import', 'module', 'default']` so unused submodules (e.g. fast-check via `Schema`) tree-shake out. This override lives in a shared **opt-in** constant `effectEsmConditions` (`scripts/bundling/effect.mjs`), consumed per-package — it is **not** baked into `nodeConfig`.

## Considered Options

- **Local copy per package** — rejected: 3+ near-identical override blocks drift independently.
- **Default in `nodeConfig`** — rejected: `conditions` changes module resolution for *every* dependency in a bundle, not just effect; baking it into the always-on default silently alters resolution for all 15 node consumers (several Playwright-/scratch-org-gated), any of which could ship a broken ESM entry — unvalidated blast radius.
- **Shared opt-in constant** — chosen: DRY with per-package opt-in, no unvalidated blast radius.

## Consequences

Promotion criterion: fold `effectEsmConditions` into `nodeConfig` as an always-on default only after ≥3 packages opt in **and** a full `npm run vscode:bundle` across all node consumers is green with no resolution regressions.

`salesforcedx-vscode-visualforce` keeps its own pre-existing `conditions` + `mainFields` pair (language-server bundling, a distinct concern) — out of scope, not migrated.
