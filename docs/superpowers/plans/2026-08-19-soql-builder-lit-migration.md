# SOQL Builder LWC-to-Lit Migration Plan

> **Status:** Proposed. A working vertical-slice spike exists on `feature/soql-builder-lit-spike` and remains opt-in behind `salesforcedx-vscode-soql.experimental.useLitSpike`.

**Goal:** Replace the LWC-based SOQL Builder webview with a Lit application using `@vscode-elements/elements`, while preserving the extension-host protocol, SOQL model behavior, saved webview state, telemetry, accessibility, and desktop/web-extension support.

**Recommendation:** Proceed with Lit and keep the application in the publishable `@salesforce/soql-builder-ui` workspace package introduced by the spike. Lit and VSCode Elements work within the current Rollup/CSP pipeline, while a small host contract allows the same application to reuse the existing Effect services in VS Code or run behind a different adapter in a normal browser.

## Scope

In scope:

- The visual SOQL Builder under `packages/salesforcedx-vscode-soql/src/soql-builder-ui`.
- The framework-driven application package under `packages/soql-builder-ui`.
- All current builder features: From, Fields, Where, Order By, Limit, All Rows, query preview, notifications, Run Query, and Get Query Plan.
- LWC build, dependency, test, lint, and template removal after feature parity.
- A production-quality Lit test strategy and accessible VS Code-native styling.

Out of scope:

- The separate query-results webview under `src/soql-data-view`.
- Changes to SOQL execution, query-plan execution, metadata retrieval, or the extension-host/webview message contract unless a proven incompatibility requires one.
- A bundler migration. Keep Rollup until the Lit cutover is complete.
- Publishing the new package to the npm registry. The spike makes the workspace package packable; release ownership, versioning, and publication automation require a separate decision.

## Spike Results

The spike validates the critical framework boundary:

- A Lit root component runs in the real VS Code webview.
- The Lit root and its public host contract compile as the independent, publishable `@salesforce/soql-builder-ui` npm package.
- The UI package contains no VS Code API, extension-service, Effect, or extension-message imports.
- The extension consumes the package through a VS Code/Effect host adapter; the standalone smoke test consumes the same package through an in-memory browser adapter without emulating `acquireVsCodeApi()`.
- `packages/soql-builder-web-example` demonstrates a real standalone deployment boundary: a browser HTTP adapter consumes the UI package while a loopback Node server resolves an explicit org alias or username to its CLI-managed `AuthInfo` record and uses `@salesforce/core` to retrieve object and field metadata.
- `vscode-single-select` and `vscode-multi-select` receive real org metadata and follow VS Code theme variables.
- `ToolingSDK`, `ToolingModelService`, `VscodeMessageServiceLive`, saved state, and document synchronization work unchanged.
- A standalone Chromium smoke test selects Account, Id, and Name and verifies the production model emits `SELECT Id, Name FROM Account`.
- Consuming the independent package produces an 826,612-byte minified spike bundle (209,675 bytes gzip), compared with the current 880,931-byte LWC bundle (230,171 bytes gzip). This is directional only because the spike implements fewer features.

Important findings:

- Reactive TypeScript fields must use Lit's `declare` plus constructor initialization pattern; emitted class fields shadow Lit accessors.
- Babel must enable `allowDeclareFields` for the Lit entry.
- VSCode Elements uses nested shadow roots, so browser tests should favor roles and public control APIs; targeted shadow-root traversal is acceptable in low-level component verification.
- The independent UI package and host contract are type-checked. The legacy builder service graph and thin VS Code adapter are still bundled through Babel type erasure and excluded from the extension package TypeScript compile. A full migration should make the remaining adapter boundary type-checkable rather than carrying this debt forward indefinitely.
- The existing LWC Jest suite has baseline failures and an engine/compiler version warning. Establishing a trustworthy parity baseline is an early migration task.

## Target Architecture

```text
SOQLEditorInstance (extension host)
              ↕ existing messages
VscodeMessageService / ToolingSDK / ToolingModelService
              ↓
VscodeSoqlBuilderHost (extension-owned adapter)
              ↓ public host contract
@salesforce/soql-builder-ui (browser-safe npm package)
  ├─ Lit root application
  │   ├─ application shell and notifications
  │   ├─ From and Fields controls
  │   ├─ Where editor
  │   ├─ Order By editor
  │   ├─ Limit and All Rows controls
  │   └─ query preview and actions
  └─ @vscode-elements/elements + semantic HTML

Standalone browser shell
              ↓
HTTP/mock/in-memory SoqlBuilderHost adapter
              ↓ same public host contract
@salesforce/soql-builder-ui
              ↕ same-origin JSON
Node server using @salesforce/core
              ↕ CLI-managed auth + Salesforce APIs
Salesforce org
```

Keep business and protocol behavior in framework-neutral services and host adapters. Lit components should translate host state into UI and user events into host calls; they should not duplicate SOQL conversion or extension messaging logic. The extension must bundle the package into the VSIX rather than loading application code remotely.

## Proposed File Structure

```text
packages/soql-builder-ui/
  src/
    index.ts                    # public npm entry and custom-element registration
    contracts.ts                # browser-safe host/state/label contracts
    soqlBuilderApp.ts           # Lit root
    components/
      appHeader.ts
      fromFields.ts
      whereEditor.ts
      whereCondition.ts
      orderByEditor.ts
      queryOptions.ts
      queryPreview.ts
      notificationPanel.ts
    styles/
      layout.ts
      shared.ts

packages/salesforcedx-vscode-soql/src/soql-builder-ui/
  lit/
    index.ts                     # webview composition root
    vscodeSoqlBuilderHost.ts     # existing Effect/message-service adapter
  modules/querybuilder/services/ # retained initially
  index.html                     # points to Lit after cutover

packages/soql-builder-web-example/
  src/
    client.ts                    # standalone browser composition root
    httpSoqlBuilderHost.ts       # JSON-backed UI host adapter
    server.ts                    # loopback static/API server
    salesforceOrgDataSource.ts   # @salesforce/core metadata access
```

Do not preserve the current LWC component boundaries mechanically. Group controls by cohesive user workflow and keep the root component focused on orchestration.

## Delivery Plan

### Task 1: Establish parity baselines and migration gates

- [ ] Document every supported builder workflow and state transition from the current LWC UI.
- [ ] Stabilize or explicitly quarantine the existing LWC Jest failures so regressions are distinguishable from baseline failures.
- [ ] Capture representative light, dark, and high-contrast screenshots.
- [ ] Record current raw/gzip bundle size, first-render time, and behavior with a large object containing thousands of fields.
- [ ] Define stable role/label-based Playwright selectors for all workflows.

**Exit criteria:** A repeatable baseline covers query restoration, object and field selection, Where, Order By, Limit, All Rows, invalid/unsupported queries, missing default org, Run Query, and Get Query Plan.

### Task 2: Promote the spike into a production Lit foundation

- [x] Extract the Lit application and public host contract into `@salesforce/soql-builder-ui`.
- [x] Move VS Code/Effect runtime setup, subscriptions, loading states, and cleanup behind an extension-owned host adapter.
- [x] Replace VS Code API emulation with a separate in-memory browser host for standalone verification.
- [x] Add a standalone Node/browser example backed by `@salesforce/core` and CLI-managed org authorization.
- [ ] Move `litSpike` into the proposed production `lit` structure after the experimental phase.
- [ ] Add a dedicated type-checkable configuration for the extension-owned adapter and address the legacy service typing defects without disabling diagnostics.
- [ ] Add browser-based component tests suitable for `ElementInternals`, popovers, and shadow DOM.
- [ ] Keep the experimental setting and LWC default during migration.

**Exit criteria:** The Lit shell initializes and disposes cleanly, external document updates restore state, and build/type/lint/browser checks run as repository-owned scripts.

### Task 3: Complete the simple form controls

- [ ] Harden the spike's From control with loading, invalid, empty, keyboard, and large-list coverage.
- [ ] Harden Fields selection, including select-all/clear-all behavior and restored selections.
- [ ] Migrate Limit to `vscode-textfield type="number"` with existing validation semantics.
- [ ] Migrate All Rows to `vscode-checkbox`.
- [ ] Use `vscode-label` or equivalent accessible labels where it improves form association.

**Exit criteria:** From, Fields, Limit, and All Rows have behavior parity and update the same `ToolingModelService` model as LWC.

### Task 4: Migrate query actions, notifications, and preview

- [ ] Implement Run Query and Get Query Plan with `vscode-button`, disabled states, and progress feedback.
- [ ] Reproduce missing-default-org, unsupported-query, and syntax-error flows with semantic alert/status roles and VS Code theme variables.
- [ ] Migrate query preview while preserving formatting and responsive layout.
- [ ] Preserve all current message types and telemetry payloads.

**Exit criteria:** Action enablement, progress completion messages, notification dismissal, and query preview match current behavior.

### Task 5: Migrate Where—the highest-risk workflow

- [ ] Create a Lit `whereEditor` and repeatable `whereCondition` component.
- [ ] Replace field/operator controls with `vscode-single-select` and criteria input with `vscode-textfield`.
- [ ] Preserve operator filtering by Salesforce field metadata, value parsing, error messages, AND/OR behavior, add/remove behavior, restored queries, and focus management.
- [ ] Add focused tests for each field type and operator family before deleting the LWC implementation.

**Exit criteria:** All existing Where unit and Playwright scenarios pass against Lit, including keyboard-only editing and invalid criteria.

### Task 6: Migrate Order By

- [ ] Implement field, direction, and null-order controls using VSCode Elements.
- [ ] Preserve add/update/remove semantics and restored selections.
- [ ] Use accessible remove actions rather than clickable text glyphs.

**Exit criteria:** Multiple Order By entries round-trip correctly through the text document and saved webview state.

### Task 7: Cut over and remove LWC

- [ ] Run full desktop and web Playwright parity suites against the Lit entry.
- [ ] Make Lit the default `index.html` entry and remove the experimental switch after a stabilization period.
- [ ] Delete LWC components, templates, `lwcUtils`, the custom select, LWC Jest configuration, and LWC-only Rollup workarounds.
- [ ] Remove `@lwc/*` and LWC lint dependencies from the SOQL package.
- [ ] Consolidate styling around VS Code variables and remove the Salesforce-colored fallback palette where it is no longer necessary.
- [ ] Update contributor documentation and screenshots.

**Exit criteria:** No LWC runtime, compiler, test, or lint dependency remains in `salesforcedx-vscode-soql`; the Lit builder is the sole implementation.

## Suggested Pull Request Slices

1. Lit foundation, controller, test harness, and type-checkable project.
2. From, Fields, Limit, and All Rows.
3. Actions, notifications, and query preview.
4. Where editor.
5. Order By and full parity tests.
6. Cutover and LWC removal.

Each slice should leave the LWC default working until the final cutover and should include its own tests rather than deferring all verification to the removal PR.

## Verification Commands

From the repository root:

```bash
npm run compile --workspace salesforcedx-vscode-soql
npm run compile --workspace @salesforce/soql-builder-ui
npm run lint --workspace @salesforce/soql-builder-ui
npm test --workspace @salesforce/soql-builder-ui
npm run compile --workspace @salesforce/soql-builder-web-example
npm run lint --workspace @salesforce/soql-builder-web-example
npm test --workspace @salesforce/soql-builder-web-example
npm run lint --workspace salesforcedx-vscode-soql
npm test --workspace salesforcedx-vscode-soql
npm run test:lit-spike --workspace salesforcedx-vscode-soql
npm run test:web --workspace salesforcedx-vscode-soql
npm run test:desktop --workspace salesforcedx-vscode-soql
```

The last two commands are release-gate checks and may require the repository's normal browser/desktop test environment.

## Definition of Done

- Feature parity for all current SOQL Builder workflows.
- Correct light, dark, high-contrast, and high-contrast-light rendering.
- Keyboard navigation, visible focus, form labels, alerts, and remove actions meet VS Code accessibility expectations.
- Desktop and web-extension builds pass.
- No regression in document round-tripping, saved state, telemetry, query execution, or query-plan execution.
- Large object/field lists remain responsive and do not materially regress memory or first-render time.
- Production bundle size has an agreed budget and is measured using the same minified/gzip method as the baseline.
- `@salesforce/soql-builder-ui` can be packed as an npm artifact and consumed without importing VS Code APIs.
- LWC dependencies, templates, tests, build plugins, and compatibility workarounds are removed.
- The Lit webview and its framework-neutral controller are type-checked by repository quality gates.

## Rollback Strategy

Until final cutover, disable `salesforcedx-vscode-soql.experimental.useLitSpike` to return to LWC. During cutover, keep the last LWC-default commit identifiable so a release can revert the entry-point change without reverting unrelated model or extension-host work.
