# Code Builder container e2e — coverage ledger

Tracks whether each package ships a **Code Builder container** spec (browser-driven against real image, desktop build in Node host — see
[ADR 0022](adr/0022-code-builder-e2e-desktop-build-over-browser.md)) and rationale if not.

Container parity ≠ 1:1 desktop/web port. Per ADR 0022, container suite is a *curated* set: one representative, fixture-compatible scenario per package, running the **full** extension set. Desktop build is strictly *more* capable than Web (Apex/Aura LSP, `child_process`, `sf` CLI present) — several `isDesktop()`-gated web specs run fine here.

All specs drive the **one shared container** orchestrator spins up ([`scripts/codeBuilderLocalE2E.ts`](../scripts/codeBuilderLocalE2E.ts)): swaps in all built extensions, then runs each package's `test:container` suite. Each opens the single mounted fixture ([`container-workspace`](../packages/salesforcedx-vscode-core/test/playwright/fixtures/container-workspace)): one Apex class + test, authed to one tracking org at boot.

## Legend

- ✅ **Covered** — container spec ships.
- 🚫 **N/A** — no meaningful spec; capability is container-hostile (interactive debugger, native OS dialogs, external browser auth) or covered by another package.
- ⏭️ **Deferred** — viable but not yet justified (would need fixture growth or duplicates existing LSP path); tracked under W-23898528.

## Ledger

| Package | Status | Container spec | Signature capability / rationale |
| --- | --- | --- | --- |
| `salesforcedx-vscode-core` | ✅ | `configList`, `seededWorkspace`, `coreOutputChannel` | Output rendering, fixture startup, services-owned channel to legacy wrapper. |
| `salesforcedx-vscode-metadata` | ✅ | `deploySource.container` | Deploys the fixture class to the boot org (extension → `sf` → org). |
| `salesforcedx-vscode-apex-testing` | ✅ | `testExplorer.container` | Apex LSP discovers seeded `@isTest` into Test Controller (Web cannot run). |
| `salesforcedx-vscode-apex-log` | ✅ | `executeAnonymous.container` | Anonymous Apex execution; debug marker in Apex Log channel. |
| `salesforcedx-vscode-apex-oas` | ✅ | `ineligibleClass.container` | OpenAPI eligibility gate (pre-LLM, no A4V/rate-limit dependency). |
| `salesforcedx-vscode-soql` | ✅ | `soqlRunQuery.container` | SOQL query execution; results in SOQL channel. |
| `salesforcedx-vscode-lwc` | ✅ | `lwcGenerateComponent.container`, `lwcCustomComponentsIndex.container`, `lwcRename.container`, `lwcSnippets.container`, LSP specs (Autocompletion, GoToDefinitionHtml, GoToDefinitionJs, Hover, Indexing, SfdxTypings) | Component generation, custom index, rename, snippets + LWC LSP (go-to-def, autocomplete, hover, indexing, typings). |
| `salesforcedx-vscode-visualforce` | ✅ | `visualforceLsp.container`, `visualforceTemplates.container` | Visualforce LSP (apex tag autocomplete) + template generation (local, no org). |
| `salesforcedx-vscode-org-browser` | ✅ | `orgBrowser.container` | Live metadata describe renders in Org Browser tree. |
| `salesforcedx-vscode-services` | ✅ | `retrieveOnLoad.container` | Services Effect pipeline activates in Node; no-ops retrieve-on-load with no setting. |
| `salesforcedx-vscode-apex` | ✅ | `apexLsp.container`, LSP specs (Hover, Restart, Snippets) | Apex LSP (hover, completions, restart). |
| `salesforcedx-vscode-lightning` | ✅ | Aura LSP specs (Autocompletion, GoToDefinition, Rename, Templates) | Aura LSP (hover, go-to-def, autocomplete, rename, templates). |
| `salesforcedx-vscode-org` | 🚫 | — | Org commands use external browser auth (`Login Web`, `Open Org`); read-only surface covered by org-browser spec. |
| `salesforcedx-vscode-apex-replay-debugger` | 🚫 | — | Replay debug session (DAP + log scrubbing); container-hostile. |
| `salesforcedx-vscode-apex-debugger` | 🚫 | — | Interactive/ISV debugger protocol; container-hostile. |
| `playwright-vscode-ext` | 🚫 | — | Shared test library (not shipped); validated by jest unit tests + `.headless` specs. |

## Adding a container suite to a package

1. Add `test/playwright/playwright.config.container.ts` → `createContainerConfig({ testDir: './specs/container' })`.
2. Add `test/playwright/fixtures/containerFixtures.ts` → `export const containerTest = createContainerTest()`.
3. Write `test/playwright/specs/container/<name>.container.spec.ts` importing `containerTest`; use only plain-`Page` helpers from `@salesforce/playwright-vscode-ext` (no `_electron`, native dialogs, clipboard). One representative scenario against shared fixture + boot org.
4. Add `test:container` script + wireit block.
5. Orchestrator auto-discovers via `test:container` script scan — update ledger row above.
