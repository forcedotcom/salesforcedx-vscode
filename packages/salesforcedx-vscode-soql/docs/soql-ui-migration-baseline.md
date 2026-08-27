# SOQL UI Migration Baseline and Gates

This document is the parity contract for migrating the SOQL Builder and query-results webviews to Lit. It records the legacy behavior at `develop` commit `2326d1eff` on 2026-08-19. A Lit slice is mergeable while the legacy entry remains the default only when the checks relevant to that slice pass.

## Repeatable commands

Run package commands from the repository root:

```bash
npm run compile --workspace salesforcedx-vscode-soql
npm test --workspace salesforcedx-vscode-soql
npm run test:soql-builder-ui --workspace salesforcedx-vscode-soql -- --runInBand
npm run test:query-results-ui --workspace salesforcedx-vscode-soql
npm run test:ui-bundle-budgets --workspace salesforcedx-vscode-soql
npm run test:web --workspace salesforcedx-vscode-soql
npm run test:desktop --workspace salesforcedx-vscode-soql
```

The last two commands require the repository's normal authenticated E2E environment. Both targets are release gates. A feature PR may run the focused spec that owns its behavior, but it must not disable the full desktop or web gate.

## Behavior evidence

| Area | Legacy behavior that must remain | Automated evidence | Remaining environment evidence |
| --- | --- | --- | --- |
| Builder lifecycle | Initial activation, saved-state restoration, external document updates, and builder/text round trips | `vscodeMessageService.test.ts`, `toolingModelService.test.ts`, `soql-builder.spec.ts` | Desktop and web runs |
| From and Fields | Object search, field search, selection/removal, `COUNT()`, Select All, and Clear All | `from.test.ts`, `fields.test.ts`, `customSelect.test.ts`, `soql-builder.spec.ts` | Large metadata fixture timing |
| Clauses | Where values/operators/AND/OR, Order By, Limit, and All Rows | `where*.test.ts`, `orderBy.test.ts`, `limit.test.ts`, `soqlUtils.test.ts`, `soql-builder.spec.ts`, `soql-run-query.spec.ts` | Keyboard-only E2E pass |
| Feedback and actions | Preview, missing org, recoverable/unsupported/syntax errors, dismissal, Run Query, and Query Plan | `app.test.ts`, `queryPreview.test.ts`, `soqlEditorProvider.test.ts`, `soql-builder.spec.ts`, `soql-query-plan.spec.ts` | Accessibility scan and theme captures |
| Results lifecycle | `activate`, `update`, state restore, title, returned/total count, max-row hint, empty data, and resize | `queryDataViewController.test.ts` | Restore after a real tab teardown on desktop and web |
| Results grid | Flattened keys, relationship groups, legacy rows, 50-row pagination, sorting, resize, scrolling, and narrow layouts | `queryDataViewController.test.ts`, `dataQuery.test.ts` | Tabulator interaction matrix below |
| Exports | CSV/JSON actions, data conversion, desktop save dialog, and web workspace save | `queryDataViewController.test.ts`, `csvDataProvider.test.ts`, `queryDataFileService.test.ts`, `soql-save-query-results.spec.ts` | Desktop and web runs |

The focused controller test is intentionally a contract test around the plain JavaScript query-results entry. It does not expose controller internals and can be run against every compatibility edit until the Lit entry replaces it.

### Result data matrix

Use deterministic fixtures with the following shapes when collecting browser measurements. `salesforcedx-vscode-soql.maxQueryLimit` supplies the maximum-result case.

| Fixture | Required assertion |
| --- | --- |
| Empty | Title and `Returned 0 of 0 total records`; no crash or stale rows |
| Small | 10 flat records; no unused gray table area |
| Page boundary | 50 records stays on one page; 51 records exposes a second local page |
| Wide | 40 scalar fields; horizontal scroll preserves header/body alignment |
| Related | At least three relationship depths and a null relationship; grouped headers and literal dotted-key values remain correct |
| Maximum | Maximum configured returned records with a greater server total; max-row guidance is visible |

For each non-empty fixture, exercise ascending/descending header sort, column resize, horizontal and vertical scrolling, and a 480 px-wide editor group.

## Existing legacy defects

The baseline run originally reported 3 failed suites (2 failed tests, 139 passed) plus an LWC version warning. This story repairs the stale assertions and mock shape without changing runtime behavior:

- `header/header.test.ts` now makes the query valid before clicking the intentionally disabled Run Query button.
- `whereModifierGroup/whereModifierGroup.test.ts` now mocks the package's default export, matching the production import.
- `services/soqlUtils.test.ts` now includes the `@salesforce/soql-model` condition discriminators and uses structural equality.

The resulting legacy baseline is 18 suites passed, 167 tests passed, and 1 test skipped. The suite still logs: `current engine is v8.26.2, but template was compiled with v9.3.4`. `@lwc/jest-preset@19.6.1` owns engine 8.26.2 while its compiler and this package's Rollup plugin use 9.3.4. The quarantine owner is the SOQL Lit migration assignee (Peter Hale), with removal due in the final LWC-removal story. The warning is not suppressed and any test failure remains fatal.

Reproduce with:

```bash
npm ls @lwc/engine-dom @lwc/compiler @lwc/jest-preset --workspace salesforcedx-vscode-soql
npm run test:soql-builder-ui --workspace salesforcedx-vscode-soql -- --runInBand
```

## Bundle baseline and budgets

`test:ui-bundle-budgets` builds the legacy builder, concatenates each configured artifact in a stable order, and applies Node zlib gzip level 9. The source of truth is `test/baselines/soql-ui-bundles.json`.

| Artifact | Baseline raw | Baseline gzip | Maximum raw | Maximum gzip |
| --- | ---: | ---: | ---: | ---: |
| Legacy builder application | 933,725 B | 246,879 B | 981,000 B | 260,000 B |
| Query-results first-party shell | 14,293 B | 4,856 B | 16,000 B | 5,500 B |
| Retained Tabulator vendor assets | 377,590 B | 80,815 B | 378,000 B | 81,000 B |

Tabulator is measured separately because it is retained. A Lit results PR must not present the vendor bytes as framework growth. Migration builds report legacy and Lit entry sizes independently; production VSIX builds must continue excluding inactive migration entries until final cutover.

PR #8026 advances the legacy-builder baseline from 880,931 raw / 231,443 gzip bytes to 933,725 raw /
246,879 gzip bytes because message-boundary validation now consumes the complete shared Salesforce object schema. The
new maximums retain approximately five percent headroom rather than treating that intentional schema coverage as an
unbounded allowance for future growth.

## Performance and lifecycle gates

Collect five warm runs after one discarded warm-up run on the same machine and VS Code build. Report the median and p95 plus the fixture, target, commit, CPU, and available memory. A regression is a gate failure when either the absolute budget or the 20% relative budget against this baseline is exceeded.

| Measurement | Absolute p95 budget |
| --- | ---: |
| Builder activation to stable controls, cached metadata | 750 ms |
| Builder activation to stable controls, uncached 3,000-field object | 1,500 ms |
| Search/filter or clause interaction to updated preview | 100 ms |
| Results `update` message to stable 50-row grid | 500 ms |
| Results `update` message to stable maximum-result grid | 1,500 ms |
| Sort, page, or restored-tab interaction | 200 ms |

Neither legacy browser UI imports Effect, so its browser-bundle Effect contribution, managed-runtime count, and UI fiber count are all zero. The persistent extension host already owns one lazily created `getSoqlRuntime()` shared across SOQL instances. During migration:

- each mounted Lit builder or results webview owns exactly one browser `ManagedRuntime`;
- presentation components own no runtimes and start no unscoped fibers;
- after ten hide/restore cycles, active UI fiber/listener/resource counts return to the post-mount value after every restore;
- after disposal, the webview runtime and its fibers/listeners are zero;
- retained heap after disposal must be within 10% of the pre-mount value after forced collection in the diagnostic run.

Every new browser bundle reports raw/gzip totals and the raw/gzip contribution attributable to `effect`, `@salesforce/effect-ext-utils`, Lit, and VSCode Elements. The package gate fails on total budgets; the PR report explains dependency-level movement.

## Metadata authority baseline

The extension host is the only metadata authority. `SOQLEditorInstance` routes object lists to `MetadataDescribeService.listSObjects()` and object descriptions to `MetadataDescribeService.describeCustomObject()`, then `TransmogrifierService.toMinimalSObject()` normalizes the payload. The browser does not open an org connection.

Required migration assertions:

- Two identical list requests in one org cause at most one remote list request after cache warm-up.
- Two identical object describes in one org cause at most one remote describe after cache warm-up.
- The browser receives only the minimal `SObject` DTO required for builder behavior.
- A default-org change never returns data tagged for the previous org.
- Deploy, retrieve, source-tracking, and relevant metadata-document changes invalidate affected entries.
- A late response for an old org or selection is rejected rather than replacing newer UI state.
- Missing default org produces the established recoverable state and no browser-side connection attempt.

Run the SOQL completion integration checks together with the catalog/cache suites owned by `salesforcedx-vscode-services`; they are part of this UI's release evidence because the builder consumes that authority rather than duplicating it.

## Accessibility selector contract

Feature-level Playwright tests locate controls by user-visible semantics. Allowed contracts are, in priority order:

1. `getByRole(role, { name })` for buttons, checkboxes, options, alerts, tabs, grids, column headers, rows, and pagination.
2. `getByLabel(label)` for form controls with stable product labels.
3. `getByPlaceholder()` only while the placeholder is an intentional product string and no label is available.
4. A documented public host element or `data-testid` only when the control cannot expose a suitable accessible contract.

LWC element names, shadow-root layout, `.query-preview-container`, `p.option[data-option-value]`, `[data-el-*]`, results element IDs, and `.tabulator-*` classes are legacy-only selectors. They may appear in low-level adapter/component tests, but Lit feature scenarios must not depend on them. Tabulator-specific DOM selectors stay inside the results-grid adapter tests.

Required accessible names include `Run Query`, `Get Query Plan`, `From`, `Fields`, `Select all fields`, `Clear all fields`, `Where`, `Order By`, `Limit`, `All Rows`, `Query preview`, `Save as CSV`, and `Save as JSON`. Notifications use an alert or status role appropriate to urgency. Sorted result headers expose sort direction.

## Theme and screenshot evidence

Capture representative complete-builder and results states in these four VS Code themes:

| Theme kind | Builder artifact | Results artifact |
| --- | --- | --- |
| Light | `builder-light.png` | `results-light.png` |
| Dark | `builder-dark.png` | `results-dark.png` |
| High contrast | `builder-high-contrast.png` | `results-high-contrast.png` |
| High contrast light | `builder-high-contrast-light.png` | `results-high-contrast-light.png` |

The builder state contains From, multiple Fields, Where, Order By, Limit, All Rows, and preview. The results state uses the wide, related, 51-row fixture with the second page and max-row hint visible. Capture at 1440x900 and at a 480 px editor width. Store screenshots as CI artifacts named `soql-ui-baseline-<target>-<commit>`; do not silently update an accepted reference. Review foreground/background, borders, focus, disabled controls, validation, selection, hover, scrollbars, grouped headers, pagination, and icon visibility against VS Code tokens.

Screenshot collection remains an environment gate: a PR without desktop and web artifacts has not completed Story 1 even if unit tests pass.

## Local E2E evidence — 2026-08-19

The focused builder scenario was run locally against a one-day `minimalTestOrg` created through the globally authenticated `vscodeOrg` Dev Hub. The scratch org was deleted successfully after the run. No credentials were copied into the repository or test artifacts.

```bash
npm run test:web --workspace salesforcedx-vscode-soql -- --grep "SOQL Builder"
npm run test:desktop --workspace salesforcedx-vscode-soql -- --grep "SOQL Builder"
```

On web and macOS desktop, the complete builder scenario reached its final validation step after exercising query construction, Run Query, Get Query Plan, and builder/text-editor round trips. Both targets then failed the existing global console-error gate under VS Code 1.134.0 because the VS Code workbench reported that `chat.contextContributions` depends on the unavailable `chatSessionRoutingProviderService`. The desktop run also reported that the local O11y span exporter could not reach its divert endpoint.

These errors originate outside the SOQL webviews, but they remain unsuppressed. The SOQL Lit migration assignee owns reconciliation with the shared Playwright/VS Code test infrastructure before Story 1 closes. The captured default-dark screenshot confirms the completed builder state but does not replace the required four-theme builder/results matrix.
