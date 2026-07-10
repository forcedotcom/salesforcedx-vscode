# Org Browser text filter with wildcard & regex support (W-23237574)

## Context

Part of the "IDEx - Org Browser: View Filters" epic. Sibling stories: W-23296072
(showLocal/showOrg toggle filters, shipped) and W-23237576 (filter state persistence
across reload, implemented).

Initial implementation used substring matching. Enhanced to support wildcard patterns (`*`) 
and regex (`/pattern/`), with guardrailed component pre-fetching (25-type threshold + 
confirmation prompt for broad fetches).

## Goal

Add freeform QuickPick text filter supporting wildcard patterns (`*`), regex (`/pattern/` delimiters), 
and confirmation prompts for expensive metadata fetches. Tree filters in real-time as you type.
Examples: `Apex*` (types starting with Apex), `/Apex.*/:/File.*/` (regex: Apex types with File components),
`Apex*:File*` (wildcard: Apex types with File-named components).

## Non-goals

- `@tag` state filtering (`@modified`, `@deleted`, etc.)
- Auto-appending `:` when a type suggestion is selected
- A `TreeView.description` label showing the current filter text in the view title

## UX

**Trigger:** toolbar icon in the Org Browser view, alongside existing showLocal/showOrg
toggles. Uses codicon `$(filter)` when inactive, `$(filter-filled)` when active,
swapped via `sf:orgBrowser.textFilterActive` context key. Context key is true when either 
typeFilter or componentFilter is active (component-only filters like `:MyComponent` count as active).
Context key updates in real-time as user types in the live filtering stream, enabling immediate
toolbar icon and message visibility without requiring commit.

Clicking opens QuickPick (`sfdxOrgBrowser.filterText`) in freeform mode with live filtering.
If a filter is active, QuickPick pre-populates with current filter text for editing.

**Input format:**
- **Wildcard mode (default):** `*` matches any characters. `Apex*` matches ApexClass/ApexPage/ApexTrigger.
- **Regex mode (opt-in):** `/pattern/` delimiters; full regex syntax (`.`, `*`, `?`, `|`, `[]`, etc.).
  - `/Apex.*/` matches types starting with Apex; invalid patterns → no matches (safe).
- **Type:Component:** Apply both patterns independently via AND.
  - Wildcard: `Apex*:File*` → Apex types with File-named components.
  - Regex: `/Apex.*/:/File.*/` → Apex types with File-named components (regex).
  - Mixed: `Apex*:/File.*/` → Apex types (wildcard) with File components (regex).
- **Convenience:** `:Component` → `*:Component` (type filter omitted defaults to match-all).
- Empty input clears the filter.

**Live filtering:**
- Tree updates as you type with 150ms debounce.
- Context key (`sf:orgBrowser.textFilterActive`) updates in real-time, showing empty-tree message immediately without commit.
- Clean text input field (no suggestion dropdown).
- Accept any freeform text input.

**Matching logic:**
- Wildcard: case-insensitive exact/substring; `*` expands to regex `.*`.
  - `ApexClass` → exact; `Apex*` → starts with; `*Class` → ends with; `Apex*:Test*` → both.
- Regex: full case-insensitive pattern syntax. `/Apex.*/` → starts with Apex; `/Apex.*/:/File.*/` → both.
- Invalid regex → no matches (safe failure, not errors).

**Commit / cancel semantics:**
- Enter: apply filter text (including empty value to clear).
- Escape: revert to pre-open filter state, including regex flags (no change).

## Data model / state

Fields on `MetadataTypeTreeProvider`:

```ts
private _typeFilter: string | undefined;              // pattern before ':'
private _componentFilter: string | undefined;         // pattern after ':'
private _typeIsRegex = false;                         // true if /pattern/ syntax
private _componentIsRegex = false;                    // true if /pattern/ syntax
private _userApprovedBroadFetch = false;              // user approved >25-type fetch
```

```ts
public setTextFilter(
  typeFilter: string | undefined,
  componentFilter: string | undefined,
  typeIsRegex = false,
  componentIsRegex = false,
  userApprovedBroadFetch = false
): void {
  this._typeFilter = typeFilter;
  this._componentFilter = componentFilter;
  this._typeIsRegex = typeIsRegex;
  this._componentIsRegex = componentIsRegex;
  this._userApprovedBroadFetch = userApprovedBroadFetch;
  this._onDidChangeTreeData.fire(undefined);
}
```

Persisted to `workspaceState` (keys: `orgBrowser.{typeFilter, componentFilter, typeIsRegex, componentIsRegex}`);
restored on activation. `userApprovedBroadFetch` is runtime-only, reset per filter change.

**Match rule:**
- Wildcard: case-insensitive; `*` → `.*` in regex.
- Regex: full pattern (case-insensitive); invalid → no matches.
- Colon: type AND component must both match.

## Filtering logic

Text filter composes with showLocal/showOrg as AND — all filters must pass for visibility.

**Helper functions:**

```ts
const matchesPattern = (text: string, pattern: string, isRegex = false): boolean => {
  if (isRegex) {
    const regex = safeRegex(pattern); // safe; invalid patterns → undefined
    return regex ? regex.test(text) : false;
  }
  // Wildcard mode: exact or substring
  if (!pattern.includes('*')) return text.toLowerCase() === pattern.toLowerCase();
  return wildcardToRegex(pattern).test(text);
};
```

**Root level** (`getChildrenOfTreeItem`, no `element`): After showLocal/showOrg filtering, apply type filter:

```ts
const passesTypeFilter = (node: OrgBrowserTreeItem, provider: MetadataTypeTreeProvider): boolean =>
  !provider.typeFilter || matchesPattern(node.xmlName, provider.typeFilter, provider.typeIsRegex);
```

When component filter active, conditionally fetch or use cache:

1. **Under threshold (≤25 types) or user approved:**
   - `filterTypesWithMatchingComponents()` → full fetch all types' metadata, check for matches.
2. **Over threshold (>25 types) + not approved:**
   - Show confirmation prompt: "%s metadata types matched. Fetch components for all of them?"
   - On approval: set `userApprovedBroadFetch = true`, trigger full fetch.
   - On denial: use `filterTypesWithCachedComponents()` (cache-only, strict).

```ts
const filterTypesWithMatchingComponents = (...) => 
  // Fetch all types' components, filter to those with matches
  
const filterTypesWithCachedComponents = (...) =>
  // Filter cache-only; types without cache → excluded
```

**AND logic:** When both type and component filters active:
1. Type filter: types matching pattern.
2. Component pre-filter: from those types, keep only those with ≥1 matching component.
3. Fetch strategy: <25 types → full fetch; >25 types → prompt → cache-only if denied.

**Component level** (type-expansion children): Apply component filter via `applyViewModeChildFilter()`:

```ts
const applyViewModeChildFilter = (
  nodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider
): OrgBrowserTreeItem[] => {
  // Apply showLocal/showOrg filtering first...
  if (!provider.componentFilter || provider.componentFilter === '') return viewModeFiltered;
  return viewModeFiltered.filter(
    n => n.componentName && matchesPattern(n.componentName, provider.componentFilter, provider.componentIsRegex)
  );
};
```

## Commands / package.json contributions

Two command IDs, both opening the same QuickPick (matching `showLocal.on`/`showLocal.off` pattern):
- `sfdxOrgBrowser.filterText` — icon `$(filter)`, shown when `sf:orgBrowser.textFilterActive == false`.
- `sfdxOrgBrowser.filterText.active` — icon `$(filter-filled)`, shown when `sf:orgBrowser.textFilterActive == true`.
- `view/title` menu contributions positioned alongside showLocal/showOrg/refresh/collapseAll.
- `package.nls.json` entries for command titles.

Handler in `index.ts` (function `openFilterTextPicker`):
1. Snapshot `previousTypeFilter`/`previousComponentFilter`.
2. Create QuickPick with suggestions (type names from metadata).
3. Attach handlers:
   - `onDidChangeValue`: queue text changes to live-filter stream (150ms debounce).
   - `onDidAccept`: commit `picker.value` (accept any text, not just selected items).
   - `onDidHide`: revert to pre-open filter state if not committed.
4. On accept: call `treeProvider.setTextFilter()`, persist to `workspaceState`, update context key.
5. On cancel (Escape): restore previous filter state (revert).

## Testing

Playwright spec: `packages/salesforcedx-vscode-org-browser/test/playwright/specs/orgBrowser.textFilter.headless.spec.ts`.

Cases:
- Toolbar icon visible/filled swap on filter commit/clear.
- Wildcard patterns: `Apex*` narrows tree; `Apex*:File*` filters both type and component.
- Regex patterns: `/Apex.*/` matches types starting with Apex; `/Apex.*/:/File.*/` filters both.
- Escape reverts to pre-open state; empty input on Enter clears filter.
- Text filter ANDs with showLocal/showOrg toggles.
- Filter state persists across window reload (including regex flags).
- Confirmation prompt appears when component filter matches >25 types (MAX_TYPES_FOR_COMPONENT_PREFETCH).

## Implementation notes

**QuickPick in freeform mode:** Live filtering (150ms debounce). Any text accepted; tree updates as-you-type.

**Pattern parsing:** `parsePattern(input)` → `{pattern, isRegex}`. Detects `/pattern/` delimiters; if absent, falls back to wildcard mode.
- `/Apex.*/` → regex; `Apex*` → wildcard.
- `parseFilterValue(value)` splits at first unescaped `:` into type/component, parsing each with `parsePattern`.

**Matching:** `matchesPattern(text, pattern, isRegex)` — delegates to regex or wildcard-to-regex conversion.
- Regex mode: safe (invalid → undefined → no matches; no errors thrown).
- Wildcard: exact/substring, `*` expands to `.*`.

**Live filtering stream:** Queue + 150ms debounce + stream processor → `treeProvider.setTextFilter()` + context key update.
Staggers tree updates without blocking picker. Context key updates synchronously with filter changes,
enabling real-time toolbar icon swap and empty-tree message visibility.

**Guardrailed broad-fetch:** At 3 root filter sites:
1. Count type nodes passing type filter.
2. If component filter active:
   - ≤25 types → full fetch all.
   - >25 types → prompt user.
   - User approves → full fetch; deny → cache-only (strict).

**Persistence:** Regex flags (`typeIsRegex`, `componentIsRegex`) saved to `workspaceState` alongside filter text; restored on activation and on Escape (revert to pre-open state).
