/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { CreateCommandMap } from '../commands/createComponent';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { getOrgBrowserRuntime } from '../services/extensionProvider';
import { SourceTrackingCacheService } from '../services/sourceTrackingCacheService';
import { createCustomFieldNode } from './customField';
import { isFolderType, OrgBrowserTreeItem, SINGLE_FILE_ADAPTER, type SyncState } from './orgBrowserNode';
import { MetadataListResultItem, MetadataDescribeResultItem } from './types';

/** Cached org-side component counts, populated when a type is expanded (listMetadata results) */
const orgComponentCounts = new Map<string, number>();

export type TypeViewMode = 'withContent' | 'localOnly' | 'orgOnly' | 'allTypes';
export const VIEW_MODES: readonly TypeViewMode[] = ['withContent', 'localOnly', 'orgOnly', 'allTypes'] as const;

const VIEW_MODE_CYCLE: Record<TypeViewMode, TypeViewMode> = {
  withContent: 'localOnly',
  localOnly: 'orgOnly',
  orgOnly: 'allTypes',
  allTypes: 'withContent'
};

type TypeFilterState = {
  viewMode: TypeViewMode;
  typeFilter: ReadonlySet<string> | undefined;
  componentFilter: string | undefined;
  creatableTypes: CreateCommandMap;
};

export class MetadataTypeTreeProvider implements vscode.TreeDataProvider<OrgBrowserTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<OrgBrowserTreeItem | undefined | void> = new vscode.EventEmitter();
  public readonly onDidChangeTreeData: vscode.Event<OrgBrowserTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private viewMode: TypeViewMode = 'withContent';
  private typeFilter: ReadonlySet<string> | undefined;
  private componentFilter: string | undefined;
  private creatableTypes: CreateCommandMap = new Map();

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

  public cycleViewMode(): TypeViewMode {
    this.viewMode = VIEW_MODE_CYCLE[this.viewMode];
    this._onDidChangeTreeData.fire();
    return this.viewMode;
  }

  public setTypeFilter(filter: ReadonlySet<string>, componentPattern?: string): void {
    this.typeFilter = filter;
    this.componentFilter = componentPattern;
    this._onDidChangeTreeData.fire();
  }

  public clearTypeFilter(): void {
    this.typeFilter = undefined;
    this.componentFilter = undefined;
    this._onDidChangeTreeData.fire();
  }

  public getComponentFilter(): string | undefined {
    return this.componentFilter;
  }

  public getViewMode(): TypeViewMode {
    return this.viewMode;
  }

  public setViewMode(mode: TypeViewMode): void {
    this.viewMode = mode;
    this._onDidChangeTreeData.fire();
  }

  public getTypeFilter(): ReadonlySet<string> | undefined {
    return this.typeFilter;
  }

  public setCreatableTypes(types: CreateCommandMap): void {
    this.creatableTypes = types;
  }

  // eslint-disable-next-line class-methods-use-this
  public getTreeItem(element: OrgBrowserTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: OrgBrowserTreeItem): Promise<OrgBrowserTreeItem[]> {
    return await getOrgBrowserRuntime().runPromise(
      getChildrenOfTreeItem(element, {
        viewMode: this.viewMode,
        typeFilter: this.typeFilter,
        componentFilter: this.componentFilter,
        creatableTypes: this.creatableTypes
      })
    );
  }
}

const applyChildFilters = (nodes: OrgBrowserTreeItem[], filterState: TypeFilterState): OrgBrowserTreeItem[] => {
  const afterViewMode =
    filterState.viewMode === 'localOnly'
      ? nodes.filter(n => n.localPath)
      : filterState.viewMode === 'orgOnly'
        ? nodes.filter(n => !n.localPath)
        : nodes;
  return filterState.componentFilter
    ? afterViewMode.filter(n => n.componentName?.toLowerCase().includes(filterState.componentFilter!.toLowerCase()))
    : afterViewMode;
};

const invalidateForNode = Effect.fn('invalidateForNode')(function* (node?: OrgBrowserTreeItem) {
  const svcProvider = yield* ExtensionProviderService;
  const api = yield* svcProvider.getServicesApi;
  const metadataDescribeService = yield* api.services.MetadataDescribeService;
  const trackingCache = yield* SourceTrackingCacheService;
  if (!node) {
    orgComponentCounts.clear();
    yield* trackingCache.invalidate;
    return yield* metadataDescribeService.invalidateDescribe();
  }
  if (node.kind === 'changesRoot' || node.kind === 'changesGroup' || node.kind === 'changedComponent') {
    return yield* trackingCache.invalidate;
  }
  if (node.kind === 'type') {
    orgComponentCounts.delete(node.xmlName);
    return yield* metadataDescribeService.invalidateListMetadata(node.xmlName);
  }
  if (node.kind === 'folderType') {
    orgComponentCounts.delete(node.xmlName);
    return yield* metadataDescribeService.invalidateListMetadata(`${node.xmlName}Folder`);
  }
  if (node.kind === 'folder' && node.xmlName && node.folderName)
    return yield* metadataDescribeService.invalidateListMetadata(`${node.xmlName}Folder`, node.folderName);
  if (node.kind === 'customObject' && node.componentName) {
    const objectName = node.namespace ? `${node.namespace}__${node.componentName}` : node.componentName;
    return yield* metadataDescribeService.invalidateSObjectDescribe(objectName);
  }
});

const getChildrenOfTreeItem = (element: OrgBrowserTreeItem | undefined, filterState: TypeFilterState) =>
  Effect.gen(function* () {
    const svcProvider = yield* ExtensionProviderService;
    const api = yield* svcProvider.getServicesApi;
    const metadataDescribeService = yield* api.services.MetadataDescribeService;
    const trackingCache = yield* SourceTrackingCacheService;
    // this could be the initial load, before the org is set.  Prevents duplication loads of root
    if (!(yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId) {
      return yield* Effect.succeed([]);
    }
    if (!element) {
      const [describeTypes, allChanges, projectComponentSet] = yield* Effect.all(
        [
          filterState.viewMode === 'allTypes'
            ? metadataDescribeService.describe()
            : metadataDescribeService.describeTypesWithContent(),
          trackingCache.getAllChanges(),
          api.services.ComponentSetService.getComponentSetFromProjectDirectories()
        ],
        { concurrency: 'unbounded' }
      );

      const localCountsByType = Array.from(projectComponentSet).reduce((acc, comp) => {
        const typeName = comp.type.name;
        acc.set(typeName, (acc.get(typeName) ?? 0) + 1);
        return acc;
      }, new Map<string, number>());

      const afterViewFilter =
        filterState.viewMode === 'localOnly'
          ? describeTypes.filter(t => localCountsByType.has(t.xmlName))
          : describeTypes;
      const types = filterState.typeFilter
        ? afterViewFilter.filter(t => filterState.typeFilter!.has(t.xmlName))
        : afterViewFilter;
      const typeNodes = types
        .toSorted((a, b) => (a.xmlName < b.xmlName ? -1 : 1))
        .map(mdapiDescribeToOrgBrowserNode(filterState.creatableTypes));

      // Build description combining content counts and change deltas
      typeNodes.forEach(node => {
        const descParts: string[] = [];

        const localCount = localCountsByType.get(node.xmlName) ?? 0;
        const orgCount = orgComponentCounts.get(node.xmlName);
        if (localCount > 0 || orgCount !== undefined) {
          const countParts = [`${localCount} local`];
          if (orgCount !== undefined) countParts.push(`${orgCount} in org`);
          descParts.push(countParts.join(' / '));
        }

        const changeCounts = computeChangeCountsForType(allChanges, node.xmlName);
        if (changeCounts) {
          const deltaParts = [
            changeCounts.local > 0 ? `${changeCounts.local}↑` : undefined,
            changeCounts.remote > 0 ? `${changeCounts.remote}↓` : undefined,
            changeCounts.conflicts > 0 ? `${changeCounts.conflicts}⚠` : undefined
          ].filter(Boolean);
          if (deltaParts.length > 0) descParts.push(deltaParts.join(' '));
        }

        if (descParts.length > 0) node.description = descParts.join(' · ');
      });

      // Prepend "Pending Changes" section if tracking is available and has changes
      const changesRoot = yield* buildChangesRootNode(trackingCache);
      return changesRoot ? [changesRoot, ...typeNodes] : typeNodes;
    }
    if (element.kind === 'changesRoot') {
      return yield* buildChangesGroupNodes(trackingCache);
    }
    if (element.kind === 'changesGroup') {
      return yield* buildChangedComponentNodes(trackingCache, element);
    }
    if (element.kind === 'changedComponent') return yield* Effect.succeed([]);
    if (element.kind === 'customObject') {
      const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
      const objectName = element.namespace ? `${element.namespace}__${element.componentName!}` : element.componentName!;
      const result = yield* metadataDescribeService.describeCustomObject(objectName);
      return yield* Effect.all(
        result.fields
          .filter(f => f.custom)
          .toSorted((a, b) => (a.name < b.name ? -1 : 1))
          .map(createCustomFieldNode(projectComponentSet)(element)),
        { concurrency: 'unbounded' }
      );
    }
    if (element.kind === 'folderType' || (element.kind === 'type' && isFolderType(element.xmlName))) {
      return yield* metadataDescribeService.listMetadata(`${element.xmlName}Folder`).pipe(
        Effect.map(folders => {
          const filtered = folders.filter(globalMetadataFilter);
          orgComponentCounts.set(element.xmlName, filtered.length);
          return filtered.map(listMetadataToFolder(element));
        })
      );
    }
    if (element.kind === 'type') {
      const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
      const registry = yield* api.services.MetadataRegistryService.getRegistryAccess();
      const adapter = registry.getTypeByName(element.xmlName)?.strategies?.adapter;
      const isPreviewableType = !adapter || adapter === SINGLE_FILE_ADAPTER || element.xmlName === 'ContentAsset';
      return yield* metadataDescribeService.listMetadata(element.xmlName).pipe(
        Effect.flatMap(components => {
          const filtered = components.filter(globalMetadataFilter);
          orgComponentCounts.set(element.xmlName, filtered.length);
          return Stream.fromIterable(filtered).pipe(
            Stream.mapEffect(c =>
              enrichComponentWithSyncState(trackingCache, projectComponentSet, element, c, isPreviewableType)
            ),
            Stream.runCollect,
            Effect.map(chunk => applyChildFilters(Array.from(chunk), filterState))
          );
        })
      );
    }
    if (element.kind === 'folder') {
      const { xmlName, folderName } = element;
      if (!xmlName || !folderName) return yield* Effect.succeed([]);
      const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
      // Metadata API bug: listMetadata({type: 'ReportFolder', folder: X}) ignores
      // the folder param and returns ALL report folders in the org regardless of X.
      // To avoid infinite nesting we call listMetadata(xmlName, folderName) instead
      // (e.g. type:'Report', folder:'unfiled$public') which correctly returns only
      // the components inside that specific folder.
      return yield* metadataDescribeService.listMetadata(xmlName, folderName).pipe(
        Effect.flatMap(components =>
          Stream.fromIterable(components.filter(globalMetadataFilter)).pipe(
            Stream.mapEffect(c => enrichFolderItemWithSyncState(trackingCache, projectComponentSet, element, c)),
            Stream.runCollect,
            Effect.map(chunk => applyChildFilters(Array.from(chunk), filterState))
          )
        )
      );
    }
    if (element.kind === 'component') return yield* Effect.succeed([]);

    return yield* Effect.die(new Error(`Unsupported node kind: ${JSON.stringify(element)}`));
  }).pipe(Effect.withSpan('getChildrenOfTreeItem', { attributes: { element: element?.xmlName } }));

const enrichComponentWithSyncState = (
  trackingCache: SourceTrackingCacheService,
  projectComponentSet: ComponentSet,
  element: OrgBrowserTreeItem,
  c: MetadataListResultItem,
  isPreviewableType = false
) =>
  Effect.gen(function* () {
    const filePaths = projectComponentSet.getComponentFilenamesByNameAndType({
      fullName: c.fullName,
      type: c.type
    });
    const filePresent = filePaths.length > 0;
    const syncState = yield* trackingCache.getSyncStateForComponent(c.type, c.fullName, filePresent);
    return new OrgBrowserTreeItem({
      kind: element.xmlName === 'CustomObject' ? 'customObject' : 'component',
      namespace: c.namespacePrefix,
      xmlName: element.xmlName,
      componentName: c.fullName,
      label: c.fullName,
      filePresent,
      syncState,
      localPath: filePaths[0],
      previewable: isPreviewableType && !filePresent
    });
  });

const enrichFolderItemWithSyncState = (
  trackingCache: SourceTrackingCacheService,
  projectComponentSet: ComponentSet,
  element: OrgBrowserTreeItem,
  c: MetadataListResultItem
) =>
  Effect.gen(function* () {
    const filePaths = projectComponentSet.getComponentFilenamesByNameAndType({
      fullName: c.fullName,
      type: c.type
    });
    const filePresent = filePaths.length > 0;
    const syncState = yield* trackingCache.getSyncStateForComponent(c.type, c.fullName, filePresent);
    return new OrgBrowserTreeItem({
      kind: 'component',
      namespace: c.namespacePrefix,
      xmlName: element.xmlName,
      folderName: element.folderName,
      componentName: c.fullName,
      label: c.fullName,
      filePresent,
      syncState,
      localPath: filePaths[0]
    });
  });

const listMetadataToFolder =
  (element: OrgBrowserTreeItem) =>
  (c: MetadataListResultItem): OrgBrowserTreeItem =>
    new OrgBrowserTreeItem({
      kind: 'folder',
      xmlName: element.xmlName,
      namespace: c.namespacePrefix,
      folderName: c.fullName,
      label: c.fullName
    });

const mdapiDescribeToOrgBrowserNode =
  (creatableTypes: CreateCommandMap) =>
  (t: MetadataDescribeResultItem): OrgBrowserTreeItem => {
    const kind = isFolderType(t.xmlName) ? 'folderType' : 'type';
    const node = new OrgBrowserTreeItem({ kind, xmlName: t.xmlName, label: t.xmlName });
    if (creatableTypes.has(t.xmlName)) node.contextValue = `${kind}_creatable`;
    return node;
  };

/** applies to all listMetadata calls */
const globalMetadataFilter = (i: MetadataListResultItem): boolean => hasFullName(i) && isSupportedManageableState(i);

const hasFullName = (i: MetadataListResultItem): boolean => Boolean(i.fullName);
const isSupportedManageableState = (i: MetadataListResultItem): boolean =>
  !i.manageableState || ['unmanaged', 'installedEditable', 'deprecatedEditable'].includes(i.manageableState);

const computeChangeCountsForType = (
  allChanges: StatusOutputRow[],
  type: string
): { local: number; remote: number; conflicts: number } | undefined => {
  const typeChanges = allChanges.filter(r => r.type === type);
  if (typeChanges.length === 0) return undefined;
  const counts = { local: 0, remote: 0, conflicts: 0 };
  typeChanges.forEach(row => {
    if (row.conflict) counts.conflicts++;
    else if (row.origin === 'local') counts.local++;
    else counts.remote++;
  });
  return counts;
};

// --- Pending Changes section ---

const rowToSyncState = (row: StatusOutputRow): SyncState => {
  if (row.conflict) return 'conflict';
  if (row.origin === 'remote' && row.state === 'delete') return 'remoteDeleted';
  if (row.origin === 'remote') return 'remoteOnly';
  return 'localOnly';
};

const buildChangesRootNode = (trackingCache: SourceTrackingCacheService) =>
  Effect.gen(function* () {
    const hasTracking = yield* trackingCache.hasTracking();
    if (!hasTracking) return undefined;
    const allChanges = yield* trackingCache.getAllChanges();
    if (allChanges.length === 0) return undefined;

    const counts = allChanges.reduce(
      (acc, row) => {
        if (row.conflict) return { ...acc, conflicts: acc.conflicts + 1 };
        if (row.origin === 'local') return { ...acc, local: acc.local + 1 };
        return { ...acc, remote: acc.remote + 1 };
      },
      { local: 0, remote: 0, conflicts: 0 }
    );

    const parts = [
      counts.local > 0 ? `${counts.local}↑` : undefined,
      counts.remote > 0 ? `${counts.remote}↓` : undefined,
      counts.conflicts > 0 ? `${counts.conflicts}⚠` : undefined
    ].filter(Boolean);

    const node = new OrgBrowserTreeItem({
      kind: 'changesRoot',
      xmlName: '',
      label: `Pending Changes (${parts.join(' ')})`
    });
    node.iconPath = new vscode.ThemeIcon('git-compare');
    return node;
  });

const buildChangesGroupNodes = (trackingCache: SourceTrackingCacheService) =>
  Effect.gen(function* () {
    const allChanges = yield* trackingCache.getAllChanges();

    const localChanges = allChanges.filter(r => !r.conflict && r.origin === 'local');
    const remoteChanges = allChanges.filter(r => !r.conflict && r.origin === 'remote');
    const conflictChanges = allChanges.filter(r => r.conflict);

    const groups = [
      conflictChanges.length > 0
        ? (() => {
            const node = new OrgBrowserTreeItem({
              kind: 'changesGroup',
              xmlName: 'conflicts',
              label: `Conflicts (${conflictChanges.length})`
            });
            node.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
            node.contextValue = 'changesGroup_conflicts';
            return node;
          })()
        : undefined,
      remoteChanges.length > 0
        ? (() => {
            const node = new OrgBrowserTreeItem({
              kind: 'changesGroup',
              xmlName: 'remote',
              label: `Remote Changes (${remoteChanges.length})`
            });
            node.iconPath = new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('charts.blue'));
            node.contextValue = 'changesGroup_remote';
            return node;
          })()
        : undefined,
      localChanges.length > 0
        ? (() => {
            const node = new OrgBrowserTreeItem({
              kind: 'changesGroup',
              xmlName: 'local',
              label: `Local Changes (${localChanges.length})`
            });
            node.iconPath = new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('charts.yellow'));
            node.contextValue = 'changesGroup_local';
            return node;
          })()
        : undefined
    ].filter((n): n is OrgBrowserTreeItem => n !== undefined);
    return groups;
  });

const filterByGroup = (allChanges: StatusOutputRow[], group: string): StatusOutputRow[] => {
  switch (group) {
    case 'conflicts':
      return allChanges.filter(r => r.conflict);
    case 'remote':
      return allChanges.filter(r => !r.conflict && r.origin === 'remote');
    case 'local':
      return allChanges.filter(r => !r.conflict && r.origin === 'local');
    default:
      return [];
  }
};

const buildChangedComponentNodes = (trackingCache: SourceTrackingCacheService, element: OrgBrowserTreeItem) =>
  Effect.gen(function* () {
    const allChanges = yield* trackingCache.getAllChanges();
    const filtered = filterByGroup(allChanges, element.xmlName);

    return filtered
      .toSorted((a, b) => `${a.type}:${a.fullName}`.localeCompare(`${b.type}:${b.fullName}`))
      .map(
        row =>
          new OrgBrowserTreeItem({
            kind: 'changedComponent',
            xmlName: row.type,
            componentName: row.fullName,
            label: `${row.type}: ${row.fullName}`,
            syncState: rowToSyncState(row)
          })
      );
  });
