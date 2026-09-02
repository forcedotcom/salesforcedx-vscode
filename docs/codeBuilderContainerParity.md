# Code Builder container e2e — coverage ledger

Tracks, per package, whether the Playwright suite has a **Code Builder container** spec (driven by a
browser against the real image, running the desktop extension build in a Node host — see
[ADR 0022](adr/0022-code-builder-e2e-desktop-build-over-browser.md)) and, if not, why.

Container parity is **not** a 1:1 port of the desktop/web specs. Per ADR 0022 the container suite is
a *curated* set: one representative, fixture-compatible scenario per package that behaves under the
**full** installed extension set. The container runs the desktop build, so it is strictly *more*
capable than VS Code Web (the Apex/Aura language servers, `child_process`, and the `sf` CLI are all
present) — several scenarios that are `isDesktop()`-gated in the web suite (because Web lacks a
browser language-server bundle) run fine here.

All container specs drive the **one shared container** the orchestrator stands up
([`scripts/codeBuilderLocalE2E.ts`](../scripts/codeBuilderLocalE2E.ts)); it swaps every built
extension in, then runs each package's `test:container` suite against that live workbench. They open
the single mounted fixture project
([`container-workspace`](../packages/salesforcedx-vscode-core/test/playwright/fixtures/container-workspace)),
which holds one Apex class + its test and is authed to one tracking scratch org at boot.

## Legend

- ✅ **Covered** — a container spec ships for this package.
- 🚫 **N/A** — no meaningful container spec; the capability is container-hostile (interactive
  debugger, native OS dialogs, external browser auth) or fully covered by another package's spec.
- ⏭️ **Deferred** — viable in the container, but not yet worth a dedicated spec (would need fixture
  growth or duplicates a language-server path already exercised); tracked as a follow-up under
  W-23898528.

## Ledger

| Package | Status | Container spec | Signature capability / rationale |
| --- | --- | --- | --- |
| `salesforcedx-vscode-core` | ✅ | `configList`, `seededWorkspace` | Config-list output rendering + the mounted fixture opens (story 6). |
| `salesforcedx-vscode-metadata` | ✅ | `deploySource.container` | Deploys the fixture class to the boot org (extension → `sf` → org). |
| `salesforcedx-vscode-apex-testing` | ✅ | `testExplorer.container` | Apex LSP discovers the seeded `@isTest` class into the Test Controller — a path Web cannot run. |
| `salesforcedx-vscode-apex-log` | ✅ | `executeAnonymous.container` | Runs anonymous Apex against the org; debug marker returns in the Apex Log channel. |
| `salesforcedx-vscode-apex-oas` | ✅ | `ineligibleClass.container` | OpenAPI eligibility gate rejects an ineligible class (pre-LLM, so no A4V/rate-limit dependency). |
| `salesforcedx-vscode-soql` | ✅ | `soqlRunQuery.container` | Executes a SOQL query against the boot org; results land in the SOQL channel. |
| `salesforcedx-vscode-lwc` | ✅ | `lwcGenerateComponent.container` | Scaffolds an LWC via the command palette (local generation, no org). |
| `salesforcedx-vscode-visualforce` | ✅ | `visualforceLsp.container` | Visualforce language server autocompletes apex tags in a `.page` (no org). |
| `salesforcedx-vscode-org-browser` | ✅ | `orgBrowser.container` | Live metadata-type describe against the boot org renders in the Org Browser tree. |
| `salesforcedx-vscode-services` | ✅ | `retrieveOnLoad.container` | Services Effect pipeline activates in the Node host and correctly no-ops retrieve-on-load with no setting. |
| `salesforcedx-vscode-apex` | ⏭️ | — | Apex LSP hover/restart/snippets are `.desktop` specs. The LSP itself is proven live in the container by the apex-testing (discovery) and apex-oas (eligibility) specs, which depend on it; a dedicated LSP spec adds little container-unique signal. |
| `salesforcedx-vscode-lightning` | ⏭️ | — | Aura LSP is viable in the container (desktop build) but needs an Aura bundle added to the fixture; deferred until a spec needs it. |
| `salesforcedx-vscode-org` | 🚫 | — | Org commands center on external browser auth (`Login Web`, `Open Org`) and native flows; the read-only describe/list surface is covered by the org-browser spec. |
| `salesforcedx-vscode-apex-replay-debugger` | 🚫 | — | Requires a replay debug session (DAP launch + log scrubbing); container-hostile. |
| `salesforcedx-vscode-apex-debugger` | 🚫 | — | Interactive/ISV debugger protocol; container-hostile. |
| `playwright-vscode-ext` | 🚫 | — | The shared test library itself, not a shipped extension — validated by its jest unit tests and its own `.headless` specs. |

## Adding a container suite to a package

1. Add `test/playwright/playwright.config.container.ts` → `createContainerConfig({ testDir: './specs/container' })`.
2. Add `test/playwright/fixtures/containerFixtures.ts` → `export const containerTest = createContainerTest()`.
3. Write `test/playwright/specs/container/<name>.container.spec.ts` importing `containerTest` and only
   plain-`Page` helpers from `@salesforce/playwright-vscode-ext` (no `_electron`, native dialogs, or
   clipboard). Keep it to one representative scenario that works against the shared fixture + boot org.
4. Add a `test:container` script + wireit block mirroring the other packages.
5. The orchestrator discovers the new suite automatically (it scans for the `test:container` script) —
   no edit needed there. Update the row above.
