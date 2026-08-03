# Org Browser React Webview Replacement

## Status

Implementation complete on the current branch; manual desktop and web validation remains.

The renderer changed from the originally proposed LWC implementation to React. Standalone LWC does not provide the
tree, virtualization, or accessibility primitives required here. React and TanStack Virtual provide the rendering and
windowing foundation while the extension retains ownership of the metadata model and behavior.

## Architecture

- `OrgBrowserModel` owns catalog-backed discovery, hierarchy projection, presence and manageable-state filtering,
  visible retrieval membership, and explicit refresh.
- `OrgBrowserWebviewProvider` owns the VS Code webview lifecycle, localized projections, catalog notification
  coalescing, target-org transitions, overwrite/retrieve operations, and Effect spans. Expansion state restored via
  normal expand messages, filter persistence atomic in single workspace state write.
- The schema-validated protocol carries serializable nodes, filters, loading/error states, and versioned view state.
- The React application owns only presentation and interaction via `useOrgBrowserState` hook. React state initialization
  deferred to next tick after UI render to allow stable restore. No Salesforce connection or service calls.
- `sf-org-metadata:` and `OrgMetadataCatalog` public APIs are unchanged.

## Completed

- [x] Replace the `sfdxOrgBrowser` native tree contribution with a `WebviewViewProvider`.
- [x] Remove `MetadataTypeTreeProvider`, `OrgBrowserTreeItem`, and tree-only adapters.
- [x] Preserve Type → component, foldered metadata, and Custom Object → Custom Field hierarchy.
- [x] Preserve presence filtering, manageable-state filtering, field detail labels, overwrite confirmation, and
  single/type-level retrieval.
- [x] Preserve exact, wildcard, regex, and cross-type filter grammar with a 150 ms debounce.
- [x] Keep filtering cache-only while allowing explicit expansion to acquire unresolved inventory.
- [x] Add Refresh All, per-node refresh/retrieve, Collapse All, presence toggles, filtering, and empty/error/loading
  states inside the webview.
- [x] Add stable generations and ignore stale or malformed webview messages.
- [x] Coalesce catalog updates using stable node IDs; expand nodes on restore via message flow.
- [x] Partition expansion, selection, focus, and scroll state by org; discard missing nodes on restore.
- [x] Atomically persist filter state in single workspace write instead of 6 sequential writes.
- [x] Log protocol decode failures for debugging webview communication issues.
- [x] Add fixed-height virtual windowing with overscan, native tree keyboard behavior, type-ahead navigation, and ARIA
  tree metadata.
- [x] Bundle local React assets for desktop and web extension hosts under `dist/org-browser-ui` with a restrictive CSP.
- [x] Retain command IDs as compatibility bridges and remove native tree menus and `viewsWelcome` content.
- [x] Update the Playwright page object and Org Browser filter scenarios to target the webview DOM.
- [x] Add model, filter/protocol, CSP, React control/state, accessibility, and large-inventory windowing tests.
- [x] Update the repository package-json lint rule so menu-free webview views are valid contributions.

## Verification

- Host TypeScript compilation
- React UI TypeScript compilation
- Host Jest
- React Jest
- Extension node/web bundling
- Circular-dependency check and package lint
- Repository Effect diagnostics
- ESLint local-rule test suite

## Remaining Manual Validation

- Run the updated Org Browser scenarios against a scratch org in both desktop and web extension hosts.
- Confirm packaged VSIX asset loading on desktop.
- Capture replacement walkthrough screenshots from the final rendered UI.
