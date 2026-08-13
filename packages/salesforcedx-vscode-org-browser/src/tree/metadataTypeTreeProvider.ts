/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import { isUndefined } from 'effect/Predicate';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { InactiveOrgOperationError, OrgMetadataCatalogEntry } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { getOrgBrowserRuntime } from '../services/extensionProvider';
import { matchesPattern, MAX_TYPES_FOR_COMPONENT_PREFETCH } from '../utils/wildcardPattern';
import { createCustomFieldNode } from './customField';
import { isFolderListingNode, isFolderNode, isFolderType, OrgBrowserTreeItem } from './orgBrowserNode';

export class MetadataTypeTreeProvider implements vscode.TreeDataProvider<OrgBrowserTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<OrgBrowserTreeItem | undefined | void> = new vscode.EventEmitter();
  public readonly onDidChangeTreeData: vscode.Event<OrgBrowserTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;
  private readonly typeNodes = new Map<string, OrgBrowserTreeItem>();

  private _showLocal = true;
  private _showOrg = true;
  private _typeFilter: string | undefined;
  private _componentFilter: string | undefined;
  private _typeIsRegex = false;
  private _componentIsRegex = false;
  private _userApprovedBroadFetch = false;
  private treeEmpty = false;

  public get showLocal(): boolean {
    return this._showLocal;
  }

  public setShowLocal(value: boolean): void {
    if (this._showLocal === value) return;
    this._showLocal = value;
    this._onDidChangeTreeData.fire(undefined);
  }

  public get showOrg(): boolean {
    return this._showOrg;
  }

  public setShowOrg(value: boolean): void {
    if (this._showOrg === value) return;
    this._showOrg = value;
    this._onDidChangeTreeData.fire(undefined);
  }

  public get typeFilter(): string | undefined {
    return this._typeFilter;
  }

  public get componentFilter(): string | undefined {
    return this._componentFilter;
  }

  public get typeIsRegex(): boolean {
    return this._typeIsRegex;
  }

  public get componentIsRegex(): boolean {
    return this._componentIsRegex;
  }

  public get userApprovedBroadFetch(): boolean {
    return this._userApprovedBroadFetch;
  }

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

  public clearTextFilter(): void {
    this.setTextFilter(undefined, undefined, false, false);
  }

  /** Update the view-empty context only when it changes to avoid triggering a tree reload loop. */
  public async updateTreeEmptyContext(value: boolean): Promise<void> {
    if (this.treeEmpty === value) return;
    this.treeEmpty = value;
    await vscode.commands.executeCommand('setContext', 'sf:orgBrowser.treeEmpty', value);
  }

  /** fire the onDidChangeTreeData event for the node to cause vscode ui to update */
  public fireChangeEvent(node?: OrgBrowserTreeItem): void {
    this._onDidChangeTreeData.fire(node);
  }

  /**
   * Invalidates cache for the node, then fires change event so VS Code calls getChildren (which re-fetches).
   */
  public async refreshType(node?: OrgBrowserTreeItem): Promise<void> {
    await getOrgBrowserRuntime().runPromise(invalidateForNode(node));
    this._onDidChangeTreeData.fire(node);
  }

  // eslint-disable-next-line class-methods-use-this
  public getTreeItem(element: OrgBrowserTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: OrgBrowserTreeItem): Promise<OrgBrowserTreeItem[]> {
    return await getOrgBrowserRuntime().runPromise(getChildrenOfTreeItem(element, this));
  }

  /** Preserve root element identity across filtering and catalog-driven refreshes. */
  public getTypeNode(xmlName: string): OrgBrowserTreeItem {
    const existing = this.typeNodes.get(xmlName);
    if (existing) return existing;
    const node = mdapiDescribeToOrgBrowserNode({ xmlName });
    this.typeNodes.set(xmlName, node);
    return node;
  }
}

const invalidateForNode = Effect.fn('invalidateForNode')(function* (node?: OrgBrowserTreeItem) {
  const svcProvider = yield* ExtensionProviderService;
  const api = yield* svcProvider.getServicesApi;
  const catalog = yield* api.services.OrgMetadataCatalog;
  const reference = Match.value(node).pipe(
    Match.when(Match.undefined, () => ({})),
    Match.when(isFolderNode, n => ({
      xmlName: n.xmlName,
      fullName: n.folderName
    })),
    Match.when(
      n => n?.kind === 'customObject' || n?.kind === 'component',
      n => ({
        xmlName: n!.xmlName,
        fullName: n!.componentName
      })
    ),
    Match.orElse(n => ({ type: n?.xmlName }))
  );
  yield* catalog.getChildren(reference, { consistency: 'refresh' });
});

export const passesTypeFilter = (node: OrgBrowserTreeItem, provider: MetadataTypeTreeProvider): boolean => {
  if (isUndefined(provider.typeFilter)) return true;
  return matchesPattern(node.xmlName, provider.typeFilter, provider.typeIsRegex);
};

export const applyViewModeChildFilter = (
  nodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider
): OrgBrowserTreeItem[] => {
  const viewModeFiltered = ((): OrgBrowserTreeItem[] => {
    // both-on: show all children
    if (provider.showLocal && provider.showOrg) return nodes;
    // both-off: unreachable at child level (root returns empty)
    if (!provider.showLocal && !provider.showOrg) return [];
    if (provider.showLocal && !provider.showOrg) {
      return nodes.filter(n => n.filePresent === true);
    }
    // orgOnly: include org components whether or not they also exist locally.
    return nodes.filter(n => n.orgPresent === true);
  })();

  if (!provider.componentFilter || provider.componentFilter === '') return viewModeFiltered;
  const componentFilter = provider.componentFilter;
  return viewModeFiltered.filter(
    n => n.componentName && matchesPattern(n.componentName, componentFilter, provider.componentIsRegex)
  );
};

const inventoryEntryMatchesViewMode = (entry: OrgMetadataCatalogEntry, provider: MetadataTypeTreeProvider): boolean =>
  provider.showLocal && provider.showOrg
    ? true
    : provider.showLocal
      ? entry.inWorkspace
      : provider.showOrg && entry.inOrg;

/** ≥1 component's fullName matches the active component filter. */
const hasMatchingComponent =
  (provider: MetadataTypeTreeProvider) =>
  (components: readonly OrgMetadataCatalogEntry[]): boolean =>
    components.some(
      c =>
        c.reference.fullName &&
        matchesPattern(c.reference.fullName, provider.componentFilter!, provider.componentIsRegex)
    );

/**
 * Types with ≥1 component matching filter. Live-fetches components.
 * AND logic: type:component returns types with matching components only.
 */
const filterTypesWithMatchingComponents = Effect.fn('filterTypesWithMatchingComponents')(function* (
  typeNodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const catalog = yield* api.services.OrgMetadataCatalog;
  return yield* Effect.all(
    typeNodes.map(typeNode =>
      catalog.getChildren({ type: typeNode.xmlName }).pipe(
        Effect.map(hasMatchingComponent(provider)),
        Effect.map(hasMatch => (hasMatch ? Option.some(typeNode) : Option.none<OrgBrowserTreeItem>()))
      )
    ),
    { concurrency: 10 }
  ).pipe(Effect.map(Arr.getSomes));
});

/**
 * Cached components matching filter. Excludes uncached types (strict—can't confirm match).
 * Used when >25 types matched to avoid excessive API calls.
 */
const filterTypesWithCachedComponents = Effect.fn('filterTypesWithCachedComponents')(function* (
  typeNodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const catalog = yield* api.services.OrgMetadataCatalog;
  return yield* Effect.all(
    typeNodes.map(typeNode =>
      catalog
        .getChildren({ type: typeNode.xmlName }, { consistency: 'cache-only' })
        .pipe(
          Effect.map(components =>
            components && hasMatchingComponent(provider)(components) ? Option.some(typeNode) : Option.none()
          )
        )
    ),
    { concurrency: 'unbounded' } // no API calls, just cache reads
  ).pipe(Effect.map(Arr.getSomes));
});

/** If a component filter is active, narrow types to those with matching components; else pass through. */
const applyComponentFilter = Effect.fn('applyComponentFilter')(function* (
  typeFilteredNodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider
) {
  if (!provider.componentFilter || provider.componentFilter === '') return typeFilteredNodes;
  return typeFilteredNodes.length <= MAX_TYPES_FOR_COMPONENT_PREFETCH || provider.userApprovedBroadFetch
    ? // Under threshold or user approved: full fetch
      yield* filterTypesWithMatchingComponents(typeFilteredNodes, provider)
    : // Over threshold: cache-only (strict — unfetched types hidden)
      yield* filterTypesWithCachedComponents(typeFilteredNodes, provider);
});

const getChildrenOfTreeItem = (element: OrgBrowserTreeItem | undefined, provider: MetadataTypeTreeProvider) => {
  const loadForActiveOrg = Effect.gen(function* () {
    const svcProvider = yield* ExtensionProviderService;
    const api = yield* svcProvider.getServicesApi;
    const orgMetadataCatalog = yield* api.services.OrgMetadataCatalog;
    // this could be the initial load, before the org is set.  Prevents duplication loads of root
    const orgId = (yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId;
    if (!orgId) {
      return yield* Effect.succeed([]);
    }
    if (!element) {
      // Both OFF = empty tree (explicit "show nothing" state)
      if (!provider.showLocal && !provider.showOrg) {
        yield* Effect.promise(() => provider.updateTreeEmptyContext(true));
        return [];
      }

      const typeEntries = yield* orgMetadataCatalog.getChildren();
      const allNodes = typeEntries
        .flatMap(entry =>
          entry.kind === 'type' && entry.reference.type ? [provider.getTypeNode(entry.reference.type)] : []
        )
        .toSorted((a, b) => a.xmlName.localeCompare(b.xmlName));

      // localOnly (showLocal && !showOrg): keep only types with local source files.
      const presenceFilteredNodes = allNodes.filter(node => {
        const entry = typeEntries.find(candidate => candidate.reference.type === node.xmlName);
        return entry ? inventoryEntryMatchesViewMode(entry, provider) : false;
      });
      const typeFilteredNodes = presenceFilteredNodes.filter(node => passesTypeFilter(node, provider));
      const result = yield* applyComponentFilter(typeFilteredNodes, provider);

      yield* Effect.annotateCurrentSpan({
        resultCount: result.length,
        resultIds: JSON.stringify(result.slice(0, 10).map(node => node.id)),
        resultLabels: JSON.stringify(result.slice(0, 10).map(node => getTreeItemLabel(node)))
      });

      yield* Effect.promise(() => provider.updateTreeEmptyContext(result.length === 0));
      return result;
    }
    return yield* Match.value(element).pipe(
      Match.when({ kind: 'customObject' }, el =>
        Effect.gen(function* () {
          const fields = yield* orgMetadataCatalog.getChildren({
            type: 'CustomObject',
            fullName: el.componentName!
          });
          return fields.filter(isCustomFieldEntry).map(createCustomFieldNode);
        })
      ),
      Match.when(isFolderListingNode, el =>
        orgMetadataCatalog.getChildren({ type: el.xmlName }).pipe(
          Effect.map(entries =>
            entries
              .filter(isFolderEntry)
              .filter(entry => inventoryEntryMatchesViewMode(entry, provider))
              .map(listMetadataToFolder(el))
          )
        )
      ),
      Match.when({ kind: 'type' }, el =>
        orgMetadataCatalog.getChildren({ type: el.xmlName }).pipe(
          Effect.map(entries => entries.filter(isVisibleComponentEntry).map(listMetadataToComponent(el))),
          Effect.map(nodes => applyViewModeChildFilter(nodes, provider))
        )
      ),
      Match.when(isFolderNode, el =>
        // Metadata API bug: listMetadata({type: 'ReportFolder', folder: X}) ignores
        // the folder param and returns ALL report folders in the org regardless of X.
        // To avoid infinite nesting we call listMetadata(xmlName, folderName) instead
        // (e.g. type:'Report', folder:'unfiled$public') which correctly returns only
        // the components inside that specific folder.
        orgMetadataCatalog.getChildren({ type: el.xmlName, fullName: el.folderName }).pipe(
          Effect.map(entries => entries.filter(isVisibleComponentEntry).map(listMetadataToFolderItem(el))),
          Effect.map(nodes => applyViewModeChildFilter(nodes, provider))
        )
      ),
      Match.when({ kind: 'folder' }, () => Effect.succeed<OrgBrowserTreeItem[]>([])),
      Match.when({ kind: 'component' }, () => Effect.succeed<OrgBrowserTreeItem[]>([])),
      Match.orElse(el => Effect.die(new Error(`Unsupported node kind: ${JSON.stringify(el)}`)))
    );
  });

  return suppressInactiveOrgOperation(loadForActiveOrg).pipe(
    Effect.withSpan('getChildrenOfTreeItem', {
      attributes: {
        elementId: isMetadataTypeNode(element) ? element.id : undefined,
        elementKind: element?.kind,
        elementLabel: isMetadataTypeNode(element) ? getTreeItemLabel(element) : undefined,
        elementXmlName: element?.xmlName,
        typeFilter: provider.typeFilter,
        componentFilter: provider.componentFilter,
        showLocal: provider.showLocal,
        showOrg: provider.showOrg
      }
    })
  );
};

/**
 * Discard an acquisition tied to the former target org. The target-org watcher
 * refreshes the tree independently for the new org; the former org will
 * reacquire any missing catalog slice when it becomes active again.
 */
export const suppressInactiveOrgOperation = <E, R>(
  effect: Effect.Effect<OrgBrowserTreeItem[], E | InactiveOrgOperationError, R>
) =>
  effect.pipe(
    Effect.catchTag('InactiveOrgOperationError', () =>
      Effect.annotateCurrentSpan({ supersededByOrgChange: true }).pipe(Effect.as<OrgBrowserTreeItem[]>([]))
    )
  );

const getTreeItemLabel = (item: vscode.TreeItem): string | undefined =>
  typeof item.label === 'string' ? item.label : item.label?.label;

const isMetadataTypeNode = (
  item: OrgBrowserTreeItem | undefined
): item is OrgBrowserTreeItem & { kind: 'type' | 'folderType' } => item?.kind === 'type' || item?.kind === 'folderType';

const listMetadataToComponent =
  (element: OrgBrowserTreeItem) =>
  (
    c: OrgMetadataCatalogEntry & {
      readonly reference: { readonly type: string; readonly fullName: string };
    }
  ): OrgBrowserTreeItem =>
    new OrgBrowserTreeItem({
      kind: element.xmlName === 'CustomObject' ? 'customObject' : 'component',
      namespace: c.namespacePrefix,
      xmlName: element.xmlName,
      componentName: c.reference.fullName,
      label: c.reference.fullName,
      filePresent: c.inWorkspace,
      orgPresent: c.inOrg
    });

const listMetadataToFolder =
  (element: OrgBrowserTreeItem) =>
  (
    c: OrgMetadataCatalogEntry & {
      readonly reference: { readonly type: string; readonly fullName: string };
    }
  ): OrgBrowserTreeItem =>
    new OrgBrowserTreeItem({
      kind: 'folder',
      xmlName: element.xmlName,
      namespace: c.namespacePrefix,
      folderName: c.reference.fullName,
      label: c.reference.fullName
    });

const listMetadataToFolderItem =
  (element: OrgBrowserTreeItem) =>
  (
    c: OrgMetadataCatalogEntry & {
      readonly reference: { readonly type: string; readonly fullName: string };
    }
  ): OrgBrowserTreeItem =>
    new OrgBrowserTreeItem({
      kind: 'component',
      namespace: c.namespacePrefix,
      xmlName: element.xmlName,
      folderName: element.folderName,
      componentName: c.reference.fullName,
      label: c.reference.fullName,
      filePresent: c.inWorkspace,
      orgPresent: c.inOrg
    });

const mdapiDescribeToOrgBrowserNode = (t: { readonly xmlName: string }): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({
    kind: isFolderType(t.xmlName) ? 'folderType' : 'type',
    xmlName: t.xmlName,
    label: t.xmlName
  });

/** applies to all listMetadata calls */
type EntryWithFullName = OrgMetadataCatalogEntry & {
  readonly reference: { readonly type: string; readonly fullName: string };
};

const globalMetadataFilter = (i: OrgMetadataCatalogEntry): i is EntryWithFullName =>
  hasFullName(i) && isSupportedManageableState(i);

const hasFullName = (i: OrgMetadataCatalogEntry): i is EntryWithFullName =>
  Boolean(i.reference.type && i.reference.fullName);
const isFolderEntry = (i: OrgMetadataCatalogEntry): i is EntryWithFullName => i.kind === 'folder' && hasFullName(i);
const isVisibleComponentEntry = (i: OrgMetadataCatalogEntry): i is EntryWithFullName =>
  i.kind === 'component' && globalMetadataFilter(i);
const isCustomFieldEntry = (
  i: OrgMetadataCatalogEntry
): i is EntryWithFullName & {
  field: NonNullable<OrgMetadataCatalogEntry['field']>;
} => i.kind === 'component' && hasFullName(i) && Boolean(i.field);
const isSupportedManageableState = (i: OrgMetadataCatalogEntry): boolean =>
  !i.manageableState || ['unmanaged', 'installedEditable', 'deprecatedEditable'].includes(i.manageableState);
