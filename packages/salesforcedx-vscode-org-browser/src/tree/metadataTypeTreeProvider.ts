/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { CustomObjectField, MetadataDescribeResultItem, MetadataListResultItem } from './types';
import type { FilterState, FilterStateService } from '../services/filterStateService';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { FilePresenceService, queueFilePresenceCheck } from '../services/filePresenceService';
import { createCustomFieldNode } from './customField';
import { isRetrievableComponent } from './filters';
import { isFolderType, OrgBrowserTreeItem } from './orgBrowserNode';
import {
  createErrorNode,
  describeResultToNode,
  listResultToComponentNode,
  listResultToFolderItemNode,
  listResultToFolderNode
} from './transformers';

/** Parse search query - supports simple text or Type:Name format */
const parseSearchQuery = (query: string): { type?: string; name?: string } => {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex > 0) {
    // Structured search: Type:Name
    const type = trimmed.slice(0, colonIndex).trim();
    const name = trimmed.slice(colonIndex + 1).trim();
    return { type: type || undefined, name: name || undefined };
  }

  // Simple text search - matches component name
  return { name: trimmed };
};

/** Check if a tree item matches the search query */
const matchesSearch = (item: OrgBrowserTreeItem, query: { type?: string; name?: string }): boolean => {
  if (!query.type && !query.name) return true;

  // Type match (case-insensitive)
  if (query.type && !item.xmlName.toLowerCase().includes(query.type.toLowerCase())) {
    return false;
  }

  // Name match (case-insensitive) - check both componentName and label
  if (query.name) {
    const nameToCheck = item.componentName ?? item.label?.toString() ?? '';
    if (!nameToCheck.toLowerCase().includes(query.name.toLowerCase())) {
      return false;
    }
  }

  return true;
};

/** Counts for a node's children */
type NodeCounts = { total: number; local: number };

/** Calculate counts for children */
const calculateCounts = (children: OrgBrowserTreeItem[]): NodeCounts => {
  const total = children.length;
  const local = children.filter(c => c.filePresent === true).length;
  return { total, local };
};

/** Format the description string for counts */
const formatCountDescription = (counts: NodeCounts): string => {
  if (counts.local > 0) {
    return `(${counts.local}/${counts.total})`;
  }
  return `(${counts.total})`;
};

/** Debounce delay for tree change events (ms) */
const DEBOUNCE_DELAY = 100;

export class MetadataTypeTreeProvider implements vscode.TreeDataProvider<OrgBrowserTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<OrgBrowserTreeItem | undefined | void> = new vscode.EventEmitter();
  public readonly onDidChangeTreeData: vscode.Event<OrgBrowserTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  /** Current filter state */
  private filterState: FilterState = { showLocalOnly: false, hideManaged: false, searchQuery: '' };

  /** Cache of children by node id for count updates */
  private childrenCache: Map<string, OrgBrowserTreeItem[]> = new Map();

  /** Cache of parent nodes by id for description updates */
  private parentNodeCache: Map<string, OrgBrowserTreeItem> = new Map();

  /** Cache of all tree items by id for lookup */
  private allItemsCache: Map<string, OrgBrowserTreeItem> = new Map();

  /** Pending debounced fire timeout */
  private pendingFireTimeout: ReturnType<typeof setTimeout> | undefined;

  /** Current org identifier for cache invalidation */
  private currentOrgId: string | undefined;

  /** Set the filter state service and initialize filter state */
  public setFilterService(service: FilterStateService): void {
    this.filterState = service.getState();
  }

  /** Clear all caches - should be called when org changes */
  public clearCache(): void {
    this.childrenCache.clear();
    this.parentNodeCache.clear();
    this.allItemsCache.clear();
  }

  /** Find a tree item by its ID from the cache */
  public findTreeItemById(id: string): OrgBrowserTreeItem | undefined {
    return this.allItemsCache.get(id);
  }

  /** Update org ID and clear cache if org changed */
  public setOrgId(orgId: string | undefined): void {
    if (this.currentOrgId !== orgId) {
      this.currentOrgId = orgId;
      this.clearCache();
    }
  }

  /** Update filter state (called by filter service onChange) */
  public updateFilterState(state: FilterState): void {
    this.filterState = state;
    // Don't clear cache - cached children are object references, so filePresent updates
    // on nodes (like after retrieval) are already reflected in the cached arrays.
    // Filtering will work correctly without expensive cache clearing and API re-fetches.
  }

  /** Update the counts for a parent node based on its cached children */
  public updateNodeCounts(parentId: string): void {
    const children = this.childrenCache.get(parentId);
    const parent = this.parentNodeCache.get(parentId);
    if (!children || !parent) return;

    const counts = calculateCounts(children);
    parent.description = formatCountDescription(counts);
  }

  /** fire the onDidChangeTreeData event for the node to cause vscode ui to update */
  /** Fire the onDidChangeTreeData event immediately */
  public fireChangeEvent(node?: OrgBrowserTreeItem): void {
    this._onDidChangeTreeData.fire(node);
  }

  /** Fire the onDidChangeTreeData event with debouncing (for batched updates) */
  public fireChangeEventDebounced(): void {
    if (this.pendingFireTimeout) {
      clearTimeout(this.pendingFireTimeout);
    }
    this.pendingFireTimeout = setTimeout(() => {
      this.pendingFireTimeout = undefined;
      this._onDidChangeTreeData.fire();
    }, DEBOUNCE_DELAY);
  }

  /**
   * Refreshes only the given type node in the tree.  Fires the onDidChangeTreeData so you don't have to
   */
  public async refreshType(node?: OrgBrowserTreeItem): Promise<void> {
    // Cancel any pending file presence checks for this node
    await Effect.runPromise(
      Effect.gen(function* () {
        const filePresenceService = yield* FilePresenceService;
        const batchId = node?.id ?? 'root';
        filePresenceService.cancelBatch(batchId);
      })
        .pipe(Effect.provide(AllServicesLayer))
        .pipe(Effect.catchAll(() => Effect.succeed(undefined)))
    );

    // Clear cache for this node so we fetch fresh data
    if (node?.id) {
      this.childrenCache.delete(node.id);
    }

    const treeProvider = this;
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.promise(() => treeProvider.getChildren(node, true));
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            // Always fire change event so tree updates (even on error, to clear stale data)
            treeProvider._onDidChangeTreeData.fire(node);
          })
        )
      )
    );
  }

  // eslint-disable-next-line class-methods-use-this
  public getTreeItem(element: OrgBrowserTreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: OrgBrowserTreeItem, refresh = false): Promise<OrgBrowserTreeItem[]> {
    // Return cached children if available and not explicitly refreshing
    // This prevents infinite loops when fireChangeEvent triggers getChildren
    if (!refresh && element?.id) {
      const cached = this.childrenCache.get(element.id);
      if (cached) {
        return this.applyFilters(cached, element);
      }
    }

    const treeProvider = this;
    return Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* getChildrenOfTreeItem(element, refresh, treeProvider);

        // Cache children and parent for count updates
        if (element?.id) {
          treeProvider.childrenCache.set(element.id, result);
          treeProvider.parentNodeCache.set(element.id, element);
          treeProvider.allItemsCache.set(element.id, element);
          // Set initial count description
          const counts = calculateCounts(result);
          element.description = formatCountDescription(counts);
        }
        // Cache all child items by their IDs
        result.forEach((child: OrgBrowserTreeItem) => {
          if (child.id) {
            treeProvider.allItemsCache.set(child.id, child);
          }
        });

        // Apply filters to component-level nodes
        const filtered = treeProvider.applyFilters(result, element);
        return filtered;
      }).pipe(
        Effect.catchAll((error: unknown) => {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          console.error('[Org Browser] Error fetching children:', errorObj.message);

          // For root level, show an error message node
          if (!element) {
            return Effect.succeed([createErrorNode(errorObj.message)]);
          }
          // For child nodes, return empty (parent still shows, but no children)
          return Effect.succeed([]);
        })
      )
    );
  }

  /** Apply active filters to the result set */
  private applyFilters(items: OrgBrowserTreeItem[], parent?: OrgBrowserTreeItem): OrgBrowserTreeItem[] {
    const { showLocalOnly, hideManaged, searchQuery } = this.filterState;
    const parsedSearch = parseSearchQuery(searchQuery);

    // For root level (metadata types), filter by type name if search has a type component
    if (!parent) {
      if (parsedSearch.type) {
        return items.filter(item => item.xmlName.toLowerCase().includes(parsedSearch.type!.toLowerCase()));
      }
      return items;
    }

    // For component-level nodes, apply all filters
    return items.filter(item => {
      // Local only filter - skip items that aren't present locally
      // Note: filePresence may be undefined during async check, so only filter when explicitly false
      if (showLocalOnly && item.filePresent === false) {
        return false;
      }

      // Hide managed filter - skip items with a namespace prefix
      if (hideManaged && item.namespace) {
        return false;
      }

      // Search filter
      if (!matchesSearch(item, parsedSearch)) {
        return false;
      }

      return true;
    });
  }
}

/** Process items with file presence checks and start batch tracking */
const processWithBatchTracking = <T>(
  items: readonly T[],
  createNode: (item: T) => Effect.Effect<OrgBrowserTreeItem, Error, never>,
  filePresenceService: FilePresenceService,
  batchId: string
): Effect.Effect<OrgBrowserTreeItem[], Error, never> =>
  Effect.gen(function* () {
    const nodes = yield* Effect.all(items.map(createNode), { concurrency: 'unbounded' });
    if (items.length > 0) {
      void filePresenceService.startBatch(batchId, items.length).catch(() => {
        // Batch was cancelled - that's okay
      });
    }
    return nodes;
  });

const getChildrenOfTreeItem = (
  element: OrgBrowserTreeItem | undefined,
  refresh: boolean,
  treeProvider: MetadataTypeTreeProvider
): Effect.Effect<OrgBrowserTreeItem[], Error, never> =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  Effect.gen(function* () {
    const [svcProvider, filePresenceService] = yield* Effect.all([ExtensionProviderService, FilePresenceService]);
    const api = yield* svcProvider.getServicesApi;
    const describeService = yield* api.services.MetadataDescribeService;
    const batchId = element?.id ?? 'root';

    if (!element) {
      const types = yield* describeService.describe(refresh);
      return types
        .toSorted((a: MetadataDescribeResultItem, b: MetadataDescribeResultItem) => (a.xmlName < b.xmlName ? -1 : 1))
        .map(describeResultToNode);
    }
    if (element.kind === 'customObject') {
      // assertion: componentName is not undefined for customObject nodes.  TODO: clever TS to enforce that
      const objectName = element.namespace ? `${element.namespace}__${element.componentName!}` : element.componentName!;
      const result = yield* describeService.describeCustomObject(objectName);
      const customFields = result.fields
        .filter((f: CustomObjectField) => f.custom)
        .toSorted((a: CustomObjectField, b: CustomObjectField) => (a.name < b.name ? -1 : 1));
      return yield* processWithBatchTracking(
        customFields,
        createCustomFieldNode(filePresenceService, batchId, treeProvider.fireChangeEvent.bind(treeProvider))(element),
        filePresenceService,
        batchId
      );
    }
    if (element.kind === 'folderType' || (element.kind === 'type' && isFolderType(element.xmlName))) {
      const folders = yield* describeService.listMetadata(`${element.xmlName}Folder`);
      const retrievableFolders: MetadataListResultItem[] = folders.filter(isRetrievableComponent);
      return retrievableFolders.map((c: MetadataListResultItem) => listResultToFolderNode(element, c));
    }
    if (element.kind === 'type') {
      const components = yield* describeService.listMetadata(element.xmlName);
      const retrievable: MetadataListResultItem[] = components.filter(isRetrievableComponent);
      return yield* processWithBatchTracking(
        retrievable,
        (c: MetadataListResultItem) =>
          createComponentWithFileCheck(filePresenceService, treeProvider, element, c, batchId),
        filePresenceService,
        batchId
      );
    }
    if (element.kind === 'folder') {
      const { xmlName, folderName } = element;
      if (!xmlName || !folderName) return [];
      const components = yield* describeService.listMetadata(xmlName, folderName);
      const retrievable: MetadataListResultItem[] = components.filter(isRetrievableComponent);
      return yield* processWithBatchTracking(
        retrievable,
        (c: MetadataListResultItem) =>
          createFolderItemWithFileCheck(filePresenceService, treeProvider, element, c, batchId),
        filePresenceService,
        batchId
      );
    }

    return yield* Effect.die(new Error(`Unsupported node kind: ${element.kind}`));
  }).pipe(
    Effect.withSpan('getChildrenOfTreeItem', { attributes: { element: element?.xmlName, refresh } }),
    Effect.mapError((error: unknown) => (error instanceof Error ? error : new Error(String(error)))),
    Effect.provide(AllServicesLayer)
  ) as Effect.Effect<OrgBrowserTreeItem[], Error, never>;

/** Create a component node and queue a file presence check */
const createComponentWithFileCheck = (
  filePresenceService: FilePresenceService,
  treeProvider: MetadataTypeTreeProvider,
  element: OrgBrowserTreeItem,
  c: MetadataListResultItem,
  batchId: string
): Effect.Effect<OrgBrowserTreeItem, Error, never> =>
  Effect.gen(function* () {
    const treeItem = listResultToComponentNode(element, c);
    // Use fireChangeEvent (not debounced) for individual node icon updates
    yield* queueFilePresenceCheck(
      filePresenceService,
      treeItem,
      c,
      batchId,
      treeProvider.fireChangeEvent.bind(treeProvider)
    );
    return treeItem;
  }).pipe(
    Effect.withSpan('createComponentWithFileCheck', {
      attributes: { xmlName: element.xmlName, componentName: c.fullName }
    })
  );

/** Create a folder item node and queue a file presence check */
const createFolderItemWithFileCheck = (
  filePresenceService: FilePresenceService,
  treeProvider: MetadataTypeTreeProvider,
  element: OrgBrowserTreeItem,
  c: MetadataListResultItem,
  batchId: string
): Effect.Effect<OrgBrowserTreeItem, Error, never> =>
  Effect.gen(function* () {
    const treeItem = listResultToFolderItemNode(element, c);
    // Use fireChangeEvent (not debounced) for individual node icon updates
    yield* queueFilePresenceCheck(
      filePresenceService,
      treeItem,
      c,
      batchId,
      treeProvider.fireChangeEvent.bind(treeProvider)
    );
    return treeItem;
  }).pipe(
    Effect.withSpan('createFolderItemWithFileCheck', {
      attributes: { xmlName: element.xmlName, componentName: c.fullName }
    })
  );
