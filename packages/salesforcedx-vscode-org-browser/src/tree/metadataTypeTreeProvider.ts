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
import type {
  InactiveOrgOperationError,
  OrgMetadataCatalog,
  OrgMetadataCatalogComponentEntry,
  OrgMetadataCatalogEntry,
  OrgMetadataCatalogFolderEntry
} from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { getOrgBrowserRuntime } from '../services/extensionProvider';
import { preloadMetadataTypes } from '../services/metadataTypePreload';
import { matchesPattern } from '../utils/wildcardPattern';
import { createCustomFieldNode } from './customField';
import { isFolderListingNode, isFolderNode, isFolderType, OrgBrowserTreeItem } from './orgBrowserNode';

export class MetadataTypeTreeProvider implements vscode.TreeDataProvider<OrgBrowserTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<OrgBrowserTreeItem | undefined | void> = new vscode.EventEmitter();
  public readonly onDidChangeTreeData: vscode.Event<OrgBrowserTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;
  private readonly typeNodes = new Map<string, OrgBrowserTreeItem>();
  private readonly fullDiscoveryOrgIds = new Set<string>();

  private _showLocal = true;
  private _showOrg = true;
  private _typeFilter: string | undefined;
  private _componentFilter: string | undefined;
  private _typeIsRegex = false;
  private _componentIsRegex = false;
  private _hideResults = false;
  private treeEmpty = false;
  private rootProjectionStarted: (() => void) | undefined;
  private rootProjectionFinished: (() => void) | undefined;
  private orgRequestCount = 0;
  private orgRequestLabel = '';
  private orgRequestStatus: vscode.StatusBarItem | undefined;
  private orgRequestStatusTimer: ReturnType<typeof setTimeout> | undefined;

  /** Shows slow, uncached org requests without flashing for catalog cache hits. */
  public trackOrgRequest<A, E, R>(label: string, request: Effect.Effect<A, E, R>) {
    return Effect.sync(() => this.startOrgRequest(label)).pipe(
      Effect.zipRight(request),
      Effect.ensuring(Effect.sync(() => this.finishOrgRequest()))
    );
  }

  private startOrgRequest(label: string): void {
    this.orgRequestCount += 1;
    this.orgRequestLabel = label;
    if (this.orgRequestStatus || this.orgRequestStatusTimer) return;
    this.orgRequestStatusTimer = setTimeout(() => {
      this.orgRequestStatusTimer = undefined;
      if (this.orgRequestCount === 0) return;
      this.orgRequestStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
      this.updateOrgRequestStatus();
      this.orgRequestStatus.show();
    }, 300);
  }

  private finishOrgRequest(): void {
    this.orgRequestCount -= 1;
    if (this.orgRequestCount > 0) {
      this.updateOrgRequestStatus();
      return;
    }
    if (this.orgRequestStatusTimer) clearTimeout(this.orgRequestStatusTimer);
    this.orgRequestStatusTimer = undefined;
    this.orgRequestStatus?.dispose();
    this.orgRequestStatus = undefined;
  }

  private updateOrgRequestStatus(): void {
    if (!this.orgRequestStatus) return;
    const suffix = this.orgRequestCount === 1 ? '' : ` (${this.orgRequestCount} requests)`;
    this.orgRequestStatus.text = `$(sync~spin) ${this.orgRequestLabel}${suffix}`;
  }

  public setRootProjectionStartedHandler(handler: () => void): void {
    this.rootProjectionStarted = handler;
  }

  public setRootProjectionFinishedHandler(handler: () => void): void {
    this.rootProjectionFinished = handler;
  }

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

  public get hideResults(): boolean {
    return this._hideResults;
  }

  public setTextFilter(
    typeFilter: string | undefined,
    componentFilter: string | undefined,
    typeIsRegex = false,
    componentIsRegex = false,
    hideResults = false,
    refresh = true
  ): void {
    this._typeFilter = typeFilter;
    this._componentFilter = componentFilter;
    this._typeIsRegex = typeIsRegex;
    this._componentIsRegex = componentIsRegex;
    this._hideResults = hideResults;
    if (refresh) this._onDidChangeTreeData.fire(undefined);
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
    if (!node) this.fullDiscoveryOrgIds.clear();
    await getOrgBrowserRuntime().runPromise(
      invalidateForNode(node).pipe(Effect.zipRight(node ? Effect.void : preloadConfiguredMetadataTypes))
    );
    this._onDidChangeTreeData.fire(node);
  }

  // eslint-disable-next-line class-methods-use-this
  public getTreeItem(element: OrgBrowserTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: OrgBrowserTreeItem): Promise<OrgBrowserTreeItem[]> {
    if (!element) this.rootProjectionStarted?.();
    return await getOrgBrowserRuntime()
      .runPromise(getChildrenOfTreeItem(element, this))
      .finally(() => !element && this.rootProjectionFinished?.());
  }

  /** Preserve root element identity across filtering and catalog-driven refreshes. */
  public getTypeNode(xmlName: string): OrgBrowserTreeItem {
    const existing = this.typeNodes.get(xmlName);
    if (existing) return existing;
    const node = mdapiDescribeToOrgBrowserNode({ xmlName });
    this.typeNodes.set(xmlName, node);
    return node;
  }

  public hasStartedFullDiscovery(orgId: string): boolean {
    return this.fullDiscoveryOrgIds.has(orgId);
  }

  public markFullDiscoveryStarted(orgId: string): void {
    this.fullDiscoveryOrgIds.add(orgId);
  }
}

const invalidateForNode = Effect.fn('invalidateForNode')(function* (node?: OrgBrowserTreeItem) {
  const svcProvider = yield* ExtensionProviderService;
  const api = yield* svcProvider.getServicesApi;
  const catalog = yield* api.services.OrgMetadataCatalog;
  const reference = Match.value(node).pipe(
    Match.when(Match.undefined, () => ({})),
    Match.when(isFolderNode, n => ({
      type: n.xmlName,
      fullName: n.folderName
    })),
    Match.when(
      n => n?.kind === 'customObject' || n?.kind === 'component',
      n => ({
        type: n!.xmlName,
        fullName: n!.componentName
      })
    ),
    Match.orElse(n => ({ type: n?.xmlName }))
  );
  yield* catalog.getChildren(reference, { consistency: 'refresh' });
});

const preloadConfiguredMetadataTypes = Effect.gen(function* () {
  const svcProvider = yield* ExtensionProviderService;
  const api = yield* svcProvider.getServicesApi;
  const { orgId } = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  if (!orgId) return;
  const catalog = yield* api.services.OrgMetadataCatalog;
  yield* preloadMetadataTypes(catalog).pipe(
    Effect.catchAll(error => Effect.logWarning('Failed to preload Org Browser metadata types', error))
  );
});

export const passesTypeFilter = (node: OrgBrowserTreeItem, provider: MetadataTypeTreeProvider): boolean => {
  if (isUndefined(provider.typeFilter)) return true;
  return matchesPattern(node.xmlName, provider.typeFilter, provider.typeIsRegex);
};

const typeNameMatchesGlobalSearch = (node: OrgBrowserTreeItem, provider: MetadataTypeTreeProvider): boolean => {
  const componentFilter = provider.componentFilter;
  return (
    isUndefined(provider.typeFilter) &&
    !isUndefined(componentFilter) &&
    matchesPattern(node.xmlName, componentFilter, provider.componentIsRegex)
  );
};

const isGlobalSearch = (provider: MetadataTypeTreeProvider): boolean =>
  isUndefined(provider.typeFilter) && Boolean(provider.componentFilter);

export const matchesGlobalSearch = (node: OrgBrowserTreeItem, provider: MetadataTypeTreeProvider): boolean =>
  isGlobalSearch(provider) && matchesPattern(node.searchName, provider.componentFilter!, provider.componentIsRegex);

export const applyViewModeChildFilter = (
  nodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider
): OrgBrowserTreeItem[] => {
  const viewModeFiltered = filterByViewMode(nodes, provider);

  if (!provider.componentFilter || provider.componentFilter === '') return viewModeFiltered;
  const componentFilter = provider.componentFilter;
  return viewModeFiltered.filter(n =>
    isGlobalSearch(provider)
      ? typeNameMatchesGlobalSearch(n, provider) || matchesGlobalSearch(n, provider)
      : n.componentName && matchesPattern(n.componentName, componentFilter, provider.componentIsRegex)
  );
};

const filterByViewMode = (nodes: OrgBrowserTreeItem[], provider: MetadataTypeTreeProvider): OrgBrowserTreeItem[] => {
  // both-on: show all children
  if (provider.showLocal && provider.showOrg) return nodes;
  // both-off: unreachable at child level (root returns empty)
  if (!provider.showLocal && !provider.showOrg) return [];
  if (provider.showLocal && !provider.showOrg) return nodes.filter(n => n.filePresent === true);
  // orgOnly: include org components whether or not they also exist locally.
  return nodes.filter(n => n.orgPresent === true);
};

const inventoryEntryMatchesViewMode = (entry: OrgMetadataCatalogEntry, provider: MetadataTypeTreeProvider): boolean =>
  provider.showLocal && provider.showOrg
    ? true
    : provider.showLocal
      ? entry.inWorkspace
      : provider.showOrg && entry.inOrg;

const loadVisibleChildren = Effect.fn('loadVisibleChildren')(function* (
  element: OrgBrowserTreeItem,
  provider: MetadataTypeTreeProvider,
  catalog: OrgMetadataCatalog,
  consistency?: 'cache-only'
) {
  const entries =
    consistency === 'cache-only'
      ? yield* catalog.getChildren(
          element.kind === 'customObject'
            ? { type: 'CustomObject', fullName: element.componentName! }
            : isFolderNode(element)
              ? { type: element.xmlName, fullName: element.folderName }
              : { type: element.xmlName },
          { consistency: 'cache-only' }
        )
      : yield* provider.trackOrgRequest(
          'Discovering org metadata',
          Match.value(element).pipe(
            Match.when({ kind: 'customObject' }, el =>
              catalog.getChildren({ type: 'CustomObject', fullName: el.componentName! }, { consistency })
            ),
            Match.when(isFolderListingNode, el => catalog.getChildren({ type: el.xmlName }, { consistency })),
            Match.when({ kind: 'type' }, el => catalog.getChildren({ type: el.xmlName }, { consistency })),
            Match.when(isFolderNode, el =>
              catalog.getChildren({ type: el.xmlName, fullName: el.folderName }, { consistency })
            ),
            Match.orElse(() => Effect.succeed<OrgMetadataCatalogEntry[]>([]))
          )
        );
  const children = Match.value(element).pipe(
    Match.when({ kind: 'customObject' }, () =>
      filterByViewMode(
        entries.flatMap(entry => (entry.kind === 'component' ? [createCustomFieldNode(entry)] : [])),
        provider
      )
    ),
    Match.when(isFolderListingNode, el =>
      entries
        .filter((entry): entry is OrgMetadataCatalogFolderEntry => entry.kind === 'folder')
        .filter(entry => inventoryEntryMatchesViewMode(entry, provider))
        .map(listMetadataToFolder(el))
    ),
    Match.when({ kind: 'type' }, el =>
      filterByViewMode(
        entries
          .filter((entry): entry is OrgMetadataCatalogComponentEntry => entry.kind === 'component')
          .filter(isSupportedManageableState)
          .map(listMetadataToComponent(el)),
        provider
      )
    ),
    Match.when(isFolderNode, el =>
      filterByViewMode(
        entries.flatMap(entry =>
          entry.kind === 'folder'
            ? [listMetadataToFolder(el)(entry)]
            : entry.kind === 'component' && isSupportedManageableState(entry)
              ? [listMetadataToFolderItem(el)(entry)]
              : []
        ),
        provider
      )
    ),
    Match.orElse(() => [])
  );
  return children;
});

type Catalog = OrgMetadataCatalog;

const retainMatchingSubtree: (
  node: OrgBrowserTreeItem,
  provider: MetadataTypeTreeProvider,
  catalog: Catalog,
  consistency?: 'cache-only',
  descendantsCacheOnly?: boolean
) => Effect.Effect<boolean, unknown, never> = Effect.fn('retainMatchingSubtree')(function* (
  node: OrgBrowserTreeItem,
  provider: MetadataTypeTreeProvider,
  catalog: Catalog,
  consistency?: 'cache-only',
  descendantsCacheOnly = false
) {
  if (matchesGlobalSearch(node, provider)) return true;
  const children = yield* loadVisibleChildren(node, provider, catalog, consistency);
  const retained = yield* Effect.forEach(
    children,
    child =>
      retainMatchingSubtree(
        child,
        provider,
        catalog,
        descendantsCacheOnly ? 'cache-only' : consistency,
        descendantsCacheOnly
      ).pipe(Effect.map(matches => (matches ? Option.some(child) : Option.none<OrgBrowserTreeItem>()))),
    { concurrency: 10, discard: false }
  ).pipe(Effect.map(Arr.getSomes));
  return retained.length > 0;
});

/**
 * Types with ≥1 component matching filter. Live-fetches components.
 * AND logic: type:component returns types with matching components only.
 */
export const filterTypesWithMatchingComponents = Effect.fn('filterTypesWithMatchingComponents')(function* (
  typeNodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const catalog = yield* api.services.OrgMetadataCatalog;
  return yield* Effect.all(
    typeNodes.map(typeNode =>
      (isGlobalSearch(provider)
        ? retainMatchingSubtree(typeNode, provider, catalog)
        : provider
            .trackOrgRequest('Discovering org metadata', catalog.getChildren({ type: typeNode.xmlName }))
            .pipe(
              Effect.map(entries =>
                entries.some(
                  entry =>
                    entry.kind !== 'type' &&
                    matchesPattern(entry.reference.fullName, provider.componentFilter!, provider.componentIsRegex)
                )
              )
            )
      ).pipe(
        Effect.map(matches => (matches ? Option.some(typeNode) : Option.none<OrgBrowserTreeItem>())),
        Effect.catchAll(error =>
          Effect.logWarning(`Failed to search Org Browser metadata type ${typeNode.xmlName}`, error).pipe(
            Effect.as(Option.none<OrgBrowserTreeItem>())
          )
        )
      )
    ),
    { concurrency: 10 }
  ).pipe(Effect.map(Arr.getSomes));
});

/** If a component filter is active, narrow types to those with matching components; else pass through. */
const applyComponentFilter = Effect.fn('applyComponentFilter')(function* (
  typeFilteredNodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider
) {
  if (!provider.componentFilter || provider.componentFilter === '') return typeFilteredNodes;
  return yield* filterTypesWithMatchingComponents(typeFilteredNodes, provider);
});

const getChildrenOfTreeItem = (element: OrgBrowserTreeItem | undefined, provider: MetadataTypeTreeProvider) => {
  const loadForActiveOrg = Effect.gen(function* () {
    const svcProvider = yield* ExtensionProviderService;
    const api = yield* svcProvider.getServicesApi;
    const orgMetadataCatalog = yield* api.services.OrgMetadataCatalog;
    // this could be the initial load, before the org is set.  Prevents duplication loads of root
    const { orgId } = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
    if (!orgId) {
      return yield* Effect.succeed([]);
    }
    if (!element) {
      if (provider.hideResults) {
        yield* Effect.promise(() => provider.updateTreeEmptyContext(true));
        return [];
      }
      // Both OFF = empty tree (explicit "show nothing" state)
      if (!provider.showLocal && !provider.showOrg) {
        yield* Effect.promise(() => provider.updateTreeEmptyContext(true));
        return [];
      }

      const typeEntries = yield* provider.trackOrgRequest('Discovering org metadata', orgMetadataCatalog.getChildren());
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
    const unfilteredChildren = yield* loadVisibleChildren(element, provider, orgMetadataCatalog, undefined);
    const children = isGlobalSearch(provider)
      ? matchesGlobalSearch(element, provider)
        ? unfilteredChildren
        : yield* Effect.forEach(
            unfilteredChildren,
            child =>
              retainMatchingSubtree(child, provider, orgMetadataCatalog).pipe(
                Effect.map(matches => (matches ? Option.some(child) : Option.none<OrgBrowserTreeItem>()))
              ),
            { concurrency: 10, discard: false }
          ).pipe(Effect.map(Arr.getSomes))
      : isFolderListingNode(element)
        ? unfilteredChildren
        : applyViewModeChildFilter(unfilteredChildren, provider);
    return children;
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
  (c: OrgMetadataCatalogComponentEntry): OrgBrowserTreeItem =>
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
  (c: OrgMetadataCatalogFolderEntry): OrgBrowserTreeItem =>
    new OrgBrowserTreeItem({
      kind: 'folder',
      xmlName: element.xmlName,
      namespace: c.namespacePrefix,
      folderName: c.reference.fullName,
      label: c.reference.fullName,
      filePresent: c.inWorkspace,
      orgPresent: c.inOrg
    });

const listMetadataToFolderItem =
  (element: OrgBrowserTreeItem) =>
  (c: OrgMetadataCatalogComponentEntry): OrgBrowserTreeItem =>
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

const isSupportedManageableState = (i: OrgMetadataCatalogEntry): boolean =>
  !i.manageableState || ['unmanaged', 'installedEditable', 'deprecatedEditable'].includes(i.manageableState);
