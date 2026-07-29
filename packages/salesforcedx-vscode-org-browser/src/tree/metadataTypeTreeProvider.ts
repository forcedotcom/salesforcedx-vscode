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
import type { OrgMetadataInventoryEntry } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { getOrgBrowserRuntime } from '../services/extensionProvider';
import { matchesPattern, MAX_TYPES_FOR_COMPONENT_PREFETCH } from '../utils/wildcardPattern';
import { createCustomFieldNode } from './customField';
import { isFolderListingNode, isFolderNode, isFolderType, OrgBrowserTreeItem } from './orgBrowserNode';

export class MetadataTypeTreeProvider implements vscode.TreeDataProvider<OrgBrowserTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<OrgBrowserTreeItem | undefined | void> = new vscode.EventEmitter();
  public readonly onDidChangeTreeData: vscode.Event<OrgBrowserTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private _showLocal = true;
  private _showOrg = true;
  private _typeFilter: string | undefined;
  private _componentFilter: string | undefined;
  private _typeIsRegex = false;
  private _componentIsRegex = false;
  private _userApprovedBroadFetch = false;

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
}

const invalidateForNode = Effect.fn('invalidateForNode')(function* (node?: OrgBrowserTreeItem) {
  const svcProvider = yield* ExtensionProviderService;
  const api = yield* svcProvider.getServicesApi;
  const catalog = yield* api.services.OrgMetadataCatalog;
  const orgId = (yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId;
  if (!orgId) return;
  const uri = Match.value(node).pipe(
    Match.when(Match.undefined, () => api.services.orgDataOwnerRoot({ orgKey: orgId, owner: 'org-metadata' })),
    Match.when(isFolderNode, n =>
      api.services.orgMetadataUri({ orgKey: orgId, xmlName: n.xmlName, fullName: n.folderName })
    ),
    Match.when(
      n => n?.kind === 'customObject' || n?.kind === 'component',
      n =>
        api.services.orgMetadataUri({
          orgKey: orgId,
          xmlName: n!.xmlName,
          fullName: n!.componentName ?? ''
        })
    ),
    Match.orElse(n => api.services.orgMetadataUri({ orgKey: orgId, xmlName: n?.xmlName ?? '', fullName: '' }))
  );
  yield* catalog.refresh(uri);
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

const inventoryEntryMatchesViewMode = (
  entry: OrgMetadataInventoryEntry,
  provider: MetadataTypeTreeProvider
): boolean =>
  provider.showLocal && provider.showOrg
    ? true
    : provider.showLocal
      ? entry.inWorkspace
      : provider.showOrg && entry.inOrg;

const typeNodeToItem = (typeNode: OrgBrowserTreeItem): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({ kind: typeNode.kind, xmlName: typeNode.xmlName, label: typeNode.xmlName });

/** ≥1 component's fullName matches the active component filter. */
const hasMatchingComponent =
  (provider: MetadataTypeTreeProvider) =>
  (components: readonly OrgMetadataInventoryEntry[]): boolean =>
    components.some(
      c => c.fullName && matchesPattern(c.fullName, provider.componentFilter!, provider.componentIsRegex)
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
  const orgId = (yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId;
  if (!orgId) return [];
  return yield* Effect.all(
    typeNodes.map(typeNode =>
      catalog.getChildren(api.services.orgMetadataUri({ orgKey: orgId, xmlName: typeNode.xmlName, fullName: '' })).pipe(
        Effect.map(hasMatchingComponent(provider)),
        Effect.map(hasMatch => (hasMatch ? Option.some(typeNodeToItem(typeNode)) : Option.none<OrgBrowserTreeItem>()))
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
  const orgId = (yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId;
  if (!orgId) return [];
  return yield* Effect.all(
    typeNodes.map(typeNode =>
      catalog
        .getChildrenCached(api.services.orgMetadataUri({ orgKey: orgId, xmlName: typeNode.xmlName, fullName: '' }))
        .pipe(
          Effect.map(components =>
            components && hasMatchingComponent(provider)(components)
              ? Option.some(typeNodeToItem(typeNode))
              : Option.none()
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

const getChildrenOfTreeItem = (element: OrgBrowserTreeItem | undefined, provider: MetadataTypeTreeProvider) =>
  Effect.gen(function* () {
    const svcProvider = yield* ExtensionProviderService;
    const api = yield* svcProvider.getServicesApi;
    const orgMetadataCatalog = yield* api.services.OrgMetadataCatalog;
    // this could be the initial load, before the org is set.  Prevents duplication loads of root
    const orgId = (yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId;
    if (!orgId) {
      return yield* Effect.succeed([]);
    }
    const canonicalUri = (xmlName: string, fullName = '') =>
      api.services.orgMetadataUri({ orgKey: orgId, xmlName, fullName });
    if (!element) {
      // Both OFF = empty tree (explicit "show nothing" state)
      if (!provider.showLocal && !provider.showOrg) {
        yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.treeEmpty', true));
        return [];
      }

      const metadataRoot = api.services.orgDataOwnerRoot({ orgKey: orgId, owner: 'org-metadata' });
      const typeEntries = yield* orgMetadataCatalog.getChildren(metadataRoot);
      const allNodes = typeEntries
        .filter(entry => entry.kind === 'type')
        .map(entry => mdapiDescribeToOrgBrowserNode({ xmlName: entry.xmlName }))
        .toSorted((a, b) => a.xmlName.localeCompare(b.xmlName));

      // localOnly (showLocal && !showOrg): keep only types with local source files.
      const presenceFilteredNodes = allNodes.filter(node => {
        const entry = typeEntries.find(candidate => candidate.xmlName === node.xmlName);
        return entry ? inventoryEntryMatchesViewMode(entry, provider) : false;
      });
      const typeFilteredNodes = presenceFilteredNodes.filter(node => passesTypeFilter(node, provider));
      const result = yield* applyComponentFilter(typeFilteredNodes, provider);

      yield* Effect.promise(() =>
        vscode.commands.executeCommand('setContext', 'sf:orgBrowser.treeEmpty', result.length === 0)
      );
      return result;
    }
    return yield* Match.value(element).pipe(
      Match.when({ kind: 'customObject' }, el =>
        Effect.gen(function* () {
          const fields = yield* orgMetadataCatalog.getChildren(canonicalUri('CustomObject', el.componentName!));
          return fields.filter(isCustomFieldEntry).map(createCustomFieldNode);
        })
      ),
      Match.when(isFolderListingNode, el =>
        orgMetadataCatalog.getChildren(canonicalUri(el.xmlName)).pipe(
          Effect.map(entries =>
            entries
              .filter(isFolderEntry)
              .filter(entry => inventoryEntryMatchesViewMode(entry, provider))
              .map(listMetadataToFolder(el))
          )
        )
      ),
      Match.when({ kind: 'type' }, el =>
        orgMetadataCatalog.getChildren(canonicalUri(el.xmlName)).pipe(
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
        orgMetadataCatalog.getChildren(canonicalUri(el.xmlName, el.folderName)).pipe(
          Effect.map(entries => entries.filter(isVisibleComponentEntry).map(listMetadataToFolderItem(el))),
          Effect.map(nodes => applyViewModeChildFilter(nodes, provider))
        )
      ),
      Match.when({ kind: 'folder' }, () => Effect.succeed<OrgBrowserTreeItem[]>([])),
      Match.when({ kind: 'component' }, () => Effect.succeed<OrgBrowserTreeItem[]>([])),
      Match.orElse(el => Effect.die(new Error(`Unsupported node kind: ${JSON.stringify(el)}`)))
    );
  }).pipe(Effect.withSpan('getChildrenOfTreeItem', { attributes: { element: element?.xmlName } }));

const listMetadataToComponent =
  (element: OrgBrowserTreeItem) =>
  (c: OrgMetadataInventoryEntry & { readonly fullName: string }): OrgBrowserTreeItem =>
    new OrgBrowserTreeItem({
      kind: element.xmlName === 'CustomObject' ? 'customObject' : 'component',
      namespace: c.namespacePrefix,
      xmlName: element.xmlName,
      componentName: c.fullName,
      label: c.fullName,
      filePresent: c.inWorkspace,
      orgPresent: c.inOrg
    });

const listMetadataToFolder =
  (element: OrgBrowserTreeItem) =>
  (c: OrgMetadataInventoryEntry & { readonly fullName: string }): OrgBrowserTreeItem =>
    new OrgBrowserTreeItem({
      kind: 'folder',
      xmlName: element.xmlName,
      namespace: c.namespacePrefix,
      folderName: c.fullName,
      label: c.fullName
    });

const listMetadataToFolderItem =
  (element: OrgBrowserTreeItem) =>
  (c: OrgMetadataInventoryEntry & { readonly fullName: string }): OrgBrowserTreeItem =>
    new OrgBrowserTreeItem({
      kind: 'component',
      namespace: c.namespacePrefix,
      xmlName: element.xmlName,
      folderName: element.folderName,
      componentName: c.fullName,
      label: c.fullName,
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
const globalMetadataFilter = (i: OrgMetadataInventoryEntry): i is OrgMetadataInventoryEntry & { fullName: string } =>
  hasFullName(i) && isSupportedManageableState(i);

const hasFullName = (i: OrgMetadataInventoryEntry): i is OrgMetadataInventoryEntry & { fullName: string } =>
  Boolean(i.fullName);
const isFolderEntry = (i: OrgMetadataInventoryEntry): i is OrgMetadataInventoryEntry & { fullName: string } =>
  i.kind === 'folder' && hasFullName(i);
const isVisibleComponentEntry = (i: OrgMetadataInventoryEntry): i is OrgMetadataInventoryEntry & { fullName: string } =>
  i.kind === 'component' && globalMetadataFilter(i);
const isCustomFieldEntry = (
  i: OrgMetadataInventoryEntry
): i is OrgMetadataInventoryEntry & {
  fullName: string;
  field: NonNullable<OrgMetadataInventoryEntry['field']>;
} => i.kind === 'component' && hasFullName(i) && Boolean(i.field);
const isSupportedManageableState = (i: OrgMetadataInventoryEntry): boolean =>
  !i.manageableState || ['unmanaged', 'installedEditable', 'deprecatedEditable'].includes(i.manageableState);
