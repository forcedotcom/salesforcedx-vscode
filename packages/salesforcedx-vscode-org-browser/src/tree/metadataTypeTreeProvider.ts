/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import { isUndefined } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { getOrgBrowserRuntime } from '../services/extensionProvider';
import { matchesPattern, MAX_TYPES_FOR_COMPONENT_PREFETCH } from '../utils/wildcardPattern';
import { createCustomFieldNode } from './customField';
import {
  isCustomObjectNode,
  isFolderListingNode,
  isFolderNode,
  isFolderType,
  OrgBrowserTreeItem
} from './orgBrowserNode';
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
    Match.when(isFolderNode, n => metadataDescribeService.invalidateListMetadata(`${n.xmlName}Folder`, n.folderName)),
    Match.when(isCustomObjectNode, n =>
      metadataDescribeService.invalidateSObjectDescribe(
        n.namespace ? `${n.namespace}__${n.componentName}` : n.componentName
      )
    ),
    Match.orElse(() => Effect.void)
  );
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
    // orgOnly: show all components from org (inclusive - whether or not they also exist locally)
    return nodes;
  })();

  if (!provider.componentFilter || provider.componentFilter === '') return viewModeFiltered;
  const componentFilter = provider.componentFilter;
  return viewModeFiltered.filter(
    n => n.componentName && matchesPattern(n.componentName, componentFilter, provider.componentIsRegex)
  );
};

/** Resolve MetadataDescribeService through the extension's services API. */
const getMetadataDescribeService = ExtensionProviderService.pipe(
  Effect.flatMap(svc => svc.getServicesApi),
  Effect.flatMap(api => api.services.MetadataDescribeService)
);

/** For folder types, list the folders themselves (e.g. ReportFolder, EmailTemplateFolder); otherwise the type. */
const typeToListName = (typeNode: OrgBrowserTreeItem): string =>
  typeNode.kind === 'folderType' ? `${typeNode.xmlName}Folder` : typeNode.xmlName;

const typeNodeToItem = (typeNode: OrgBrowserTreeItem): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({ kind: typeNode.kind, xmlName: typeNode.xmlName, label: typeNode.xmlName });

/** ≥1 component's fullName matches the active component filter. */
const hasMatchingComponent =
  (provider: MetadataTypeTreeProvider) =>
  (components: MetadataListResultItem[]): boolean =>
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
  const metadataDescribeService = yield* getMetadataDescribeService;
  return yield* Effect.all(
    typeNodes.map(typeNode =>
      metadataDescribeService.listMetadata(typeToListName(typeNode)).pipe(
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
  const metadataDescribeService = yield* getMetadataDescribeService;
  return yield* Effect.all(
    typeNodes.map(typeNode =>
      metadataDescribeService.listMetadataCached(typeToListName(typeNode)).pipe(
        // None → not cached → excluded (strict); Some → keep the type only if a component matches
        Effect.map(
          Option.flatMap(components =>
            hasMatchingComponent(provider)(components) ? Option.some(typeNodeToItem(typeNode)) : Option.none()
          )
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

      // localOnly (showLocal && !showOrg): keep only types with local source files.
      // Both-ON and orgOnly: every type passes (all types exist in the org by definition,
      // and org-side is inclusive of local). Absent gate → all types pass.
      const localTypeGate = provider.showOrg
        ? Option.none<ReadonlySet<string>>()
        : Option.some(
            new Set(
              Array.from(
                (yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories()).getSourceComponents(),
                comp => comp.type.name
              )
            )
          );
      const typeFilteredNodes = allNodes.filter(
        node =>
          Option.match(localTypeGate, { onNone: () => true, onSome: names => names.has(node.xmlName) }) &&
          passesTypeFilter(node, provider)
      );
      const result = yield* applyComponentFilter(typeFilteredNodes, provider);

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
      Match.when(isFolderListingNode, el =>
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
      Match.when(isFolderNode, el =>
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
