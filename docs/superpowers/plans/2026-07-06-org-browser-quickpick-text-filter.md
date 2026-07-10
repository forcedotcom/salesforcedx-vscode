# Org Browser Text Filter with Wildcard & Regex Support (W-23237574) Implementation Plan

> **Status:** Implementation complete. QuickPick with live filtering + regex/wildcard support + guardrailed broad-fetch confirmation.

**Goal:** Add text filter to Org Browser tree (`sfdxOrgBrowser.filterText`) supporting wildcard patterns (`*`) and regex (`/pattern/`) with confirmation prompt for expensive broad-component fetches.

**Architecture:** Filter state on `MetadataTypeTreeProvider`: `_typeFilter`, `_componentFilter`, `_typeIsRegex`, `_componentIsRegex`, `_userApprovedBroadFetch`. `setTextFilter()` accepts state fields; filtering via pattern matching in `metadataTypeTreeProvider.ts`. `index.ts` opens QuickPick, parses regex/wildcard syntax, persists to `workspaceState`. Helper functions: `filterTypesWithMatchingComponents()` (live-fetch ≤25 types), `filterTypesWithCachedComponents()` (cache-only >25 types). Confirmation prompt at 3 root filter sites.

**Tech Stack:** TypeScript, Effect-TS, VS Code Extension API (QuickPick), Playwright.

## Implementation Notes

**Pattern syntax:**
- Wildcard (default): `*` matches any chars (case-insensitive).
  - `ApexClass` → exact match; `Apex*` → starts with Apex; `*Class` → ends with Class
- Regex (opt-in): `/pattern/` delimiters; full regex syntax (`.`, `*`, `?`, `|`, `[]`, etc); invalid patterns → no matches.
  - `/Apex.*/` → types starting with Apex; `/Apex.*/:/File.*/` → Apex types w/ File-named components
- Type:Component: both patterns apply independently, joined by AND.

**Filter state & persistence:**
- Saved: `orgBrowser.{typeFilter, componentFilter, typeIsRegex, componentIsRegex}` in `workspaceState`.
- Restored on activation.

**Guardrailed broad-fetch (new):**
- When component filter matches >25 types, prompt asks for confirmation before full-fetching all types.
- Threshold: `MAX_TYPES_FOR_COMPONENT_PREFETCH = 25`.
- Under threshold or after approval: `filterTypesWithMatchingComponents()` fetches all.
- Over threshold + no approval: `filterTypesWithCachedComponents()` filters cache-only (strict — unfetched types excluded).

**Composable:** Text filter ANDs with showLocal/showOrg toggles — all must pass.

**Live context key updates:** Context key `sf:orgBrowser.textFilterActive` updates in real-time as user types in the live filtering stream (not just on commit).
Enables toolbar icon swap and empty-tree message visibility without requiring Enter press.

---

### Task 1: Pure filter-predicate helpers + state fields on `MetadataTypeTreeProvider`

**Files:**
- Modify: `packages/salesforcedx-vscode-org-browser/src/tree/metadataTypeTreeProvider.ts`
- Test: `packages/salesforcedx-vscode-org-browser/test/jest/metadataTypeTreeProvider.test.ts` (new file)

**Interfaces:**
- Produces: `MetadataTypeTreeProvider.typeFilter: string | undefined` (getter), `MetadataTypeTreeProvider.componentFilter: string | undefined` (getter), `MetadataTypeTreeProvider.setTextFilter(typeFilter: string | undefined, componentFilter: string | undefined): void`, `MetadataTypeTreeProvider.clearTextFilter(): void`. Also exports `passesTypeFilter(node: OrgBrowserTreeItem, provider: MetadataTypeTreeProvider): boolean` and extends `applyViewModeChildFilter` to also apply `_componentFilter`.
- Consumes: existing `OrgBrowserTreeItem` shape (`xmlName`, `componentName`) from `orgBrowserNode.ts` — unchanged.

- [ ] **Step 1: Write the failing tests for the new provider state**

Create `packages/salesforcedx-vscode-org-browser/test/jest/metadataTypeTreeProvider.test.ts`:

```typescript
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataTypeTreeProvider } from '../../src/tree/metadataTypeTreeProvider';

describe('MetadataTypeTreeProvider text filter state', () => {
  it('defaults to no text filter', () => {
    const provider = new MetadataTypeTreeProvider();
    expect(provider.typeFilter).toBeUndefined();
    expect(provider.componentFilter).toBeUndefined();
  });

  it('setTextFilter stores both values and fires a change event', () => {
    const provider = new MetadataTypeTreeProvider();
    const listener = jest.fn();
    provider.onDidChangeTreeData(listener);

    provider.setTextFilter('ApexClass', 'Foo');

    expect(provider.typeFilter).toBe('ApexClass');
    expect(provider.componentFilter).toBe('Foo');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clearTextFilter resets both values and fires a change event', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('ApexClass', 'Foo');
    const listener = jest.fn();
    provider.onDidChangeTreeData(listener);

    provider.clearTextFilter();

    expect(provider.typeFilter).toBeUndefined();
    expect(provider.componentFilter).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- test/jest/metadataTypeTreeProvider.test.ts` (from `packages/salesforcedx-vscode-org-browser`)
Expected: FAIL — `provider.typeFilter`/`provider.componentFilter`/`provider.setTextFilter`/`provider.clearTextFilter` do not exist (TypeScript compile errors surfaced as Jest failures).

- [ ] **Step 3: Add the new fields, getters, and `setTextFilter`/`clearTextFilter` methods to `MetadataTypeTreeProvider`**

In `packages/salesforcedx-vscode-org-browser/src/tree/metadataTypeTreeProvider.ts`, add fields after the existing `_hasOrgData` field (currently line 25) and new public members after the existing `setHasOrgData` method (currently ends line 53):

```typescript
  private _showLocal = true;
  private _showOrg = true;
  private _hasOrgData = false;
  private _typeFilter: string | undefined;
  private _componentFilter: string | undefined;
```

```typescript
  public get hasOrgData(): boolean {
    return this._hasOrgData;
  }

  public setHasOrgData(value: boolean): void {
    this._hasOrgData = value;
  }

  public get typeFilter(): string | undefined {
    return this._typeFilter;
  }

  public get componentFilter(): string | undefined {
    return this._componentFilter;
  }

  public setTextFilter(typeFilter: string | undefined, componentFilter: string | undefined): void {
    this._typeFilter = typeFilter;
    this._componentFilter = componentFilter;
    this._onDidChangeTreeData.fire(undefined);
  }

  public clearTextFilter(): void {
    this.setTextFilter(undefined, undefined);
  }
```

Persisted to `workspaceState` on change; restored on provider init.

- [ ] **Step 4: Run the tests again to verify the state tests pass**

Run: `npm run test -- test/jest/metadataTypeTreeProvider.test.ts`
Expected: PASS for the `MetadataTypeTreeProvider text filter state` describe block (3 tests).

- [ ] **Step 5: Write the failing tests for `passesTypeFilter`**

Add to the top of `metadataTypeTreeProvider.test.ts`, changing the import line and adding a new `describe` block after the existing one:

```typescript
import { MetadataTypeTreeProvider, passesTypeFilter } from '../../src/tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem } from '../../src/tree/orgBrowserNode';
```

```typescript
const typeNode = (xmlName: string): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({ kind: 'type', xmlName, label: xmlName });

describe('passesTypeFilter', () => {
  it('passes everything when no type filter is set', () => {
    const provider = new MetadataTypeTreeProvider();
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('ApexTrigger'), provider)).toBe(true);
  });

  it('substring-matches (case-insensitive) when no colon has been typed', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('apex', undefined);
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('ApexTrigger'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('CustomObject'), provider)).toBe(false);
  });

  it('exact-matches (case-insensitive) once a colon has been typed, even with an empty component filter', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('apexclass', '');
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('ApexTrigger'), provider)).toBe(false);
  });
});
```

Place the `typeNode` helper and the new `describe` block above the existing `MetadataTypeTreeProvider text filter state` block, or below it — either order is fine as long as `typeNode` is declared before first use.

- [ ] **Step 6: Run the tests to verify the new ones fail**

Run: `npm run test -- test/jest/metadataTypeTreeProvider.test.ts`
Expected: FAIL on the three new tests — `passesTypeFilter` is not exported yet.

- [ ] **Step 7: Add the `passesTypeFilter` helper**

Add this function in `metadataTypeTreeProvider.ts` immediately above `applyViewModeChildFilter` (currently starting at line 93):

```typescript
export const passesTypeFilter = (node: OrgBrowserTreeItem, provider: MetadataTypeTreeProvider): boolean => {
  if (provider.typeFilter === undefined) return true;
  const lower = provider.typeFilter.toLowerCase();
  return provider.componentFilter !== undefined
    ? node.xmlName.toLowerCase() === lower
    : node.xmlName.toLowerCase().includes(lower);
};
```

- [ ] **Step 8: Run the tests again to verify they pass**

Run: `npm run test -- test/jest/metadataTypeTreeProvider.test.ts`
Expected: PASS — 6 tests total (3 state + 3 `passesTypeFilter`).

- [ ] **Step 9: Write the failing tests for component-level filtering**

Add to `metadataTypeTreeProvider.test.ts`: extend the import line, add a `componentNode` helper, and a new `describe` block.

```typescript
import { MetadataTypeTreeProvider, passesTypeFilter, applyViewModeChildFilter } from '../../src/tree/metadataTypeTreeProvider';
```

```typescript
const componentNode = (xmlName: string, componentName: string): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({ kind: 'component', xmlName, componentName, label: componentName });

describe('applyViewModeChildFilter with component filter', () => {
  it('passes all nodes when componentFilter is undefined', () => {
    const provider = new MetadataTypeTreeProvider();
    const nodes = [componentNode('ApexClass', 'FooBar'), componentNode('ApexClass', 'Baz')];
    expect(applyViewModeChildFilter(nodes, provider)).toEqual(nodes);
  });

  it('substring-matches componentName case-insensitively when componentFilter is set', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('ApexClass', 'foo');
    const foo = componentNode('ApexClass', 'FooBar');
    const baz = componentNode('ApexClass', 'Baz');
    expect(applyViewModeChildFilter([foo, baz], provider)).toEqual([foo]);
  });

  it('treats an empty componentFilter as a no-op (colon typed, nothing after it yet)', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('ApexClass', '');
    const nodes = [componentNode('ApexClass', 'FooBar'), componentNode('ApexClass', 'Baz')];
    expect(applyViewModeChildFilter(nodes, provider)).toEqual(nodes);
  });
});
```

- [ ] **Step 10: Run the tests to verify the new ones fail**

Run: `npm run test -- test/jest/metadataTypeTreeProvider.test.ts`
Expected: FAIL on the three new tests — `applyViewModeChildFilter` is not exported yet, and even once exported it doesn't apply a component filter.

- [ ] **Step 11: Export `applyViewModeChildFilter` and extend it with the component-name filter**

In `metadataTypeTreeProvider.ts`, change the function to be exported and add the component-filter pass:

```typescript
export const applyViewModeChildFilter = (
  nodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider
): OrgBrowserTreeItem[] => {
  const viewModeFiltered = ((): OrgBrowserTreeItem[] => {
    if (provider.showLocal === provider.showOrg) return nodes; // both-on or both-off: no filter
    if (provider.showLocal && !provider.showOrg) {
      return nodes.filter(n => n.filePresent === true);
    }
    // orgOnly: keep only components without local files
    return nodes.filter(n => n.filePresent !== true);
  })();

  if (!provider.componentFilter) return viewModeFiltered;
  const lower = provider.componentFilter.toLowerCase();
  return viewModeFiltered.filter(n => n.componentName?.toLowerCase().includes(lower));
};
```

- [ ] **Step 12: Run the full test file to verify everything passes**

Run: `npm run test -- test/jest/metadataTypeTreeProvider.test.ts`
Expected: PASS — all 9 tests (3 state + 3 `passesTypeFilter` + 3 component filter).

- [ ] **Step 13: Wire `passesTypeFilter` into the root-level branch of `getChildrenOfTreeItem`**

In `metadataTypeTreeProvider.ts`, the root-level branch (`if (!element) { ... }`, currently lines 114-134) needs the type filter applied after the existing showLocal/showOrg logic, on every return path. Replace the whole `if (!element)` block:

```typescript
    if (!element) {
      const types = yield* metadataDescribeService.describe();
      const allNodes = types.toSorted((a, b) => (a.xmlName < b.xmlName ? -1 : 1)).map(mdapiDescribeToOrgBrowserNode);

      // Both ON or both OFF = show everything (both-off is a no-op by design)
      if (provider.showLocal === provider.showOrg) {
        return allNodes.filter(node => passesTypeFilter(node, provider));
      }

      // localOnly mode: show only types that have local source files
      if (provider.showLocal && !provider.showOrg) {
        const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
        const localTypeNames = new Set<string>(
          Array.from(projectComponentSet.getSourceComponents(), comp => comp.type.name)
        );
        return allNodes.filter(node => localTypeNames.has(node.xmlName) && passesTypeFilter(node, provider));
      }

      // orgOnly mode: show all types (all types exist in the org by definition)
      // Child-level filtering will hide components with local files
      return allNodes.filter(node => passesTypeFilter(node, provider));
    }
```

- [ ] **Step 14: Compile-check and run the full package unit test suite**

Run: `npm run compile && npm run test` (from `packages/salesforcedx-vscode-org-browser`)
Expected: compile succeeds with no TypeScript errors; all Jest suites pass (the pre-existing `describe.skip('Extension', ...)` block in `test/jest/index.test.ts` stays skipped, unaffected).

- [ ] **Step 15: Commit**

```bash
git add packages/salesforcedx-vscode-org-browser/src/tree/metadataTypeTreeProvider.ts packages/salesforcedx-vscode-org-browser/test/jest/metadataTypeTreeProvider.test.ts
git commit -m "feat(org-browser): add text-filter state and matching logic to tree provider - W-23237574"
```

---

### Task 2: `index.ts` command registrations and QuickPick handler

**Files:**
- Modify: `packages/salesforcedx-vscode-org-browser/src/index.ts`
- Modify: `packages/salesforcedx-vscode-org-browser/src/messages/i18n.ts`

**Interfaces:**
- Consumes: `MetadataTypeTreeProvider.typeFilter`, `.componentFilter`, `.setTextFilter(typeFilter, componentFilter)`, `.clearTextFilter()` (Task 1); `MetadataDescribeService.describe(): Effect<DescribeMetadataObject[], MetadataDescribeError>` (existing, `packages/salesforcedx-vscode-services/src/core/metadataDescribeService.ts:318`); `treeProvider.getChildren(node: OrgBrowserTreeItem): Promise<OrgBrowserTreeItem[]>` (existing); `registerCommandWithRuntime(getOrgBrowserRuntime())` curried command registrar (existing, `packages/salesforcedx-vscode-services/src/vscode/registerCommand.ts:56`).
- Produces: commands `sfdxOrgBrowser.filterText` and `sfdxOrgBrowser.filterText.active`, both opening the same picker; sets VS Code context key `sf:orgBrowser.textFilterActive`.

- [ ] **Step 1: Add the QuickPick placeholder nls key**

In `packages/salesforcedx-vscode-org-browser/src/messages/i18n.ts`, add a new key after `org_filter_no_data`:

```typescript
export const messages = {
  confirm_overwrite: 'Overwrite local files for %s %s?',
  yes_button: 'Yes',
  no_button: 'No',
  org_filter_no_data: 'Expand a metadata type first to enable org filtering',
  filter_text_placeholder: 'Type: e.g. ApexClass, or ApexClass:MyClass (empty to clear)'
} as const;
```

- [ ] **Step 2: Add the QuickPick item type and parsing helper to `index.ts`**

In `packages/salesforcedx-vscode-org-browser/src/index.ts`, add this near the top, after the existing imports (after line 27, before `export const activate`):

```typescript
type FilterQuickPickItem = vscode.QuickPickItem;

const parseFilterValue = (
  value: string,
  cachedTypeNames: string[]
): { typeFilter: string | undefined; componentFilter: string | undefined } => {
  if (value.length === 0) return { typeFilter: undefined, componentFilter: undefined };
  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) {
    return value.length >= 3 ? { typeFilter: value, componentFilter: undefined } : { typeFilter: undefined, componentFilter: undefined };
  }
  const typePart = value.substring(0, colonIdx).trim();
  const resolvedType = cachedTypeNames.find(t => t.toLowerCase() === typePart.toLowerCase()) ?? typePart;
  const componentPart = value.substring(colonIdx + 1).trim();
  return { typeFilter: resolvedType, componentFilter: componentPart };
};
```

- [ ] **Step 3: Add the suggestion-list computation helper**

Immediately below `parseFilterValue`, add:

```typescript
const computeSuggestions = (
  value: string,
  cachedTypeNames: string[],
  treeProvider: MetadataTypeTreeProvider
): Promise<FilterQuickPickItem[]> => {
  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) {
    const lower = value.toLowerCase();
    const names = value.length >= 3 ? cachedTypeNames.filter(t => t.toLowerCase().includes(lower)) : cachedTypeNames;
    return Promise.resolve(names.map(label => ({ label })));
  }
  const typePart = value.substring(0, colonIdx).trim();
  const componentPart = value.substring(colonIdx + 1).trim().toLowerCase();
  const resolvedType = cachedTypeNames.find(t => t.toLowerCase() === typePart.toLowerCase()) ?? typePart;
  const typeNode = new OrgBrowserTreeItem({ kind: 'type', xmlName: resolvedType, label: resolvedType });
  return treeProvider.getChildren(typeNode).then(children =>
    children
      .filter(c => c.componentName !== undefined && c.componentName.toLowerCase().includes(componentPart))
      .map(c => ({ label: `${typePart}:${c.componentName ?? ''}` }))
  );
};
```

- [ ] **Step 4: Add the `openFilterTextPicker` Effect that drives the whole interaction**

Add this Effect function below `computeSuggestions`, still before `export const activate`:

```typescript
const openFilterTextPicker = Effect.fn('OrgBrowser.openFilterTextPicker')(function* (
  treeProvider: MetadataTypeTreeProvider
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const previousTypeFilter = treeProvider.typeFilter;
  const previousComponentFilter = treeProvider.componentFilter;
  const previousTypeIsRegex = treeProvider.typeIsRegex;
  const previousComponentIsRegex = treeProvider.componentIsRegex;

  const cachedTypeNames = yield* api.services.MetadataDescribeService.describe().pipe(
    Effect.map(types => types.map(t => t.xmlName).toSorted()),
    Effect.catchAll(() => Effect.succeed<string[]>([]))
  );

  const runtime = yield* Effect.runtime();
  const run = Runtime.runFork(runtime);

  const queue = yield* Queue.unbounded<string>();
  const deferred = yield* Deferred.make<void>();
  const acceptedRef = yield* Ref.make(false);

  const picker = vscode.window.createQuickPick<FilterQuickPickItem>();
  picker.placeholder = nls.localize('filter_text_placeholder');
  picker.matchOnDescription = false;
  picker.value = previousTypeFilter
    ? previousComponentFilter !== undefined
      ? `${previousTypeFilter}:${previousComponentFilter}`
      : previousTypeFilter
    : '';
  picker.items = cachedTypeNames.map(label => ({ label }));

  const commit = (value: string) =>
    Effect.gen(function* () {
      yield* Ref.set(acceptedRef, true);
      const { typeFilter, componentFilter, typeIsRegex, componentIsRegex } = parseFilterValue(value, cachedTypeNames);
      treeProvider.setTextFilter(typeFilter, componentFilter, typeIsRegex, componentIsRegex);
      yield* Effect.promise(() =>
        vscode.commands.executeCommand('setContext', 'sf:orgBrowser.textFilterActive', typeFilter !== undefined || componentFilter !== undefined)
      );
      picker.dispose();
      yield* Deferred.succeed(deferred, undefined);
    });

  picker.onDidChangeValue(value => run(Queue.offer(queue, value)));
  picker.onDidAccept(() => run(commit(picker.value)));
  picker.onDidHide(() =>
    run(
      Effect.gen(function* () {
        const accepted = yield* Ref.get(acceptedRef);
        if (!accepted) {
          treeProvider.setTextFilter(previousTypeFilter, previousComponentFilter, previousTypeIsRegex, previousComponentIsRegex);
        }
        picker.dispose();
        yield* Deferred.succeed(deferred, undefined);
      })
    )
  );

  yield* Effect.fork(
    Stream.fromQueue(queue).pipe(
      Stream.debounce(Duration.millis(150)),
      Stream.runForEach(value =>
        Effect.gen(function* () {
          const { typeFilter, componentFilter } = parseFilterValue(value, cachedTypeNames);
          treeProvider.setTextFilter(typeFilter, componentFilter);
          yield* Effect.promise(() =>
            vscode.commands.executeCommand('setContext', 'sf:orgBrowser.textFilterActive', typeFilter !== undefined || componentFilter !== undefined)
          );
          const suggestions = yield* Effect.tryPromise({
            try: () => computeSuggestions(value, cachedTypeNames, treeProvider),
            catch: () => new Error('computeSuggestions failed')
          }).pipe(Effect.catchAll(() => Effect.succeed<FilterQuickPickItem[]>([])));
          picker.items = suggestions;
        })
      )
    )
  );

  picker.show();
  yield* Deferred.await(deferred);
});
```

- [ ] **Step 5: Add the required imports**

At the top of `index.ts`, the existing import block already has `Duration`, `Effect`, `isNotUndefined`, `Schedule`, `Scope`, `Stream`, and `SubscriptionRef`. Add only the four genuinely new imports, keeping alphabetical order with the existing style — `Deferred` and `Queue` go before the existing `Duration`/`Effect` lines, `Ref` and `Runtime` go after the existing `Effect`/`isNotUndefined` lines:

```typescript
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as Schedule from 'effect/Schedule';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
```

- [ ] **Step 6: Register the two commands**

In `index.ts`, inside the `Effect.all([...])` array passed to `registerCommand` calls (the block currently ending with `registerCommand(\`${TREE_VIEW_ID}.toggleOrgFilterNoData\`, ...)` at line 160-162), add two new entries right after it:

```typescript
      registerCommand(`${TREE_VIEW_ID}.toggleOrgFilterNoData`, () =>
        Effect.promise(() => vscode.window.showInformationMessage(nls.localize('org_filter_no_data')))
      ),
      registerCommand(`${TREE_VIEW_ID}.filterText`, () => openFilterTextPicker(treeProvider)),
      registerCommand(`${TREE_VIEW_ID}.filterText.active`, () => openFilterTextPicker(treeProvider))
```

- [ ] **Step 7: Compile-check**

Run: `npm run compile` (from `packages/salesforcedx-vscode-org-browser`)
Expected: no TypeScript errors.

- [ ] **Step 8: Lint-check**

Run: `npm run lint` (from `packages/salesforcedx-vscode-org-browser`)
Expected: no errors. Pay attention to `functional/no-let` (this file uses no mutable locals — `Ref`/`Queue` handle all mutable state) and `@typescript-eslint/no-explicit-any` (none introduced).

- [ ] **Step 9: Commit**

```bash
git add packages/salesforcedx-vscode-org-browser/src/index.ts
git commit -m "feat(org-browser): register filterText QuickPick command with live preview - W-23237574"
```

---

### Task 3: `package.json` and `package.nls.json` contributions

**Files:**
- Modify: `packages/salesforcedx-vscode-org-browser/package.json`
- Modify: `packages/salesforcedx-vscode-org-browser/package.nls.json`

**Interfaces:**
- Consumes: command ids `sfdxOrgBrowser.filterText` / `sfdxOrgBrowser.filterText.active` (Task 2); context key `sf:orgBrowser.textFilterActive` (Task 2).
- Produces: `%orgBrowser.command.filterText%` / `%orgBrowser.command.filterText.active%` nls keys.

- [ ] **Step 1: Add the two command definitions to `package.json`**

In `packages/salesforcedx-vscode-org-browser/package.json`, in the `"commands"` array, add two entries after the existing `sfdxOrgBrowser.toggleOrgFilterNoData` entry (currently lines 383-388):

```json
      {
        "command": "sfdxOrgBrowser.toggleOrgFilterNoData",
        "title": "%orgBrowser.command.toggleOrgFilterNoData%",
        "category": "Org Browser",
        "icon": "$(cloud)"
      },
      {
        "command": "sfdxOrgBrowser.filterText",
        "title": "%orgBrowser.command.filterText%",
        "category": "Org Browser",
        "icon": "$(filter)"
      },
      {
        "command": "sfdxOrgBrowser.filterText.active",
        "title": "%orgBrowser.command.filterText.active%",
        "category": "Org Browser",
        "icon": "$(filter-filled)"
      }
```

- [ ] **Step 2: Add `view/title` menu entries**

In the `"menus"."view/title"` array, add two entries after the existing `sfdxOrgBrowser.collapseAll` entry (currently lines 422-426), giving the filter icon its own `navigation@4` slot:

```json
        {
          "command": "sfdxOrgBrowser.collapseAll",
          "when": "view == sfdxOrgBrowser",
          "group": "navigation@3"
        },
        {
          "command": "sfdxOrgBrowser.filterText",
          "when": "view == sfdxOrgBrowser && sf:orgBrowser.textFilterActive == false",
          "group": "navigation@4"
        },
        {
          "command": "sfdxOrgBrowser.filterText.active",
          "when": "view == sfdxOrgBrowser && sf:orgBrowser.textFilterActive == true",
          "group": "navigation@4"
        }
```

- [ ] **Step 3: Add `commandPalette` suppression entries**

In the `"menus"."commandPalette"` array, add two entries after the existing `sfdxOrgBrowser.toggleOrgFilterNoData` entry (currently lines 449-452):

```json
        {
          "command": "sfdxOrgBrowser.toggleOrgFilterNoData",
          "when": "false"
        },
        {
          "command": "sfdxOrgBrowser.filterText",
          "when": "false"
        },
        {
          "command": "sfdxOrgBrowser.filterText.active",
          "when": "false"
        }
```

- [ ] **Step 4: Add nls entries**

In `packages/salesforcedx-vscode-org-browser/package.nls.json`, add two keys after `"orgBrowser.command.toggleOrgFilterNoData"` (currently line 13):

```json
  "orgBrowser.command.toggleOrgFilterNoData": "Show Org Types (expand a type first)",
  "orgBrowser.command.filterText": "Filter by Type/Component",
  "orgBrowser.command.filterText.active": "Edit Filter (active)",
```

- [ ] **Step 5: Validate JSON and run the package's contribution-consistency checks**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8')); JSON.parse(require('fs').readFileSync('package.nls.json', 'utf8')); console.log('valid')"` (from `packages/salesforcedx-vscode-org-browser`)
Expected: prints `valid` — confirms no JSON syntax errors from manual edits.

Run: `npm run lint` (from `packages/salesforcedx-vscode-org-browser`)
Expected: no errors (lint includes `package.json`/`package.nls.json` per this package's wireit `lint.files` list).

- [ ] **Step 6: Commit**

```bash
git add packages/salesforcedx-vscode-org-browser/package.json packages/salesforcedx-vscode-org-browser/package.nls.json
git commit -m "feat(org-browser): add filterText command/menu/nls contributions - W-23237574"
```

---

### Task 4: Playwright e2e spec

**Files:**
- Create: `packages/salesforcedx-vscode-org-browser/test/playwright/specs/orgBrowser.textFilter.headless.spec.ts`

**Interfaces:**
- Consumes: `OrgBrowserPage` (`packages/salesforcedx-vscode-org-browser/test/playwright/pages/orgBrowserPage.ts`) — `openOrgBrowser()`, `expandFolder(name)`, `sidebar` locator; shared `test` from `../fixtures`; `activeQuickInputTextField` from `@salesforce/playwright-vscode-ext` (re-exported via `packages/playwright-vscode-ext/src/index.ts`); fixture helpers `createDreamhouseOrg`, `waitForVSCodeWorkbench`, `closeWelcomeTabs`, `upsertScratchOrgAuthFieldsToSettings`, `ensureSecondarySideBarHidden` (same as `orgBrowser.filterToggle.headless.spec.ts`). Escape-cancel flows use plain `page.keyboard.press('Escape')`, matching the pattern in `retrieveInManifest.headless.spec.ts` — `dismissAllQuickInputWidgets` is defined in `playwright-vscode-ext`'s internals but is not exported from its public barrel, so it is not used here.
- Produces: no new exports — this is a leaf test file.

- [ ] **Step 1: Write the spec file**

Create `packages/salesforcedx-vscode-org-browser/test/playwright/specs/orgBrowser.textFilter.headless.spec.ts`:

```typescript
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test } from '../fixtures';
import { expect } from '@playwright/test';
import { OrgBrowserPage } from '../pages/orgBrowserPage';
import {
  activeQuickInputTextField,
  closeWelcomeTabs,
  createDreamhouseOrg,
  ensureSecondarySideBarHidden,
  upsertScratchOrgAuthFieldsToSettings,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';

test.setTimeout(600_000);

test.beforeEach(async ({ page }) => {
  const createResult = await createDreamhouseOrg();
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowserPage.waitForProject());
  await ensureSecondarySideBarHidden(page);
});

test('Org Browser - text filter: toolbar icon visible and swaps to filled state on commit', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await expect(filterButton, 'unfilled filter icon should be visible before any filter is set').toBeVisible({
    timeout: 10_000
  });

  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await page.keyboard.press('Enter');

  const activeFilterButton = page.locator('[aria-label="Edit Filter (active)"]').first();
  await expect(activeFilterButton, 'filled filter icon should appear once a filter is committed').toBeVisible({
    timeout: 10_000
  });
});

test('Org Browser - text filter: typing a type name live-narrows the root tree', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).count();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');

  const narrowedItems = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect(narrowedItems).toHaveCount(1, { timeout: 10_000 });
  await expect(narrowedItems.first()).toHaveAccessibleName(/^ApexClass/);

  await page.keyboard.press('Enter');
  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 })).toHaveCount(1, { timeout: 10_000 });
  expect(beforeCount).toBeGreaterThan(1);
});

test('Org Browser - text filter: Type:partial narrows suggestion list and expanded children', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass:');
  await page.keyboard.press('Enter');

  await orgBrowserPage.expandFolder('ApexClass');
  const componentsBefore = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).count();
  expect(componentsBefore).toBeGreaterThan(0);

  const secondFilterButton = page.locator('[aria-label="Edit Filter (active)"]').first();
  await secondFilterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass:Broker');
  await page.keyboard.press('Enter');

  const componentsAfter = orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 });
  await expect(componentsAfter.first()).toBeVisible({ timeout: 10_000 });
  const afterCount = await componentsAfter.count();
  expect(afterCount).toBeLessThanOrEqual(componentsBefore);
});

test('Org Browser - text filter: unresolved type name empties the tree', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('NotARealType:Whatever');

  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 })).toHaveCount(0, { timeout: 10_000 });

  await page.keyboard.press('Escape');
});

test('Org Browser - text filter: Escape reverts to the pre-open filter state', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).count();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 })).toHaveCount(1, { timeout: 10_000 });

  await page.keyboard.press('Escape');

  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 })).toHaveCount(beforeCount, {
    timeout: 10_000
  });
  await expect(page.locator('[aria-label="Filter by Type/Component"]').first()).toBeVisible({ timeout: 10_000 });
});

test('Org Browser - text filter: clearing the text and pressing Enter clears the filter', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).count();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await page.keyboard.press('Enter');

  const activeFilterButton = page.locator('[aria-label="Edit Filter (active)"]').first();
  await expect(activeFilterButton).toBeVisible({ timeout: 10_000 });

  await activeFilterButton.click();
  await activeQuickInputTextField(page).fill('');
  await page.keyboard.press('Enter');

  await expect(page.locator('[aria-label="Filter by Type/Component"]').first()).toBeVisible({ timeout: 10_000 });
  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 })).toHaveCount(beforeCount, {
    timeout: 10_000
  });
});

test('Org Browser - text filter: composes with an active showLocal/showOrg toggle', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
  await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
  await hideLocalButton.click();
  await expect(page.locator('[aria-label="Show Local Types"]').first()).toBeVisible({ timeout: 10_000 });

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await page.keyboard.press('Enter');

  const items = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect(items).toHaveCount(1, { timeout: 10_000 });
  await expect(items.first()).toHaveAccessibleName(/^ApexClass/);
});
```

- [ ] **Step 2: Type-check the new spec file**

Run: `npm run test:compile` (from `packages/salesforcedx-vscode-org-browser`)
Expected: no errors.

- [ ] **Step 3: Lint the new spec file**

Run: `npm run lint` (from `packages/salesforcedx-vscode-org-browser`)
Expected: no errors (test files get relaxed rules per `eslint.config.mjs`'s test-file override block).

- [ ] **Step 4: Run the new spec against the web target**

Run: `npm run test:web -- orgBrowser.textFilter.headless.spec.ts` (from `packages/salesforcedx-vscode-org-browser`)
Expected: all 7 tests PASS. If a locator times out, inspect the saved Playwright trace/screenshot output before adjusting selectors — do not loosen assertions to force a pass.

- [ ] **Step 5: Run the new spec against the desktop target**

Run: `npm run test:desktop -- orgBrowser.textFilter.headless.spec.ts` (from `packages/salesforcedx-vscode-org-browser`)
Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/salesforcedx-vscode-org-browser/test/playwright/specs/orgBrowser.textFilter.headless.spec.ts
git commit -m "test(org-browser): add Playwright e2e spec for QuickPick text filter - W-23237574"
```

---

### Task 5: Full-package verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit test suite**

Run: `npm run test` (from `packages/salesforcedx-vscode-org-browser`)
Expected: all suites PASS, including the new `metadataTypeTreeProvider.test.ts`.

- [ ] **Step 2: Run the full compile + lint checks**

Run: `npm run compile && npm run lint` (from `packages/salesforcedx-vscode-org-browser`)
Expected: all succeed with no errors. `lint` depends on `check:circular-deps` internally (it is not an independently runnable top-level script), so this also covers circular-dependency checking.

- [ ] **Step 3: Run the repo-wide knip check for unused exports**

Run: `npm run check:knip -- --workspace packages/salesforcedx-vscode-org-browser` (from repo root `/Users/peter.hale/git/vse`)
Expected: no new unused-export findings for `metadataTypeTreeProvider.ts` or `index.ts` — if it flags something, fix by using the export rather than suppressing.

- [ ] **Step 4: Manual smoke test in the Extension Development Host**

Run (from repo root): `code --extensionDevelopmentPath=packages/salesforcedx-vscode-org-browser .` or use the VS Code "Run Extension" launch config for `salesforcedx-vscode-org-browser`.
In the launched window, with an authenticated scratch org: open the Org Browser, click the new filter (funnel) icon, type `ApexClass`, confirm the tree narrows live, press Enter, confirm the icon becomes filled, click it again, clear the text, press Enter, confirm the icon returns to unfilled and the tree returns to its prior state.

- [ ] **Step 5: Final commit (only if smoke testing surfaced fixes)**

If Step 4 required code changes:

```bash
git add -A packages/salesforcedx-vscode-org-browser
git commit -m "fix(org-browser): address smoke-test findings for text filter - W-23237574"
```

If no changes were needed, skip this step — there is nothing to commit.
