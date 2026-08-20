# SOQL Builder and Query Results Lit Migration Plan

> **Status:** Proposed. A working vertical-slice spike exists on `feature/soql-builder-lit-spike` and remains opt-in behind `salesforcedx-vscode-soql.experimental.useLitSpike`.

**Goal:** Replace the LWC-based SOQL Builder and the vanilla JavaScript query-results shell with Lit applications using `@vscode-elements/elements` and a browser-safe Effect state/action layer, while retaining the Tabulator results grid and preserving extension-host protocols, SOQL model behavior, saved webview state, exports, telemetry, accessibility, and desktop/web-extension support.

**Recommendation:** Proceed with Lit for both webviews. Keep the builder application in the private `@salesforce/soql-builder-ui` workspace package introduced by the spike, and implement query results as a separately bundled, extension-owned Lit entry because its lifecycle and save actions are specific to the VS Code webview. Both applications should use VSCode Elements and the same VS Code theme-token strategy.

## Scope

In scope:

- The visual SOQL Builder under `packages/salesforcedx-vscode-soql/src/soql-builder-ui`.
- The framework-driven application package under `packages/soql-builder-ui`.
- All current builder features: From, Fields, Where, Order By, Limit, All Rows, query preview, notifications, Run Query, and Get Query Plan.
- The query-results webview under `packages/salesforcedx-vscode-soql/src/soql-data-view` and its extension host under `src/queryDataView`.
- All current results features: document title, returned/total record count, max-row guidance, flattened relationship columns, grouped headers, local pagination, column sizing, scrolling, saved webview state, and CSV/JSON exports.
- LWC build, dependency, test, lint, and template removal after feature parity.
- Plain JavaScript results-controller removal and Tabulator restyling around VS Code theme tokens after results parity.
- A production-quality Lit test strategy and accessible VS Code-native styling.

Out of scope:

- Changes to SOQL execution, query-plan execution, metadata retrieval, query-result flattening, CSV/JSON file formats, or extension-host/webview message contracts unless a proven incompatibility requires one.
- A second metadata discovery, caching, or invalidation implementation in either webview. The extension-side catalog-backed `MetadataDescribeService` merged in PR #7918 remains the metadata authority.
- A bundler migration. Keep Rollup until the Lit cutover is complete.
- Publishing the new package to the npm registry. `@salesforce/soql-builder-ui` must remain a private workspace package and be excluded from publication jobs.

## Spike Results

The spike validates the critical framework boundary:

- A Lit root component runs in the real VS Code webview.
- The Lit root and its public host contract compile as the independent `@salesforce/soql-builder-ui` workspace package. The production plan changes the spike manifest to private before cutover.
- The UI package contains no VS Code API, extension-owned service, or extension-message imports. The production migration deliberately adds browser-safe Effect state, action, error, stream, and lifecycle primitives to the package.
- The extension consumes the package through a VS Code/Effect host adapter.
- `vscode-single-select` and `vscode-multi-select` receive real org metadata and follow VS Code theme variables.
- `ToolingSDK`, `ToolingModelService`, `VscodeMessageServiceLive`, saved state, and document synchronization work unchanged.
- A Chromium smoke test selects Account, Id, and Name and verifies the production model emits `SELECT Id, Name FROM Account`.
- Consuming the independent package produces an 826,612-byte minified spike bundle (209,675 bytes gzip), compared with the current 880,931-byte LWC bundle (230,171 bytes gzip). This is directional only because the spike implements fewer features.

Important findings:

- Reactive TypeScript fields must use Lit's `declare` plus constructor initialization pattern; emitted class fields shadow Lit accessors.
- Babel must enable `allowDeclareFields` for the Lit entry.
- VSCode Elements uses nested shadow roots, so browser tests should favor roles and public control APIs; targeted shadow-root traversal is acceptable in low-level component verification.
- The query-results webview is not LWC. It is static HTML/CSS plus an untyped JavaScript controller using Tabulator 4.8.1 and direct `acquireVsCodeApi()` calls.
- Retain Tabulator for its local pagination, sorting, grouped headers, column sizing, and scrolling. `vscode-table` is not a drop-in replacement because it does not provide all of those behaviors.
- VSCode Elements styles are encapsulated in component shadow roots and cannot be applied directly to Tabulator. The Lit results shell should use VSCode Elements controls, while Tabulator is themed separately with the same public `--vscode-*` tokens, spacing, borders, focus treatment, and typography.
- The independent UI package and host contract are type-checked. The legacy builder service graph and thin VS Code adapter are still bundled through Babel type erasure and excluded from the extension package TypeScript compile. A full migration should make the remaining adapter boundary type-checkable rather than carrying this debt forward indefinitely.
- PR #7918 changed the extension host to obtain object metadata through the shared, catalog-backed `MetadataDescribeService`, normalize raw describes through `TransmogrifierService.toMinimalSObject`, and send the resulting minimal `SObject` across the existing webview message boundary.
- The current builder-side `SObjectMetadata` type is a JSforce-derived structural subset. Although the normalized `SObject` is compatible with current consumers, the production UI package should own and decode a browser-safe metadata DTO/Effect Schema rather than importing JSforce or `salesforcedx-vscode-services` types.
- The persistent extension `getSoqlRuntime()` and the managed browser runtime serve different execution contexts. The extension runtime owns catalog-backed metadata acquisition; the webview runtime owns UI state and actions. They communicate only through the existing messages and are not combined or duplicated.
- The existing LWC Jest suite has baseline failures and an engine/compiler version warning. Establishing a trustworthy parity baseline is an early migration task.

## Target Architecture

```text
SOQLEditorInstance (extension host)
  ├─ persistent getSoqlRuntime()
  └─ MetadataDescribeService → TransmogrifierService
              ↓ normalized browser-safe metadata DTO
              ↕ existing messages
VscodeMessageService / ToolingSDK / ToolingModelService
              ↓
VscodeSoqlBuilderDriver (extension-owned Effect layer)
              ↓ public Effect driver contract
@salesforce/soql-builder-ui (browser-safe private workspace package)
  ├─ one managed Effect runtime and scoped application controller
  ├─ Effect-native state stream, typed actions, and typed UI errors
  ├─ Lit root application
  │   ├─ application shell and notifications
  │   ├─ From and Fields controls
  │   ├─ Where editor
  │   ├─ Order By editor
  │   ├─ Limit and All Rows controls
  │   └─ query preview and actions
  └─ @vscode-elements/elements + semantic HTML

QueryDataViewService (extension host)
              ↕ existing activate/update/save_records messages
VscodeQueryResultsDriver (extension-owned Effect layer)
              ↓ typed state and actions
QueryResultsApp (extension-owned Lit entry)
  ├─ one managed Effect runtime and scoped QueryResultsDriver
  ├─ results header, record count, and max-row guidance
  ├─ Lit-managed Tabulator results-grid wrapper
  ├─ CSV and JSON actions
  └─ @vscode-elements/elements + semantic HTML
```

Keep business and protocol behavior in framework-neutral Effect services and driver layers. Lit components should render immutable state and dispatch typed actions through one composition-root-owned Effect runtime per webview; they should not create component-local runtimes or duplicate SOQL conversion, result flattening, export behavior, or extension messaging logic. Both applications must be bundled into the VSIX rather than loading application code remotely.

## Proposed File Structure

```text
packages/soql-builder-ui/
  src/
    index.ts                    # public npm entry and custom-element registration
    contracts.ts                # browser-safe Effect driver/state/action/error contracts
    metadata.ts                 # browser-safe metadata DTO and Effect Schema
    controller.ts               # Effect state transitions and action orchestration
    runtime.ts                  # one scoped browser runtime per mounted application
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
    vscodeSoqlBuilderDriver.ts   # VS Code Effect layer using existing services/messages
  modules/querybuilder/services/ # retained initially
  index.html                     # points to Lit after cutover

packages/salesforcedx-vscode-soql/src/soql-data-view/
  index.html                     # minimal query-results Lit mount point
  lit/
    index.ts                     # results webview composition root
    queryResultsApp.ts           # Lit root
    queryResultsContracts.ts     # Effect-native state/action/error boundary
    vscodeQueryResultsDriver.ts  # acquireVsCodeApi/message/state Effect layer
    components/
      resultsHeader.ts
      resultsGrid.ts
      resultsPagination.ts
    styles.ts
```

Do not preserve the current LWC component boundaries mechanically. Group controls by cohesive user workflow and keep each root component focused on orchestration. The query-results UI remains extension-owned rather than expanding the public builder package.

## Epic

### Migrate the SOQL Builder and query-results webviews to Lit and VSCode Elements

**Epic story:** As a Salesforce developer using SOQL Builder, I want the builder and query results to use a consistent, VS Code-native Lit interface so that I can compose, run, inspect, and export queries with the same behavior, accessibility, and reliability in desktop and web VS Code.

**Business outcome:** Remove the SOQL Builder's LWC-specific runtime and the results view's untyped JavaScript shell while delivering a consistent Lit and VSCode Elements experience without changing Tabulator grid, query, results, or export behavior.

**Starting point:** `feature/soql-builder-lit-spike` after merge commit `181aea40e`, which reconciles spike commits `8cacbe1fb` and `5e7f2ac5d` with `develop` commit `2326d1eff` from PR #7918. The spike and the shared org metadata catalog are accepted technical inputs to this epic, not work that must be repeated. They already provide:

- the `@salesforce/soql-builder-ui` workspace package and browser-safe host contract;
- a Lit root using `vscode-single-select` and `vscode-multi-select` for From, Fields, and query preview;
- an extension-owned `VscodeSoqlBuilderHost` that reuses the current Effect services and message transport;
- catalog-backed object discovery and describe caching in the extension host, plus normalized minimal `SObject` payloads across the existing metadata messages;
- opt-in VS Code wiring behind `salesforcedx-vscode-soql.experimental.useLitSpike`;
- compile, lint, package-contract, and Chromium smoke-test coverage for the vertical slice.

### Success measures

- Every supported builder and query-results workflow has an automated Lit parity check and passes on desktop and web extension targets.
- Existing extension-host message types, saved-state shapes, document round-trip behavior, result payloads, exports, and telemetry fields remain compatible.
- Builder metadata is acquired only through the extension-side `MetadataDescribeService` and `TransmogrifierService`; the UI accepts a validated browser DTO and introduces no competing org connection, cache, or invalidation path.
- The Lit UI meets the accessibility, theme, performance, and bundle budgets established by Story 1.
- No `@lwc/*` runtime, compiler, Jest preset, lint dependency, template, custom-select implementation, or LWC-only Rollup workaround remains after cutover.
- No untyped query-results controller or results-specific hard-coded color palette remains after cutover; Tabulator is isolated behind a typed Lit wrapper and themed with VS Code tokens.
- `@salesforce/soql-builder-ui` remains browser-safe and independently type-checked, with `"private": true` preventing repository publication jobs from publishing it.

### Delivery constraints

- Keep the legacy builder and results entries available while their Lit replacements are under parity testing; make Lit the default only in the cutover story.
- Keep Rollup for the migration; a bundler change is a separate effort.
- Keep `@salesforce/soql-builder-ui` private. Its `package.json` must contain `"private": true`, must not advertise public publication, and must be skipped by repository release/publish automation.
- Reuse `ToolingModelService`, `ToolingSDK`, SOQL model converters, `extendQueryData`, `QueryDataFileService`, and current extension messages unless a story identifies and documents an incompatibility.
- Treat the extension-side `MetadataDescribeService` and its catalog integration as the sole builder metadata authority. Normalize raw describes with `TransmogrifierService`, then validate/map the message payload to a browser-safe UI contract; do not import JSforce or `salesforcedx-vscode-services` into `@salesforce/soql-builder-ui`.
- Keep the persistent extension `getSoqlRuntime()` separate from the browser runtime. Metadata API calls, catalog caching, invalidation, and org identity remain in the extension context; UI state/action fibers remain in the webview context.
- Keep VS Code-specific APIs, extension-owned Effect services, and transport types outside `@salesforce/soql-builder-ui`. Browser-safe Effect services, streams, typed errors, scopes, and action types belong in the UI package.
- Create exactly one managed Effect runtime per mounted webview application. The composition root owns it, Lit connection starts scoped subscriptions, and disconnection interrupts fibers and disposes the runtime and all acquired resources.
- Model UI intent as typed actions returning `Effect` values and expose immutable state as an Effect stream. Do not scatter `Effect.runPromise`/`Effect.runFork` calls across presentation components or use unowned daemon fibers.
- Use VSCode Elements where it provides the control (`vscode-button`, `vscode-button-group`, `vscode-checkbox`, `vscode-icon`, `vscode-label`, `vscode-multi-select`, `vscode-option`, `vscode-progress-ring` or `vscode-progress-bar`, `vscode-single-select`, and `vscode-textfield`) and semantic HTML where it does not. Retain Tabulator as the query-results grid and theme it with public VS Code CSS variables.

## User Story Backlog

Stories are ordered by dependency. Relative sizes are planning guidance and should be re-estimated by the delivery team after Story 1.

### Story 1 — Establish builder and query-results parity baselines and migration gates

**Type / size:** Enabler / M

**Story:** As a maintainer, I want a repeatable record of current builder and query-results behavior and quality thresholds so that framework migration regressions are distinguishable from existing failures.

**Acceptance criteria:**

- The builder baseline covers initial load, saved-state restoration, external text changes, From, Fields, `COUNT()`, select all, clear all, Where, Order By, Limit, All Rows, query preview, missing default org, recoverable errors, unsupported queries, syntax errors, notification dismissal, Run Query, Get Query Plan, and builder/text-editor toggling.
- The results baseline covers activation/update messages, restored state after tab changes, document title, returned/total counts, max-row guidance, empty results, flattened and relationship fields, grouped headers, header sorting, local pagination at the current 50-row page size, column resizing, horizontal/vertical scrolling, narrow layouts, CSV/JSON actions, and desktop/web save flows.
- Existing LWC Jest failures and engine/compiler warnings are either fixed or recorded with test names, reproduction commands, and an explicit quarantine owner; quality gates are not disabled.
- Light, dark, high-contrast, and high-contrast-light reference screenshots are captured for representative builder and results states.
- Raw and gzip bundle sizes, first-render time, and interaction behavior are measured for a large object with thousands of fields and for small, 50-row, 51-row, wide, deeply related, and maximum-configured result sets using documented, repeatable commands.
- The baseline records the Effect contribution to each browser bundle, verifies that each mounted webview creates only one managed Effect runtime, and defines acceptable fiber/resource counts across repeated hide, restore, and dispose cycles.
- Metadata baselines cover the normalized minimal `SObject` payload, catalog cache reuse, default-org changes, invalidation after relevant metadata changes, stale-response rejection, missing-org behavior, and the number of extension-side list/describe requests for repeated UI actions.
- A role/label-based Playwright selector contract is documented; framework-internal selectors are limited to low-level control tests.
- Desktop and web release-gate commands and the agreed accessibility, performance, and bundle thresholds are recorded before feature migration begins.

### Story 2 — Promote the Lit spike to a production foundation

**Type / size:** Enabler / M

**Story:** As a maintainer, I want the spike's Lit application, Effect runtime, and driver to become supported production code so that feature stories build on stable lifecycle, packaging, and type-checking boundaries.

**Acceptance criteria:**

- `litSpike` and spike-only names, copy, banner content, and file paths are replaced with the intended production `lit` composition root without changing the LWC default.
- The browser-safe UI package depends directly on `effect` and defines the shared typed state, action, error, stream, and scoped-lifecycle primitives used by the Lit application and its drivers.
- The webview composition root creates exactly one `ManagedRuntime` for the mounted application; Lit connection starts scoped subscriptions and disconnection interrupts fibers, runs finalizers, and disposes the runtime without leaking listeners across reloads.
- The extension-owned adapter and retained framework-neutral services are included in a repository TypeScript project and pass compile and lint without blanket diagnostics suppression.
- `@salesforce/soql-builder-ui` has no imports from VS Code, extension-owned services, or extension message modules. Its Effect imports use browser-compatible entry points and remain independently bundleable for VS Code webviews and test/browser drivers.
- The UI package owns a browser-safe object/field DTO and Effect Schema for inbound metadata. It has no JSforce or `salesforcedx-vscode-services` dependency, and invalid metadata becomes a typed driver error rather than unvalidated component state.
- Presentation components do not create runtimes, call global `Effect.runPromise`/`Effect.runFork`, or start unowned daemon fibers; the composition root and controller own Effect execution.
- `packages/soql-builder-ui/package.json` contains `"private": true`; public `publishConfig` and unnecessary independent-publication metadata from the spike are removed, and the repository's package-selection/release tooling verifies that publication jobs skip the package.
- The CSP and Rollup outputs bundle all application code into the VSIX; no runtime code is loaded remotely.
- A deterministic fake Effect driver layer used by UI tests is updated when the public contract changes.

**Depends on:** Story 1.

### Story 3 — Expand the Effect driver contract to cover the complete builder state and actions

**Type / size:** Enabler / L

**Story:** As a UI developer, I want a typed, browser-safe Effect driver contract for the full builder so that Lit components can render immutable state and dispatch actions without knowing about VS Code messages or extension-owned services.

**Acceptance criteria:**

- The public state represents the complete `ToolingModelJson` behavior needed by the UI: object metadata, selected fields, Where conditions and AND/OR, Order By entries, Limit, All Rows, original SOQL, parse errors, unsupported syntax, loading flags, missing-default-org state, and query/query-plan progress.
- The driver exposes immutable builder state as an Effect `Stream` and accepts a discriminated union of typed UI actions whose execution returns `Effect<void, SoqlBuilderError>` or an equivalently typed Effect result.
- The public actions cover object and field selection, select all, clear all, Where upsert/remove/AND-OR changes, Order By add/update/remove, Limit, All Rows, notification dismissal, setting a default org, running a query, and requesting a query plan.
- `VscodeSoqlBuilderDriver` is an extension-owned Effect `Layer` that maps those actions to the existing services and preserves `ui_soql_changed`, `ui_telemetry`, metadata, connection, run-query, query-plan, and default-org message behavior.
- Object discovery and describes remain extension-host operations executed through the persistent `getSoqlRuntime()`, catalog-backed `MetadataDescribeService`, and `TransmogrifierService.toMinimalSObject`; the browser driver does not open an org connection or implement another metadata cache.
- The existing `sobjects_request`/`sobjects_response` and `sobject_metadata_request`/`sobject_metadata_response` message names remain compatible. The driver decodes normalized payloads at the boundary into the UI-owned browser DTO before publishing state.
- The metadata contract covers every field attribute required by Fields, Where, and Order By—including name, type, nillability, picklist values, filtering/sorting capabilities, and relationship information—without exposing the services-owned `SObject` type to the UI package.
- Request correlation or an equivalent selected-object guard prevents a late describe response from a prior object or org from replacing current metadata; connection changes clear incompatible state and reload through the extension authority.
- A browser/test driver implements the same Effect service contract without VS Code APIs, message types, or extension-owned Effect services.
- Saved state and an external `text_soql_changed` event repopulate every supported Lit control without emitting a duplicate document update.
- Changing the selected object preserves header comments and resets dependent model state exactly as the current `ToolingModelService` does.
- Contract tests exercise immutable state publication, typed error propagation, initialization, cancellation, disposal/finalization, and each action mapping using deterministic Effect layers.

**Depends on:** Story 2.

### Story 4 — Add a production Lit browser test harness

**Type / size:** Enabler / M

**Story:** As a maintainer, I want browser-based component and integration tests for Lit and VSCode Elements so that behavior relying on shadow DOM, popovers, and `ElementInternals` is tested in a real browser.

**Acceptance criteria:**

- A repository-owned test command runs Lit component tests in Chromium and is part of the relevant package test workflow.
- Tests mount components with deterministic fake `SoqlBuilderDriver` and `QueryResultsDriver` layers and can drive state changes and assert actions without `acquireVsCodeApi()` emulation.
- Fake builder and results drivers are provided as Effect layers with deterministic state streams, typed failures, controllable latency, and test-clock support where timing affects behavior.
- User-flow tests prefer accessible roles, names, labels, and public component APIs; any shadow-root traversal is isolated in documented helpers.
- The harness includes keyboard navigation, focus movement, form association, disabled/loading state, alert/status announcement, and component cleanup coverage.
- Lifecycle tests prove that reconnect/disconnect, action cancellation, and driver failure do not leave running fibers, duplicate subscriptions, or acquired resources.
- The existing vertical-slice smoke test remains green or is replaced by equivalent coverage in the production harness.

**Depends on:** Story 2. Can proceed in parallel with Story 3.

### Story 5 — Migrate From selection

**Type / size:** Feature / M

**Story:** As a Salesforce developer, I want to search for and select an object in the Lit builder so that I can establish the query's `FROM` clause.

**Acceptance criteria:**

- From uses a labeled `vscode-single-select` with searchable object options and a loading state.
- Empty, no-results, missing-default-org, invalid/recoverable From error, restored selection, and external-document update states match the accepted baseline.
- Selecting an object resets the same dependent query state as LWC, requests that object's metadata once, and updates the document and preview through the existing model service.
- Object options come from the extension-side catalog-backed metadata service through the existing messages; reopening or repeating the same request follows the established cache policy rather than creating a webview-local metadata source.
- A default-org change clears object options and in-flight selection state before repopulating them for the new org, and a late response from the previous org is ignored.
- Keyboard-only selection, visible focus, accessible labeling, large-list behavior, and theme rendering meet Story 1 gates.
- Component, host-contract, and desktop/web parity tests cover the workflow.

**Depends on:** Stories 3 and 4.

### Story 6 — Migrate Fields selection

**Type / size:** Feature / L

**Story:** As a Salesforce developer, I want to search, select, and remove fields in the Lit builder so that I can define the query's `SELECT` clause efficiently.

**Acceptance criteria:**

- Fields uses a labeled `vscode-multi-select`, is disabled until an object is selected, and exposes loading, empty, no-results, and recoverable field-error states.
- Individual add/remove, Select All, Clear All, restored selection, and external-document updates match LWC behavior.
- `COUNT()` remains mutually exclusive with ordinary fields and round-trips through the model and text document.
- Selections remain valid while metadata is refreshed for the same object, and stale metadata from a previous object is not displayed.
- Field metadata is decoded from the normalized browser DTO, including type, nillability, picklists, filter/sort capabilities, and relationships needed by downstream editors; invalid payloads enter the typed recoverable-error state.
- Repeated field loads reuse the extension catalog/describe cache, while relevant metadata invalidation and org changes refresh through the extension authority without a second UI cache.
- Thousands of fields remain searchable and responsive within the Story 1 budget.
- Component, host-contract, and desktop/web parity tests cover the workflow.

**Depends on:** Stories 3–5.

### Story 7 — Migrate Limit and All Rows

**Type / size:** Feature / S

**Story:** As a Salesforce developer, I want to set a row limit and include deleted or archived records so that I can control the query result scope.

**Acceptance criteria:**

- Limit uses a labeled `vscode-textfield` with numeric input behavior and preserves empty, valid, invalid, recoverable-error, restored, blur/change, and external-update semantics.
- All Rows uses `vscode-checkbox`, restores its checked state, and adds or removes `ALL ROWS` without altering other clauses.
- Both controls update the query preview, document, saved state, and telemetry through the existing model path.
- Keyboard, focus, accessible error association, and theme tests pass.

**Depends on:** Stories 3 and 4.

### Story 8 — Migrate query actions and progress states

**Type / size:** Feature / M

**Story:** As a Salesforce developer, I want to run the current query or request its query plan from the Lit builder so that I can act on the query without switching views.

**Acceptance criteria:**

- Run Query and Get Query Plan use `vscode-button` and are disabled when the query lacks an object or fields, when no default org is available, or when the same action is already running.
- Starting an action sends the existing `run_query` or `get_query_plan` message exactly once and exposes accessible progress text plus a VSCode Elements progress indicator where appropriate.
- `run_query_done` and `get_query_plan_done` independently clear the correct progress state and restore button labels and availability.
- The results webview and query-plan output behavior remain extension-host concerns and match current end-to-end behavior.
- Existing telemetry payload names and values are unchanged.
- Component, adapter, desktop, and web tests cover valid, invalid, running, completed, and repeated-click states.

**Depends on:** Stories 3 and 4.

### Story 9 — Migrate notifications and query preview

**Type / size:** Feature / M

**Story:** As a Salesforce developer, I want clear feedback about org and query problems plus a live query preview so that I understand what the builder will run or rewrite.

**Acceptance criteria:**

- The preview renders the model's original SOQL, preserves whitespace/wrapping behavior, updates live, and is announced without excessive screen-reader chatter.
- Missing-default-org guidance blocks the form and offers the existing Set a Default Org action.
- Recoverable From, Fields, and Limit errors remain associated with their controls without unnecessarily blocking the full builder.
- Unsupported syntax and unrecoverable syntax errors display the accepted title, guidance, and ordered messages and block editing until Edit Query Anyway is chosen.
- Edit Query Anyway dismisses the blocking notification and clearly communicates that unsupported or invalid syntax can be rewritten.
- Notifications use semantic alert/status behavior, support keyboard interaction and visible focus, and render correctly in all supported themes.
- Telemetry for errors and unsupported reasons is preserved without duplicate emission.

**Depends on:** Stories 3 and 4.

### Story 10 — Migrate the Where editor

**Type / size:** Feature / L

**Story:** As a Salesforce developer, I want to add and edit typed filter conditions in the Lit builder so that I can create valid `WHERE` clauses without writing SOQL manually.

**Acceptance criteria:**

- A Lit `whereEditor` manages repeatable `whereCondition` rows with labeled `vscode-single-select` field/operator controls, a `vscode-textfield` value control, VSCode Elements buttons, and accessible remove actions.
- An empty query shows one incomplete row; Add is enabled only when the last row is complete and valid; remove and reindex behavior matches the model service.
- AND/OR selection is restored and only updates a complete multi-condition expression.
- Operators `=`, `!=`, `<`, `<=`, `>`, `>=`, `IN`, `NOT IN`, `INCLUDES`, `EXCLUDES`, `LIKE`, starts with, ends with, and contains preserve their current model mappings.
- Validation, normalization, display conversion, string escaping, wildcard handling, multiple values, `null`, nillability, and picklist values reuse the existing SOQL model/utilities rather than being reimplemented in presentation components.
- Boolean, integer, long, double, currency, percent, date, date-time, time, string, picklist, multi-picklist, and fallback field behavior have focused tests, including invalid values and operators.
- Restored and externally edited queries repopulate every row; debounced input cannot publish stale state after a field/operator change or component removal.
- Keyboard-only creation, removal, error discovery, and predictable focus placement pass accessibility tests.

**Depends on:** Stories 3, 4, and 6.

### Story 11 — Migrate Order By

**Type / size:** Feature / M

**Story:** As a Salesforce developer, I want to add, update, and remove sort fields in the Lit builder so that I can control record ordering.

**Acceptance criteria:**

- Field, direction, and null ordering use labeled VSCode Elements controls and expose loading and no-results states.
- Adding a new field, updating an existing field, selecting ascending/descending and nulls first/last, and removing an entry preserve existing model semantics.
- Multiple entries restore from saved state and external text, maintain their order, and round-trip through the document without duplication.
- Add is disabled until the row is valid, and remove controls have accessible names, keyboard behavior, visible focus, and deterministic post-remove focus.
- Component, adapter, and desktop/web parity tests cover add, update, remove, restore, and multi-entry scenarios.

**Depends on:** Stories 3, 4, and 6.

### Story 12 — Migrate the query-results shell and Effect driver boundary to Lit

**Type / size:** Feature / L

**Story:** As a Salesforce developer, I want query results presented in a VS Code-native Lit shell backed by an Effect driver so that inspecting and exporting records feels consistent with the Lit builder and remains reliable across webview lifecycle changes.

**Acceptance criteria:**

- An extension-owned, type-checked `QueryResultsApp` replaces the Lit path's static DOM manipulation and is emitted as a separate bundled webview entry under the existing CSP.
- A typed `QueryResultsDriver` exposes immutable result state as an Effect `Stream` and CSV/JSON save actions as typed Effect operations; `acquireVsCodeApi()`, window message listeners, `getState`, `setState`, and `postMessage` are isolated in the extension-owned `VscodeQueryResultsDriver` layer rather than presentation components.
- The results composition root owns exactly one managed Effect runtime. Mount starts scoped message/state subscriptions, and unmount interrupts them and runs finalizers without component-local runners or unowned fibers.
- The driver preserves the existing `activate`, `update`, and `save_records` messages, including `csv`/`json` format values and extension-host OpenTelemetry spans.
- State represents the document title, returned count, total count, max-row guidance, flattened fields/rows, and any empty/error state required by the UI without duplicating `extendQueryData` or export logic.
- The title, returned/total summary, and max-row guidance match current behavior; guidance is keyboard and screen-reader accessible rather than hover-only.
- Save as CSV and Save as JSON use `vscode-button` or `vscode-button-group` with accessible names and optional `vscode-icon`, and continue to invoke `QueryDataFileService` through the host.
- Saved webview state restores immediately after context recreation, the activation response can refresh it, and initialization, cancellation, failure, and disposal do not duplicate message or resize listeners or leave running fibers.
- The legacy results entry remains available during parity testing, while the Lit entry has component and driver tests with a deterministic fake Effect layer.
- Component and driver tests use a deterministic fake Effect layer to cover initial state, updates, export success/failure, cancellation, reconnection, and disposal.
- A repository-owned `test:query-results-ui` command or clearly named equivalent runs the results component and driver tests in the package quality workflow.

**Depends on:** Stories 1 and 4. Can proceed in parallel with builder Stories 5–11.

### Story 13 — Wrap and theme the Tabulator results grid in Lit

**Type / size:** Feature / XL

**Story:** As a Salesforce developer, I want the existing results grid presented through a Lit component and styled consistently with VS Code so that pagination, sorting, grouped headers, and performance remain familiar while the surrounding webview is modernized.

**Acceptance criteria:**

- A Lit `resultsGrid` component owns a narrow, typed Tabulator adapter; the rest of the application does not reference the Tabulator global, DOM classes, or imperative API.
- Tabulator acquisition is modeled as a scoped Effect resource: construction and listener/resize registration are paired with guaranteed destruction and cleanup through `Effect.acquireRelease` or an equivalent scoped finalizer.
- The grid wrapper deliberately renders its Tabulator mount in a scoped light-DOM container so the retained base stylesheet and VS Code-token overrides apply; it does not assume document CSS can cross a Lit shadow root.
- The component creates one grid instance after its mount element is available, updates data without unnecessary destruction/recreation, rebuilds only when the column schema requires it, and releases the Effect scope so the instance plus resize resources are destroyed when disconnected.
- The adapter consumes `flattenedGrid.fields` and `flattenedGrid.rowData`; result flattening stays in the extension host.
- Tabulator preserves the current 50-row local pagination, header sorting, grouped relationship headers, resizable/fit columns, and horizontal/vertical scrolling behavior.
- Current pagination and sorting are keyboard operable and expose meaningful roles, labels, state, and sort direction. Accessibility gaps discovered in the baseline are fixed in the wrapper where feasible and documented if constrained by Tabulator.
- Dotted relationship fields retain their grouped hierarchy, full accessible labels, and safe value rendering.
- Empty, single-row, 50-row, 51-row, wide, deeply related, null-valued, and maximum-configured result sets render correctly, with no unsafe HTML interpolation of record values.
- Small results avoid unnecessary empty gray space; large results remain within the Story 1 render, interaction, and memory budgets without relying on `retainContextWhenHidden` to hide a costly rebuild.
- A dedicated Tabulator theme layer uses public `--vscode-*` variables for background, foreground, borders, hover/selection, focus, buttons, and typography so the grid visually aligns with adjacent VSCode Elements controls in light, dark, high-contrast, and high-contrast-light themes.
- Tabulator overrides are scoped to the results component, minimize coupling to internal selectors, and are documented separately from reusable Lit/VSCode Elements styles.
- Focused browser tests cover initialization, data/schema updates, pagination, sorting, resizing, scrolling, grouped relationship fields, theme tokens, restoration, and cleanup.

**Depends on:** Story 12.

### Story 14 — Migrate SOQL webview end-to-end tests to the Lit UI contracts

**Type / size:** Quality / L

**Story:** As a maintainer, I want builder and query-results end-to-end tests to interact with Lit through stable user-facing contracts so that the suite validates the new frameworks and styling without depending on legacy implementation details.

**Acceptance criteria:**

- The existing `soql-builder.spec.ts` flow can run against the opt-in Lit builder before cutover and covers object and field selection, Limit, Where, Order By, All Rows, live preview, save, Run Query, Get Query Plan, and builder/text-editor round-trip.
- `soql-save-query-results.spec.ts` runs against Lit results and covers the record summary, grid headers/rows, saved-state restoration after tab switching, pagination for more than 50 rows, CSV export, JSON export, and desktop/web save flows.
- Feature-level E2E selectors no longer depend on LWC custom-element names, `.query-preview-container`, `p.option[data-option-value]`, `[data-el-*]`, Tabulator classes, or results element IDs; they prefer roles, accessible names, labels, and public VSCode Elements APIs.
- Any traversal required for VSCode Elements shadow roots or popovers is isolated in shared helpers with user-facing method names, rather than repeated in test scenarios.
- Tests wait on observable UI or extension state instead of framework render timing, fixed delays, internal reactive fields, Lit lifecycle methods, or Tabulator callbacks.
- Test setup can explicitly choose legacy or Lit entries for builder and results while both exist; Lit variants are required migration checks, and legacy variants are removed in Story 16.
- Desktop and web suites exercise the same workflows, with runtime-specific setup isolated in fixtures.
- E2E styling coverage captures representative builder and results states—including empty, populated, paginated, wide, loading/progress, error, blocking-notification, max-row guidance, and narrow layouts—in light, dark, high-contrast, and high-contrast-light themes.
- Styling assertions focus on usable layout, visibility, scrolling, focus indication, control state, and resolved VS Code theme tokens; any pixel-diff snapshots have documented tolerances for platform and browser rendering.
- Failure screenshots, console/network monitoring, and accessibility-oriented assertions remain enabled and produce enough state-specific artifacts to diagnose component, grid, or styling regressions.

**Depends on:** Stories 4–13. Selector helpers and Lit opt-in plumbing may be introduced incrementally with the feature stories.

### Story 15 — Harden both Lit webviews across supported environments

**Type / size:** Quality / L

**Story:** As a Salesforce developer, I want the Lit builder and results view to remain usable across themes, input methods, data sizes, and VS Code runtimes so that the migration does not reduce product quality.

**Acceptance criteria:**

- An accessibility audit covers landmarks, heading order, form and grid labels, descriptions and errors, alert/status behavior, table/header/cell relationships, pagination, tab order, visible focus, keyboard-only use, contrast, zoom, and accessible names for all icon-only actions.
- Light, dark, high-contrast, and high-contrast-light screenshots are reviewed against the Story 1 baselines, using VS Code theme variables instead of Salesforce-specific hard-coded colors where a VS Code token exists.
- Both layouts remain usable at narrow webview widths and supported zoom levels without hiding actions or causing avoidable two-dimensional scrolling; horizontal grid scrolling remains available when the result shape requires it.
- Desktop and web Playwright suites cover the complete builder flow, restoration, external text updates, connection changes, query execution, results inspection/restoration, CSV/JSON export, and query-plan execution using Lit entries.
- Large object/field lists, large and wide result sets, first render, tab restoration, memory behavior, and minified/gzip bundle sizes meet the Story 1 budgets or have an approved exception with measurements.
- Repeated mount, hide/restore, driver failure, and disposal scenarios demonstrate one Effect runtime per webview, bounded fiber counts, interruption of obsolete work, and execution of all scoped finalizers.
- Multi-org tests prove that catalog-backed object/field metadata is isolated by org, relevant invalidation reaches the builder, stale prior-org responses cannot update the Lit state, and the webview performs no direct metadata network request.
- The UI package, builder adapter, and results entry/adapter pass compile, lint, unit/component tests, package checks, and CSP verification.

**Depends on:** Stories 5–14.

### Story 16 — Cut over both webviews and remove legacy UI assets

**Type / size:** Release / L

**Story:** As a maintainer, I want Lit to be the only SOQL Builder and query-results shell so that the extension no longer carries duplicate UI frameworks or an untyped legacy results controller.

**Acceptance criteria:**

- Lit becomes the default builder and query-results entry after Stories 1–15 pass their gates; experimental switches and spike-only HTML/bundle entries are removed.
- LWC components and templates, `lwcUtils`, the custom select, LWC Jest setup/configuration, and migrated LWC tests are deleted.
- `@lwc/*`, LWC lint packages, and LWC-only Rollup/Babel aliases, plugins, and compatibility workarounds are removed when no longer used by the SOQL package.
- `queryDataViewController.js`, the save SVG if no longer needed, and obsolete results CSS/HTML scaffolding are removed. Tabulator runtime and base style assets remain packaged for the Lit wrapper.
- Remaining framework-neutral services and tests are placed in production-owned locations with no stale `querybuilder` LWC module aliases; Tabulator-specific access is confined to the typed results-grid adapter and asset wiring.
- JSforce-derived webview metadata aliases and duplicate metadata acquisition/cache code are removed. The final builder retains one browser DTO/Schema at the message boundary and the extension retains the catalog-backed metadata authority.
- Transitional callback host facades, component-local Effect runners, and duplicate runtime wiring are removed; each production webview has one composition-root-owned managed runtime and Effect driver layer.
- `retainContextWhenHidden` is retained only if measurements show it remains necessary for the Lit grid, with the reason documented; otherwise it is removed.
- Contributor documentation, architecture notes, verification commands, screenshots, package metadata, and release notes describe both Lit webviews as the supported implementations.
- The VSIX includes only production Lit assets plus the required Tabulator runtime/styles, desktop and web release gates pass, and a clean dependency/install/build verifies that no generated LWC artifact is masking a missing source.
- The last legacy-default commit and rollback procedure for both webviews are recorded before merge.

**Depends on:** Stories 1–15.

## Recommended Delivery Slices

1. Stories 1–4: parity gates, production builder/Effect foundation, full Effect driver contract, and browser test harness.
2. Stories 5–7: From, Fields, Limit, and All Rows.
3. Stories 8–9: actions, progress, notifications, and query preview.
4. Story 10: Where editor as a dedicated high-risk pull request or short sequence of stacked pull requests.
5. Story 11: Order By plus full query restoration coverage.
6. Story 12: typed Lit query-results shell, Effect driver, state restoration, and export actions.
7. Story 13: typed Lit Tabulator wrapper, VS Code-token styling, lifecycle, performance, and grid parity.
8. Story 14: migrate desktop/web E2E workflows and styling coverage away from LWC and Tabulator DOM contracts.
9. Story 15: cross-cutting accessibility, theme, performance, desktop, and web hardening.
10. Story 16: cutover, legacy asset removal, documentation, and release rollback record.

Builder and query-results work may proceed in parallel after Stories 1 and 4. Each slice keeps the corresponding legacy entry available until Story 16 and includes its own production tests. A slice is not accepted based only on the final end-to-end suite.

## GitHub Stacked PR Delivery Strategy

Use the repository's installed `github/gh-stack` extension with `develop` as the explicit trunk. Do not create one 16-story stack. Complete and land a short stack at each architectural or demonstrable-product boundary, then start the next stack from the updated `develop` branch. This limits cascading rebases, keeps each PR independently understandable, and allows builder and query-results work to proceed as separate stacks after their shared foundation lands.

A user story is a planning outcome, not necessarily one PR. Large stories may span multiple stack layers, while a layer may combine only tightly coupled acceptance criteria that cannot be reviewed or verified meaningfully in isolation. Every layer must compile, preserve the legacy-default behavior until Story 16, and pass the quality gates relevant to its diff.

| Stack | PR layers, bottom to top | Stories | Boundary or demo |
| --- | --- | --- | --- |
| 1. Baseline and production foundation | Baselines and migration gates; lift the private UI package and production/migration packaging without the example Node server; production naming plus scoped Effect runtime/lifecycle | 1–2 | Mergeable foundation with no default UI change |
| 2. Effect driver and browser harness | Browser-safe state/action/error and metadata DTO/Schema contracts; VS Code driver plus catalog-backed metadata authority; deterministic browser harness and fake Effect layers | 3–4 | Stable contract and test boundary for all feature work |
| 3. Builder core-controls demo | From; Fields; Limit and All Rows | 5–7 | First management-ready Lit builder demo |
| 4. Builder actions and feedback | Run Query and Query Plan actions/progress; notifications and query preview | 8–9 | First end-to-end Lit builder demo using the legacy results view |
| 5. Builder clauses | Where typed-value/operator foundation; repeatable Where rows, AND/OR, restoration, and cancellation; Order By | 10–11 | Complete builder feature parity before hardening |
| 6. Lit query results | Results Effect shell, state restoration, and exports; Tabulator typed adapter and scoped lifecycle; VS Code-token theme, accessibility, and grid performance | 12–13 | Lit builder/results product demo; may run in parallel with Stacks 3–5 after Stack 2 lands |
| 7. Release convergence | Lit-targeted E2E migration; cross-runtime hardening; default-entry and VSIX cutover; legacy UI removal, documentation, and rollback record | 14–16 | Release-ready Lit-only implementation |

Operational rules:

- Initialize each new stack non-interactively with an explicit trunk and bottom branch, for example `gh stack init --base develop <bottom-branch>`.
- Add a named branch for each PR layer with `gh stack add <branch>`. Branch names should describe the review unit rather than only repeat the epic name.
- Submit new PRs as drafts with `gh stack submit --auto`; mark a layer ready only after its own verification is green and its lower layers are reviewable.
- Use `gh stack rebase` for cascading local rebases after lower-layer changes and `gh stack sync` to fetch, rebase, push, and synchronize PR bases/state. Never bypass repository hooks or quality gates during a stack rebase.
- Keep each active stack to two through four PRs where practical. Split a large story such as Where, Tabulator, or cutover across cohesive layers rather than allowing a single review to absorb the entire story.
- After a stack lands, run `gh stack sync --prune`, update local `develop`, and initialize the next stack from that new trunk. Do not extend a completed stack with the next delivery slice.
- Builder and query-results stacks are independent siblings after Stack 2. Do not place results work above unfinished builder clauses merely to keep everything in one linear chain.
- Story 14 starts only after the builder and results stacks it validates have landed. Story 16's cutover and cleanup layers remain adjacent in the same final stack so reviewers can evaluate the complete release transition.
- Each PR body identifies its GUS story or story subset, the lower stack dependency, legacy/Lit artifact behavior, verification commands, and the demo increment it enables.

## Verification Commands

From the repository root:

```bash
npm run compile --workspace salesforcedx-vscode-services
npm test --workspace salesforcedx-vscode-services
npm run compile --workspace salesforcedx-vscode-soql
npm run compile --workspace @salesforce/soql-builder-ui
npm run lint --workspace @salesforce/soql-builder-ui
npm test --workspace @salesforce/soql-builder-ui
npm run lint --workspace salesforcedx-vscode-soql
npm test --workspace salesforcedx-vscode-soql
npm run test:soql-builder-ui --workspace salesforcedx-vscode-soql
npm run test:query-results-ui --workspace salesforcedx-vscode-soql
npm run test:ui-bundle-budgets --workspace salesforcedx-vscode-soql
npm run test:lit-spike --workspace salesforcedx-vscode-soql
npm run test:web --workspace salesforcedx-vscode-soql
npm run test:desktop --workspace salesforcedx-vscode-soql
```

`test:soql-builder-ui` is the LWC parity command until Story 16. `test:query-results-ui` locks down the legacy results protocol until the Lit test variants are added. `test:ui-bundle-budgets` measures the builder, first-party results shell, and retained Tabulator assets independently. Story 2 or Story 4 should rename `test:lit-spike` to a production Lit component/integration test command, and Story 12 should extend the results command with the Lit entry. The last two E2E commands are release-gate checks; Story 14 makes the Lit-targeted builder and results variants mandatory, and they may require the repository's normal browser/desktop test environment. Detailed thresholds and capture procedures live in `packages/salesforcedx-vscode-soql/docs/soql-ui-migration-baseline.md`.

## Definition of Done

- Feature parity for all current SOQL Builder and query-results workflows.
- Correct light, dark, high-contrast, and high-contrast-light rendering across both webviews.
- Keyboard navigation, visible focus, form labels, alerts, grid semantics, pagination, and export actions meet VS Code accessibility expectations.
- Desktop and web-extension builds pass.
- Builder and query-results E2E tests target Lit through roles, labels, and shared helpers, with no remaining reliance on LWC or Tabulator DOM/styling selectors in feature scenarios.
- No regression in document round-tripping, saved state, telemetry, query execution, query-plan execution, result counts/flattening, pagination, sorting, grouped headers, scrolling, or CSV/JSON exports.
- Object and field metadata use the extension-side catalog-backed services as their sole authority, normalized payloads are validated at the browser boundary, org isolation/invalidation is tested, and neither webview contains a competing metadata connection or cache.
- Large object/field lists and large/wide result sets remain responsive and do not materially regress memory, first-render time, or tab restoration.
- Builder and results production bundle sizes have agreed budgets and are measured using the same minified/gzip method as their baselines.
- `@salesforce/soql-builder-ui` is consumed as a private workspace dependency without importing VS Code APIs, and its `package.json` contains `"private": true` so CI publication jobs skip it.
- LWC dependencies, templates, tests, build plugins, and compatibility workarounds are removed.
- The plain JavaScript query-results controller and obsolete styling are removed; Tabulator is retained only behind the typed Lit wrapper and a VS Code-token theme layer.
- Both Lit webviews, their Effect drivers, scoped runtimes, and framework-neutral controllers are type-checked by repository quality gates.

## Rollback Strategy

Until final cutover, disable `salesforcedx-vscode-soql.experimental.useLitSpike` to return to the LWC builder and keep the legacy query-results entry selectable through the migration toggle introduced by Story 12. During cutover, record the last legacy-default commit for both webviews so a release can revert either entry-point change without reverting unrelated model, query, export, or extension-host work.
