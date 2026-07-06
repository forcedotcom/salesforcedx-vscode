# Org Browser QuickPick text filter (W-23237574)

## Context

Part of the "IDEx - Org Browser: View Filters" epic. Sibling stories: W-23296072
(showLocal/showOrg toggle filters, shipped) and W-23237576 (filter state persistence
across reload, not started — persistence is explicitly out of scope here).

A proof-of-concept exists on branch `phale/org-browser-experiment`, commit
`21a06f93d` ("live QuickPick filter with suggestions and preview tab cleanup").
This design ports that commit's `Type:Component` text-filter behavior into the
current codebase, adapted to the present tree provider shape. A later commit on
that branch (`ffca17eef`) added `@tag` change-state filtering — explicitly excluded
from this story; it depends on sync-state tracking that doesn't exist in the
current codebase and isn't mentioned in this story's title.

## Goal

Add a QuickPick-driven text filter to the Org Browser tree, with live preview as
the user types, supporting a `Type:Component` syntax (e.g. `ApexClass:MyClass`
filters to components of type `ApexClass` whose name contains `MyClass`).

## Non-goals

- `@tag` state filtering (`@modified`, `@deleted`, etc.)
- Persisting the text filter to `workspaceState` across reload/restart (left to
  W-23237576)
- Auto-appending `:` when a type suggestion is selected
- A `TreeView.description` label showing the current filter text in the view title

## UX

**Trigger:** one toolbar icon in the Org Browser view, alongside the existing
showLocal/showOrg toggles. Uses codicon `$(filter)` when inactive and
`$(filter-filled)` when a filter is active, swapped via a `sf:orgBrowser.textFilterActive`
context key — the same pattern already used for `showLocal.on`/`showLocal.off`.

Clicking the icon always opens the same QuickPick command
(`sfdxOrgBrowser.filterText`); there is no separate "clear" command/icon. If a
filter is currently active, the picker opens pre-populated with that filter's
text so the user can edit or delete it.

**Suggestions while typing** (before commit, live in the QuickPick's item list):
- No colon in the input: items are metadata type names (from `describe()`)
  case-insensitively matching the typed substring.
- Colon present (`Type:` typed): the part before the colon is resolved to a real
  type name (case-insensitive match against the cached type list, or used
  literally if unresolved); items become that type's component names (fetched via
  `treeProvider.getChildren`), narrowed by the substring typed after the colon.
- If the part before the colon doesn't resolve to any known type, the item list is
  simply empty (no components to suggest) and the live tree preview updates to an
  empty result. No separate validation message is shown — the empty tree/list is
  the feedback. (`QuickPick.validationMessage` doesn't exist on this repo's pinned
  `@types/vscode@1.90.0`, which only has it on `InputBox`; not worth bumping a
  shared dependency for this.)

**Live tree preview:** debounced 150ms. Below 3 characters (and no colon), the
type-level filter is not applied — the tree shows all types (matches existing
POC behavior; avoids filtering to near-nothing while the user is starting to type).
At 3+ characters or once a colon is present, the tree filters live using the same
resolution rules as the suggestion list.

**Commit / cancel semantics** (resolves an ambiguity the POC didn't handle
cleanly):
- `onDidAccept` (Enter): commit the current value as the active filter — including
  an empty value, which clears the filter entirely. Close the picker.
- `onDidHide` without accept (Escape or focus-loss): always revert the tree to
  whatever filter was active *before this picker session opened* — Escape is a
  pure cancel, it can never be used to clear an active filter. To clear a filter,
  the user must delete the text and press Enter on the empty value.

No `TreeView.description` or other persistent hover text is added; the
filled/unfilled icon state is the only always-visible signal that a filter is
active.

## Data model / state

New fields on `MetadataTypeTreeProvider` (`packages/salesforcedx-vscode-org-browser/src/tree/metadataTypeTreeProvider.ts`),
mirroring the existing `_showLocal`/`_showOrg` pattern:

```ts
private _typeFilter: string | undefined;      // text typed before ':' — see match rule below
private _componentFilter: string | undefined; // substring typed after ':'; undefined until a colon exists in the input
```

```ts
public setTextFilter(typeFilter: string | undefined, componentFilter: string | undefined): void {
  this._typeFilter = typeFilter;
  this._componentFilter = componentFilter;
  this._onDidChangeTreeData.fire(undefined);
}

public clearTextFilter(): void {
  this.setTextFilter(undefined, undefined);
}
```

In-memory only — no `workspaceState` read/write for this story.

**Match rule for `_typeFilter`** (resolved via the presence of `_componentFilter`,
not a separate boolean — a colon in the input is exactly what puts `_componentFilter`
in the defined state, even as `''` when nothing follows the colon yet):
- No colon typed yet (`_componentFilter === undefined`): `_typeFilter` is matched as
  a case-insensitive **substring** against each type's `xmlName` — narrows to every
  type whose name contains what's been typed so far (e.g. `"Apex"` keeps
  `ApexClass`, `ApexTrigger`, `ApexPage`, ...). This matches the suggestion list
  and mirrors the POC's `Set<string>` multi-type model.
- Colon typed (`_componentFilter` is a string, possibly `''`): `_typeFilter` holds
  the single type name — resolved case-insensitively against the cached type list
  by the `index.ts` QuickPick handler before calling `setTextFilter`, or used
  literally if unresolved — and is matched as a case-insensitive **exact** match
  against `xmlName`. This narrows the root to at most one type.

## Filtering logic

The text filter is a second, independent filter that composes with showLocal/showOrg
as an AND — i.e. a node must pass both the existing local/org filter AND the new
text filter to be visible. This matches how the POC's `applyChildFilters` composed
`viewMode` and `componentFilter`.

**Root level** (`getChildrenOfTreeItem`, no `element`): after the existing
showLocal/showOrg filtering produces `allNodes` (or the subset from local/org
logic), if `_typeFilter` is set, further filter using the match rule above:

```ts
const passesTypeFilter = (node: OrgBrowserTreeItem, provider: MetadataTypeTreeProvider): boolean => {
  if (provider.typeFilter === undefined) return true;
  const lower = provider.typeFilter.toLowerCase();
  return provider.componentFilter !== undefined
    ? node.xmlName.toLowerCase() === lower // colon present: exact match, single type
    : node.xmlName.toLowerCase().includes(lower); // no colon yet: substring match, multiple types
};
```

**Component level** (`applyViewModeChildFilter`, used for both type-expansion and
folder-item children): extend the existing function (or add a sibling filter
applied after it) so that if `_componentFilter` is set (including `''`, which is a
no-op since every string `.includes('')`), nodes are further filtered to
`n.componentName?.toLowerCase().includes(_componentFilter.toLowerCase())`.

## Commands / package.json contributions

Two command ids, both invoking the same picker-opening logic, matching the
existing `showLocal.on`/`showLocal.off` precedent exactly (one command per icon
state, swapped via `when`, rather than one command with a dynamically-changing
icon):
- `sfdxOrgBrowser.filterText` — icon `$(filter)`, shown when
  `sf:orgBrowser.textFilterActive == false`.
- `sfdxOrgBrowser.filterText.active` — icon `$(filter-filled)`, shown when
  `sf:orgBrowser.textFilterActive == true`.
- `view/title` menu contributions for both, gated on `sf:orgBrowser.textFilterActive`,
  positioned in the existing `navigation@N` toolbar ordering alongside
  showLocal/showOrg/refresh/collapseAll.
- `package.nls.json` entries for both command titles.

Handler in `index.ts`, following the `registerCommandWithRuntime` /
`getOrgBrowserRuntime()` pattern used for all other commands in this file:
1. Snapshot `previousTypeFilter`/`previousComponentFilter` from the tree provider.
2. Fetch cached type names via `MetadataDescribeService.describe()` (already
   cached 30 min server-side — safe to call on every picker open).
3. Wire `createQuickPick()`, `onDidChangeValue` (debounced 150ms, per the rules
   above), `onDidAccept`, `onDidHide` as described in UX section.
4. On accept, call `treeProvider.setTextFilter(...)` or `clearTextFilter()` and
   update the `sf:orgBrowser.textFilterActive` context key.
5. On cancel, call `treeProvider.setTextFilter(previousTypeFilter, previousComponentFilter)`
   (or leave untouched if there was nothing to revert).

## Testing

New Playwright spec `packages/salesforcedx-vscode-org-browser/test/playwright/specs/orgBrowser.textFilter.headless.spec.ts`,
modeled on `orgBrowser.filterToggle.headless.spec.ts` (same fixture setup:
`createDreamhouseOrg`, `waitForVSCodeWorkbench`, `closeWelcomeTabs`,
`upsertScratchOrgAuthFieldsToSettings`). Cases:

- Toolbar icon visible, swaps to filled state when a filter is committed.
- Typing a type name (3+ chars) live-narrows the root tree; committing keeps it
  narrowed after the picker closes.
- Typing `Type:partial` narrows both the picker's suggestion list and the
  expanded type's children to matching component names.
- An unresolved type name (with a colon typed) empties the tree.
- Escape after typing reverts the tree to its pre-open filter state.
- Deleting the text and pressing Enter clears the filter (icon reverts to
  unfilled, tree shows everything the showLocal/showOrg toggles alone would show).
- Text filter composes with an active showLocal/showOrg toggle (both apply
  simultaneously).

## Out of scope / follow-ups

- Persistence across reload → W-23237576.
- `@tag` change-state filtering → not scheduled; would need sync-state tracking
  infra first.
