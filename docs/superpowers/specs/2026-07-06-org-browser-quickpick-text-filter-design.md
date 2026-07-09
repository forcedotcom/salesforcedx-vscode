# Org Browser text filter with wildcard support (W-23237574)

## Context

Part of the "IDEx - Org Browser: View Filters" epic. Sibling stories: W-23296072
(showLocal/showOrg toggle filters, shipped) and W-23237576 (filter state persistence
across reload, implemented).

Initial implementation used a QuickPick with live preview and substring matching.
Updated to use QuickPick in freeform mode with real-time wildcard pattern filtering.

## Goal

Add a freeform QuickPick text filter to the Org Browser tree supporting wildcard
patterns with `*` (e.g. `Apex*` matches ApexClass, ApexPage, ApexTrigger; 
`Apex*:File*` filters types matching Apex* and components matching File*).
Tree filters in real-time as you type.

## Non-goals

- `@tag` state filtering (`@modified`, `@deleted`, etc.)
- Auto-appending `:` when a type suggestion is selected
- A `TreeView.description` label showing the current filter text in the view title

## UX

**Trigger:** toolbar icon in the Org Browser view, alongside existing showLocal/showOrg
toggles. Uses codicon `$(filter)` when inactive, `$(filter-filled)` when active,
swapped via `sf:orgBrowser.textFilterActive` context key.

Clicking opens QuickPick (`sfdxOrgBrowser.filterText`) in freeform mode with live filtering.
If a filter is active, QuickPick pre-populates with current filter text for editing.

**Input format:**
- Wildcard `*` matches any characters (zero or more).
- No colon: filter type names (e.g., `Apex*` matches ApexClass, ApexPage, ...).
- Colon present: `Type:Component` (e.g., `Apex*:File*` filters types matching Apex*
  and components matching File*).
- Empty input clears the filter.

**Live filtering:**
- Tree updates as you type with 150ms debounce.
- Clean text input field (no suggestion dropdown).
- Accept any freeform text input.

**Matching logic:**
- Type names matched case-insensitively; wildcards expand to regex.
- Example patterns:
  - `ApexClass` → exact type name
  - `Apex*` → types starting with Apex
  - `*Class` → types ending with Class
  - `Apex*:Test*` → types starting with Apex, components starting with Test

**Commit / cancel semantics:**
- Enter: apply filter text (including empty value to clear).
- Escape: revert to pre-open filter state (no change).

## Data model / state

Fields on `MetadataTypeTreeProvider` (`packages/salesforcedx-vscode-org-browser/src/tree/metadataTypeTreeProvider.ts`):

```ts
private _typeFilter: string | undefined;      // wildcard pattern before ':' 
private _componentFilter: string | undefined; // wildcard pattern after ':'
```

```ts
public setTextFilter(typeFilter: string | undefined, componentFilter: string | undefined): void {
  this._typeFilter = typeFilter;
  this._componentFilter = componentFilter;
  this._onDidChangeTreeData.fire(undefined);
}
```

Persisted to `workspaceState` (keys: `orgBrowser.typeFilter`, `orgBrowser.componentFilter`);
restored on activation.

**Match rule:** Wildcard patterns converted to case-insensitive regexes:
- `*` matches any characters (including none)
- No colon (`_componentFilter === undefined`): type names matched as wildcards
- Colon present (`_componentFilter` is a string): both type and component patterns matched as wildcards

## Filtering logic

Text filter composes with showLocal/showOrg as AND — node must pass both existing 
local/org filter AND text filter to be visible.

**Helper functions:** Convert wildcard patterns to case-insensitive regexes:

```ts
const wildcardToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = escaped.replace(/\\\*/g, '.*');
  return new RegExp(`^${regex}$`, 'i');
};

const matchesPattern = (text: string, pattern: string): boolean =>
  wildcardToRegex(pattern).test(text);
```

**Root level** (`getChildrenOfTreeItem`, no `element`): After showLocal/showOrg 
filtering, apply type filter if set via `passesTypeFilter()`:

```ts
const passesTypeFilter = (node: OrgBrowserTreeItem, provider: MetadataTypeTreeProvider): boolean =>
  provider.typeFilter === undefined || matchesPattern(node.xmlName, provider.typeFilter);
```

When component filter active, pre-filter types using `filterTypesWithMatchingComponents()`:

```ts
const filterTypesWithMatchingComponents = (
  typeNodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider,
  metadataDescribeService: { listMetadata: (type: string) => Effect.Effect<...> }
) => Effect.gen(function* () {
  const componentFilter = provider.componentFilter!;
  const typesWithMatchingComponents = yield* Effect.all(
    typeNodes.map(typeNode =>
      Effect.gen(function* () {
        // For folder types, list the folders themselves (e.g., ReportFolder, EmailTemplateFolder)
        const typeToList = typeNode.kind === 'folderType' ? `${typeNode.xmlName}Folder` : typeNode.xmlName;
        // List components for this type
        const components = yield* metadataDescribeService.listMetadata(typeToList);
        const hasMatch = components.some(c => c.fullName && matchesPattern(c.fullName, componentFilter));
        return { typeNode, hasMatch };
      })
    ),
    { concurrency: 10 }
  );
  return typesWithMatchingComponents.filter(t => t.hasMatch).map(t => t.typeNode);
});
```

**AND logic:** When both type and component filters active (e.g., `Apex*:File*`):
1. Type filter: include only types matching `Apex*` 
2. Component pre-filter: from those types, keep only those with ≥1 component matching `File*`
3. Result: shows types matching type filter that have at least one matching component

**Component level** (type-expansion and folder-item children): Apply component 
filter if set via `applyViewModeChildFilter()`:

```ts
const applyViewModeChildFilter = (
  nodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider
): OrgBrowserTreeItem[] => {
  // Apply showLocal/showOrg filtering first...
  if (!provider.componentFilter) return viewModeFiltered;
  const componentFilter = provider.componentFilter;
  return viewModeFiltered.filter(n => n.componentName && matchesPattern(n.componentName, componentFilter));
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

Playwright spec: `packages/salesforcedx-vscode-org-browser/test/playwright/specs/orgBrowser.textFilter.headless.spec.ts`
(fixture setup: `createDreamhouseOrg`, `waitForVSCodeWorkbench`, `closeWelcomeTabs`).

Cases:
- Toolbar icon visible, swaps to filled when filter committed.
- Wildcard patterns filter tree (e.g., `Apex*` matches ApexClass/ApexPage/ApexTrigger).
- `Type:Component` format filters both type and component (e.g., `Apex*:File*`).
- Escape reverts to pre-open filter state.
- Empty input on Enter clears filter (icon unfilled).
- Text filter composes with showLocal/showOrg toggles (AND logic).
- Filter state persists across window reload.

## Implementation notes

**QuickPick in freeform mode:** Uses QuickPick with live filtering (150ms debounce).
Type names are shown as suggestions (hints from metadata), but any text input is accepted
via `picker.value`. Supports wildcard matching (`*` for any characters). Tree updates
in real-time as you type, filtering shows live feedback before you press Enter.

**Wildcard matching:** Patterns converted to case-insensitive regexes. `*` expands
to `.*` in regex form. Example: `Apex*` becomes `/^Apex.*$/i`, matching ApexClass,
ApexPage, ApexTrigger, etc.

**Live filtering stream:** On `onDidChangeValue`, text is queued to an unbounded
Effect Queue, then piped through a debounce (150ms) and stream processor that calls
`treeProvider.setTextFilter()` for each debounced value. This allows the UI to update
the tree in real-time without blocking picker interaction.
