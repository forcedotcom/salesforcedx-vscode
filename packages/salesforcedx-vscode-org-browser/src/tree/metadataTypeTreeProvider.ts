/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { getOrgBrowserRuntime } from '../services/extensionProvider';
import { matchesPattern, MAX_TYPES_FOR_COMPONENT_PREFETCH } from '../utils/wildcardPattern';
import { createCustomFieldNode } from './customField';
import { isFolderType, OrgBrowserTreeItem } from './orgBrowserNode';
import { MetadataListResultItem, MetadataDescribeResultItem } from './types';

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
  const metadataDescribeService = yield* api.services.MetadataDescribeService;
  return yield* Match.value(node).pipe(
    Match.when(Match.undefined, () => metadataDescribeService.invalidateDescribe()),
    Match.when({ kind: 'type' }, n => metadataDescribeService.invalidateListMetadata(n.xmlName)),
    Match.when({ kind: 'folderType' }, n => metadataDescribeService.invalidateListMetadata(`${n.xmlName}Folder`)),
    Match.when(
      (n): n is OrgBrowserTreeItem & { xmlName: string; folderName: string } =>
        n.kind === 'folder' && Boolean(n.xmlName) && Boolean(n.folderName),
      n => metadataDescribeService.invalidateListMetadata(`${n.xmlName}Folder`, n.folderName)
    ),
    Match.when(
      (n): n is OrgBrowserTreeItem & { componentName: string } => n.kind === 'customObject' && Boolean(n.componentName),
      n =>
        metadataDescribeService.invalidateSObjectDescribe(
          n.namespace ? `${n.namespace}__${n.componentName}` : n.componentName
        )
    ),
    Match.orElse(() => Effect.void)
  );
});

export const passesTypeFilter = (node: OrgBrowserTreeItem, provider: MetadataTypeTreeProvider): boolean => {
  if (provider.typeFilter === undefined) return true;
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
    // orgOnly: show all components from org (inclusive - whether or not they also exist locally)
    return nodes;
  })();

  if (!provider.componentFilter || provider.componentFilter === '') return viewModeFiltered;
  const componentFilter = provider.componentFilter;
  return viewModeFiltered.filter(
    n => n.componentName && matchesPattern(n.componentName, componentFilter, provider.componentIsRegex)
  );
};

/**
 * Types with ≥1 component matching filter. Live-fetches components.
 * AND logic: type:component returns types with matching components only.
 */
const filterTypesWithMatchingComponents = <E, R>(
  typeNodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider,
  metadataDescribeService: {
    listMetadata: (type: string) => Effect.Effect<MetadataListResultItem[], E, R>;
  }
) =>
  Effect.gen(function* () {
    const componentFilter = provider.componentFilter!;
    const componentIsRegex = provider.componentIsRegex;
    const typesWithMatchingComponents = yield* Effect.all(
      typeNodes.map(typeNode =>
        Effect.gen(function* () {
          // For folder types, we need to list the folders themselves (e.g., ReportFolder, EmailTemplateFolder)
          const typeToList = typeNode.kind === 'folderType' ? `${typeNode.xmlName}Folder` : typeNode.xmlName;
          // List components for this type
          const components = yield* metadataDescribeService.listMetadata(typeToList);
          const hasMatch = components.some(
            c => c.fullName && matchesPattern(c.fullName, componentFilter, componentIsRegex)
          );
          return { typeNode, hasMatch };
        })
      ),
      { concurrency: 10 }
    );
    return typesWithMatchingComponents
      .filter(t => t.hasMatch)
      .map(
        t =>
          new OrgBrowserTreeItem({
            kind: t.typeNode.kind,
            xmlName: t.typeNode.xmlName,
            label: t.typeNode.xmlName
          })
      );
  });

/**
 * Cached components matching filter. Excludes uncached types (strict—can't confirm match).
 * Used when >25 types matched to avoid excessive API calls.
 */
const filterTypesWithCachedComponents = <E, R>(
  typeNodes: OrgBrowserTreeItem[],
  provider: MetadataTypeTreeProvider,
  metadataDescribeService: {
    listMetadataCached: (type: string) => Effect.Effect<Option.Option<MetadataListResultItem[]>, E, R>;
  }
) =>
  Effect.gen(function* () {
    const componentFilter = provider.componentFilter!;
    const componentIsRegex = provider.componentIsRegex;
    const results = yield* Effect.all(
      typeNodes.map(typeNode =>
        Effect.gen(function* () {
          const typeToList = typeNode.kind === 'folderType' ? `${typeNode.xmlName}Folder` : typeNode.xmlName;
          const cached = yield* metadataDescribeService.listMetadataCached(typeToList);
          // Not cached → excluded (strict: can't confirm match)
          if (Option.isNone(cached)) return null;
          // Cached → check for matching components
          const hasMatch = cached.value.some(
            c => c.fullName && matchesPattern(c.fullName, componentFilter, componentIsRegex)
          );
          if (!hasMatch) return null;
          return new OrgBrowserTreeItem({
            kind: typeNode.kind,
            xmlName: typeNode.xmlName,
            label: typeNode.xmlName
          });
        })
      ),
      { concurrency: 'unbounded' } // no API calls, just cache reads
    );
    return results.filter((n): n is OrgBrowserTreeItem => n !== null);
  });

const getChildrenOfTreeItem = (element: OrgBrowserTreeItem | undefined, provider: MetadataTypeTreeProvider) =>
  Effect.gen(function* () {
    const svcProvider = yield* ExtensionProviderService;
    const api = yield* svcProvider.getServicesApi;
    const metadataDescribeService = yield* api.services.MetadataDescribeService;
    // this could be the initial load, before the org is set.  Prevents duplication loads of root
    if (!(yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId) {
      return yield* Effect.succeed([]);
    }
    if (!element) {
      // Both OFF = empty tree (explicit "show nothing" state)
      if (!provider.showLocal && !provider.showOrg) {
        yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.treeEmpty', true));
        return [];
      }

      const types = yield* metadataDescribeService.describe();
      const allNodes = types.toSorted((a, b) => (a.xmlName < b.xmlName ? -1 : 1)).map(mdapiDescribeToOrgBrowserNode);

      const result = yield* (() => {
        // Both ON = show everything
        if (provider.showLocal && provider.showOrg) {
          return Effect.gen(function* () {
            const typeFilteredNodes = allNodes.filter(node => passesTypeFilter(node, provider));
            // If component filter is active, pre-filter types that have no matching components
            if (provider.componentFilter && provider.componentFilter !== '') {
              if (typeFilteredNodes.length <= MAX_TYPES_FOR_COMPONENT_PREFETCH || provider.userApprovedBroadFetch) {
                // Under threshold or user approved: full fetch
                return yield* filterTypesWithMatchingComponents(typeFilteredNodes, provider, metadataDescribeService);
              }
              // Over threshold: cache-only (strict — unfetched types hidden)
              return yield* filterTypesWithCachedComponents(typeFilteredNodes, provider, metadataDescribeService);
            }
            // No component filter: return all type-filtered nodes
            return typeFilteredNodes;
          });
        }
        // localOnly mode: show only types that have local source files
        if (provider.showLocal && !provider.showOrg) {
          return Effect.gen(function* () {
            const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
            const localTypeNames = new Set<string>(
              Array.from(projectComponentSet.getSourceComponents(), comp => comp.type.name)
            );
            const typeFilteredNodes = allNodes.filter(
              node => localTypeNames.has(node.xmlName) && passesTypeFilter(node, provider)
            );
            // If component filter is active, pre-filter types that have no matching components
            if (provider.componentFilter && provider.componentFilter !== '') {
              if (typeFilteredNodes.length <= MAX_TYPES_FOR_COMPONENT_PREFETCH || provider.userApprovedBroadFetch) {
                // Under threshold or user approved: full fetch
                return yield* filterTypesWithMatchingComponents(typeFilteredNodes, provider, metadataDescribeService);
              }
              // Over threshold: cache-only (strict — unfetched types hidden)
              return yield* filterTypesWithCachedComponents(typeFilteredNodes, provider, metadataDescribeService);
            }
            // No component filter: return all type-filtered nodes
            return typeFilteredNodes;
          });
        }
        // orgOnly mode: show all types (all types exist in the org by definition)
        // Child-level shows all org components (inclusive of those also in local)
        return Effect.gen(function* () {
          const typeFilteredNodes = allNodes.filter(node => passesTypeFilter(node, provider));
          // If component filter is active, pre-filter types that have no matching components
          if (provider.componentFilter && provider.componentFilter !== '') {
            if (typeFilteredNodes.length <= MAX_TYPES_FOR_COMPONENT_PREFETCH || provider.userApprovedBroadFetch) {
              // Under threshold or user approved: full fetch
              return yield* filterTypesWithMatchingComponents(typeFilteredNodes, provider, metadataDescribeService);
            }
            // Over threshold: cache-only (strict — unfetched types hidden)
            return yield* filterTypesWithCachedComponents(typeFilteredNodes, provider, metadataDescribeService);
          }
          // Return type-filtered nodes
          return typeFilteredNodes;
        });
      })();

      yield* Effect.promise(() =>
        vscode.commands.executeCommand('setContext', 'sf:orgBrowser.treeEmpty', result.length === 0)
      );
      return result;
    }
    return yield* Match.value(element).pipe(
      Match.when({ kind: 'customObject' }, el =>
        // assertion: componentName is not undefined for customObject nodes.  TODO: clever TS to enforce that
        Effect.gen(function* () {
          const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
          const result = yield* metadataDescribeService.describeCustomObject(
            el.namespace ? `${el.namespace}__${el.componentName!}` : el.componentName!
          );
          return yield* Effect.all(
            result.fields
              // TO REVIEW: only custom fields can be retrieved.  Is it useful to show the standard fields?  If so, we could hide the retrieve icon
              .filter(f => f.custom)
              .toSorted((a, b) => (a.name < b.name ? -1 : 1))
              .map(createCustomFieldNode(projectComponentSet)(el)),
            { concurrency: 'unbounded' }
          );
        })
      ),
      Match.when(
        (el: OrgBrowserTreeItem) => el.kind === 'folderType' || (el.kind === 'type' && isFolderType(el.xmlName)),
        el =>
          metadataDescribeService
            .listMetadata(`${el.xmlName}Folder`)
            .pipe(Effect.map(folders => folders.filter(globalMetadataFilter).map(listMetadataToFolder(el))))
      ),
      Match.when({ kind: 'type' }, el =>
        Effect.gen(function* () {
          const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
          const components = yield* metadataDescribeService.listMetadata(el.xmlName);
          return yield* Stream.fromIterable(components.filter(globalMetadataFilter)).pipe(
            Stream.map(c => listMetadataToComponent(projectComponentSet)(el)(c)),
            Stream.runCollect,
            Effect.map(chunk => applyViewModeChildFilter(Array.from(chunk), provider))
          );
        })
      ),
      Match.when(
        (el): el is OrgBrowserTreeItem & { xmlName: string; folderName: string } =>
          el.kind === 'folder' && Boolean(el.xmlName) && Boolean(el.folderName),
        el =>
          // Metadata API bug: listMetadata({type: 'ReportFolder', folder: X}) ignores
          // the folder param and returns ALL report folders in the org regardless of X.
          // To avoid infinite nesting we call listMetadata(xmlName, folderName) instead
          // (e.g. type:'Report', folder:'unfiled$public') which correctly returns only
          // the components inside that specific folder.
          Effect.gen(function* () {
            const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
            const components = yield* metadataDescribeService.listMetadata(el.xmlName, el.folderName);
            return yield* Stream.fromIterable(components.filter(globalMetadataFilter)).pipe(
              Stream.map(c => listMetadataToFolderItem(projectComponentSet)(el)(c)),
              Stream.runCollect,
              Effect.map(chunk => applyViewModeChildFilter(Array.from(chunk), provider))
            );
          })
      ),
      Match.when({ kind: 'folder' }, () => Effect.succeed<OrgBrowserTreeItem[]>([])),
      Match.when({ kind: 'component' }, () => Effect.succeed<OrgBrowserTreeItem[]>([])),
      Match.orElse(el => Effect.die(new Error(`Unsupported node kind: ${JSON.stringify(el)}`)))
    );
  }).pipe(Effect.withSpan('getChildrenOfTreeItem', { attributes: { element: element?.xmlName } }));

const listMetadataToComponent =
  (projectComponentSet: ComponentSet) =>
  (element: OrgBrowserTreeItem) =>
  (c: MetadataListResultItem): OrgBrowserTreeItem => {
    const filePaths = projectComponentSet.getComponentFilenamesByNameAndType({
      fullName: c.fullName,
      type: c.type
    });
    return new OrgBrowserTreeItem({
      kind: element.xmlName === 'CustomObject' ? 'customObject' : 'component',
      namespace: c.namespacePrefix,
      xmlName: element.xmlName,
      componentName: c.fullName,
      label: c.fullName,
      filePresent: filePaths.length > 0
    });
  };

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

const listMetadataToFolderItem =
  (projectComponentSet: ComponentSet) =>
  (element: OrgBrowserTreeItem) =>
  (c: MetadataListResultItem): OrgBrowserTreeItem => {
    const filePaths = projectComponentSet.getComponentFilenamesByNameAndType({
      fullName: c.fullName,
      type: c.type
    });
    return new OrgBrowserTreeItem({
      kind: 'component',
      namespace: c.namespacePrefix,
      xmlName: element.xmlName,
      folderName: element.folderName,
      componentName: c.fullName,
      label: c.fullName,
      filePresent: filePaths.length > 0
    });
  };

const mdapiDescribeToOrgBrowserNode = (t: MetadataDescribeResultItem): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({
    kind: isFolderType(t.xmlName) ? 'folderType' : 'type',
    xmlName: t.xmlName,
    label: t.xmlName
  });

/** applies to all listMetadata calls */
const globalMetadataFilter = (i: MetadataListResultItem): boolean => hasFullName(i) && isSupportedManageableState(i);

const hasFullName = (i: MetadataListResultItem): boolean => Boolean(i.fullName);
const isSupportedManageableState = (i: MetadataListResultItem): boolean =>
  !i.manageableState || ['unmanaged', 'installedEditable', 'deprecatedEditable'].includes(i.manageableState);
