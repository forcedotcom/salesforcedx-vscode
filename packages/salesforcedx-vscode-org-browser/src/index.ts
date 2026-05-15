/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { resolveAvailableCreateCommands } from './commands/createComponent';
import { retrieveEffect } from './commands/retrieveMetadata';
import { EXTENSION_NAME, TREE_VIEW_ID } from './constants';
import { AssetPreviewFs, ASSET_PREVIEW_SCHEME } from './services/assetPreviewFs';
import {
  AllServicesLayer,
  buildAllServicesLayer,
  getOrgBrowserRuntime,
  setAllServicesLayer
} from './services/extensionProvider';
import { OrgBrowserRetrieveService } from './services/orgBrowserMetadataRetrieveService';
import { SourceTrackingCacheService } from './services/sourceTrackingCacheService';
import { MetadataTypeTreeProvider, VIEW_MODES, type TypeViewMode } from './tree/metadataTypeTreeProvider';

const viewModeSet: ReadonlySet<string> = new Set(VIEW_MODES);
const isValidViewMode = (v: string): v is TypeViewMode => viewModeSet.has(v);
import { SINGLE_FILE_ADAPTER, OrgBrowserTreeItem } from './tree/orgBrowserNode';

const extractPathOnClient = (xml: string): string | undefined => /<pathOnClient>([^<]+)<\/pathOnClient>/.exec(xml)?.[1];

const closePreviewTabs = async (): Promise<void> => {
  const tabsToClose: vscode.Tab[] = [];
  // eslint-disable-next-line functional/no-loop-statements
  for (const group of vscode.window.tabGroups.all) {
    // eslint-disable-next-line functional/no-loop-statements
    for (const tab of group.tabs) {
      const uri =
        (tab.input instanceof vscode.TabInputText && tab.input.uri) ||
        (tab.input instanceof vscode.TabInputCustom && tab.input.uri);
      if (uri && uri.scheme === ASSET_PREVIEW_SCHEME) {
        tabsToClose.push(tab);
      }
    }
  }
  if (tabsToClose.length > 0) {
    await vscode.window.tabGroups.close(tabsToClose, true);
  }
};

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  await closePreviewTabs();
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await Effect.runPromise(activateEffect(context).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(deactivateEffect().pipe(Effect.provide(AllServicesLayer)));

const invalidateTrackingCache = () => getOrgBrowserRuntime().runPromise(SourceTrackingCacheService.invalidate);

// export for testing
export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel('Salesforce Org Browser extension activating');

  // get a connection to initiate the ref
  yield* api.services.ConnectionService.getConnection();
  // wait for the target org ref to have an orgId
  const targetOrgRef = yield* api.services.TargetOrgRef();
  yield* Effect.repeat(SubscriptionRef.get(targetOrgRef), {
    until: org => isNotUndefined(org.orgId),
    schedule: Schedule.exponential(Duration.millis(10))
  });

  const treeProvider = new MetadataTypeTreeProvider();
  const creatableTypes = yield* Effect.promise(resolveAvailableCreateCommands);
  treeProvider.setCreatableTypes(creatableTypes);

  const savedViewMode = context.workspaceState.get<string>('orgBrowser.viewMode');
  if (savedViewMode && isValidViewMode(savedViewMode)) {
    treeProvider.setViewMode(savedViewMode);
    yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.viewMode', savedViewMode));
  }
  const savedFilter = context.workspaceState.get<string[]>('orgBrowser.typeFilter');
  const savedComponentFilter = context.workspaceState.get<string>('orgBrowser.componentFilter');
  if (savedFilter && savedFilter.length > 0) {
    treeProvider.setTypeFilter(new Set(savedFilter), savedComponentFilter);
    yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.filterActive', true));
  }

  const assetPreviewFs = new AssetPreviewFs();
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(ASSET_PREVIEW_SCHEME, assetPreviewFs, {
      isCaseSensitive: true,
      isReadonly: true
    })
  );

  // Register the tree provider for both the standalone and Explorer views
  vscode.window.registerTreeDataProvider(TREE_VIEW_ID, treeProvider);
  vscode.window.registerTreeDataProvider(`${TREE_VIEW_ID}Explorer`, treeProvider);

  const registerCommand = api.services.registerCommandWithRuntime(getOrgBrowserRuntime());

  // Register commands
  yield* Effect.all(
    [
      registerCommand('sf.org-browser.walkthrough.open', () =>
        Effect.promise(() =>
          vscode.commands.executeCommand(
            'workbench.action.openWalkthrough',
            'salesforce.salesforcedx-vscode-org-browser#sf.org-browser',
            false
          )
        )
      ),
      registerCommand(`${TREE_VIEW_ID}.refreshType`, (node: OrgBrowserTreeItem) =>
        Effect.promise(() => treeProvider.refreshType(node))
      ),
      registerCommand(`${TREE_VIEW_ID}.collapseAll`, () =>
        Effect.promise(() => vscode.commands.executeCommand(`workbench.actions.treeView.${TREE_VIEW_ID}.collapseAll`))
      ),
      registerCommand(`${TREE_VIEW_ID}.retrieveMetadata`, (node: OrgBrowserTreeItem) =>
        retrieveEffect(node, treeProvider)
      ),
      registerCommand(`${TREE_VIEW_ID}.pullRemoteChange`, (node: OrgBrowserTreeItem) =>
        Effect.gen(function* () {
          if (!node.xmlName || !node.componentName) return;
          const servicesApi = yield* (yield* ExtensionProviderService).getServicesApi;
          yield* servicesApi.services.MetadataRetrieveService.retrieve(
            [{ type: node.xmlName, fullName: node.componentName }],
            { ignoreConflicts: false }
          );
          yield* SourceTrackingCacheService.invalidate;
          yield* Effect.promise(() => treeProvider.refreshType());
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.openLocalComponent`, (node: OrgBrowserTreeItem) =>
        Effect.gen(function* () {
          if (!node.localPath) return;
          const servicesApi = yield* (yield* ExtensionProviderService).getServicesApi;
          const registry = yield* servicesApi.services.MetadataRegistryService.getRegistryAccess();
          const adapter = registry.getTypeByName(node.xmlName)?.strategies?.adapter;
          if (adapter && adapter !== SINGLE_FILE_ADAPTER) {
            const folderUri = Utils.dirname(URI.file(node.localPath));
            yield* Effect.promise(() => vscode.commands.executeCommand('revealInExplorer', folderUri));
          } else if (node.xmlName === 'ContentAsset') {
            yield* Effect.promise(async () => {
              const assetUri = URI.file(node.localPath!);
              const metaUri = URI.file(`${node.localPath!}-meta.xml`);
              const [assetData, metaData] = await Promise.all([
                vscode.workspace.fs.readFile(assetUri),
                vscode.workspace.fs.readFile(metaUri)
              ]);
              const originalName = extractPathOnClient(Buffer.from(metaData).toString('utf8'));
              if (originalName) {
                const previewUri = URI.from({
                  scheme: ASSET_PREVIEW_SCHEME,
                  path: `/${node.componentName ?? 'asset'}/${originalName}`
                });
                assetPreviewFs.writeFileInternal(previewUri, assetData);
                await vscode.commands.executeCommand('vscode.open', previewUri);
              }
            });
          } else {
            yield* Effect.promise(() => vscode.commands.executeCommand('vscode.open', URI.file(node.localPath!)));
          }
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.previewOrgComponent`, (node: OrgBrowserTreeItem) =>
        Effect.gen(function* () {
          if (!node?.componentName) return;
          const servicesApi = yield* (yield* ExtensionProviderService).getServicesApi;
          const members = [{ type: node.xmlName, fullName: node.componentName }];
          const zipFiles = yield* servicesApi.services.MetadataRetrieveService.retrieveMemberContent(members);
          if (zipFiles.size === 0) return;

          const registry = yield* servicesApi.services.MetadataRegistryService.getRegistryAccess();
          const typeInfo = registry.getTypeByName(node.xmlName);
          const suffix = typeInfo?.suffix;

          // Find the main content file (not package.xml)
          const zipEntries = [...zipFiles.entries()].filter(([name]) => !name.endsWith('package.xml'));
          const contentEntry = zipEntries.find(
            ([name]) => suffix && name.endsWith(`.${suffix}`) && !name.endsWith('-meta.xml')
          );
          const metaEntry = zipEntries.find(([name]) => name.endsWith('-meta.xml'));
          const mainEntry = contentEntry ?? metaEntry ?? zipEntries[0];
          if (!mainEntry) return;

          const [mainZipPath, fileData] = mainEntry;
          const defaultFileName = mainZipPath.split('/').pop() ?? node.componentName;
          const metaXmlData = metaEntry ? metaEntry[1] : undefined;
          const fileName =
            node.xmlName === 'ContentAsset' && metaXmlData
              ? (extractPathOnClient(Buffer.from(metaXmlData).toString('utf8')) ?? defaultFileName)
              : defaultFileName;

          const previewUri = URI.from({
            scheme: ASSET_PREVIEW_SCHEME,
            path: `/${node.xmlName}/${node.componentName}/${fileName}`
          });
          assetPreviewFs.writeFileInternal(previewUri, fileData);
          yield* Effect.promise(() => vscode.commands.executeCommand('vscode.open', previewUri));
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.createComponent`, (node: OrgBrowserTreeItem) =>
        Effect.promise(async () => {
          const entry = creatableTypes.get(node.xmlName);
          if (entry) await vscode.commands.executeCommand(entry.commandId);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.viewModeLocalOnly`, () =>
        Effect.promise(async () => {
          const mode = treeProvider.cycleViewMode();
          await vscode.commands.executeCommand('setContext', 'sf:orgBrowser.viewMode', mode);
          await context.workspaceState.update('orgBrowser.viewMode', mode);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.viewModeWithContent`, () =>
        Effect.promise(async () => {
          const mode = treeProvider.cycleViewMode();
          await vscode.commands.executeCommand('setContext', 'sf:orgBrowser.viewMode', mode);
          await context.workspaceState.update('orgBrowser.viewMode', mode);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.viewModeOrgOnly`, () =>
        Effect.promise(async () => {
          const mode = treeProvider.cycleViewMode();
          await vscode.commands.executeCommand('setContext', 'sf:orgBrowser.viewMode', mode);
          await context.workspaceState.update('orgBrowser.viewMode', mode);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.viewModeAllTypes`, () =>
        Effect.promise(async () => {
          const mode = treeProvider.cycleViewMode();
          await vscode.commands.executeCommand('setContext', 'sf:orgBrowser.viewMode', mode);
          await context.workspaceState.update('orgBrowser.viewMode', mode);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.filterTypes`, () =>
        Effect.promise(
          () =>
            new Promise<void>(resolve => {
              const previousFilter = treeProvider.getTypeFilter();
              const previousComponent = treeProvider.getComponentFilter();
              const quickPick = vscode.window.createQuickPick();
              quickPick.placeholder = 'e.g. ApexClass or Layout:Account';
              quickPick.matchOnDescription = true;
              // eslint-disable-next-line functional/no-let
              let debounceTimer: ReturnType<typeof setTimeout> | undefined;
              // eslint-disable-next-line functional/no-let
              let accepted = false;
              // eslint-disable-next-line functional/no-let
              let cachedTypeNames: string[] = [];

              treeProvider
                .getChildren(undefined)
                .then(roots => {
                  cachedTypeNames = roots.filter(n => n.kind === 'type' || n.kind === 'folderType').map(n => n.xmlName);
                  quickPick.items = cachedTypeNames.map(t => ({ label: t }));
                })
                .catch(() => undefined);

              quickPick.onDidChangeValue(value => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                  const colonIdx = value.indexOf(':');
                  if (colonIdx > 0) {
                    const typePart = value.substring(0, colonIdx).trim();
                    const resolvedType =
                      cachedTypeNames.find(t => t.toLowerCase() === typePart.toLowerCase()) ?? typePart;
                    const namePart = value
                      .substring(colonIdx + 1)
                      .trim()
                      .toLowerCase();
                    treeProvider.setTypeFilter(new Set([resolvedType]), namePart || undefined);
                    const typeNode = new OrgBrowserTreeItem({
                      kind: 'type',
                      xmlName: resolvedType,
                      label: resolvedType
                    });
                    treeProvider
                      .getChildren(typeNode)
                      .then(children => {
                        const filtered = namePart
                          ? children.filter(c => c.componentName?.toLowerCase().includes(namePart))
                          : children;
                        quickPick.items = filtered.map(c => ({
                          label: `${typePart}:${c.componentName ?? String(c.label)}`,
                          description: c.componentName ?? ''
                        }));
                      })
                      .catch(() => undefined);
                  } else if (value.length >= 3) {
                    const lower = value.toLowerCase();
                    const matching = cachedTypeNames.filter(t => t.toLowerCase().includes(lower));
                    quickPick.items = matching.map(t => ({ label: t }));
                    treeProvider.setTypeFilter(new Set(matching));
                  } else {
                    quickPick.items = cachedTypeNames.map(t => ({ label: t }));
                    if (previousFilter) {
                      treeProvider.setTypeFilter(previousFilter, previousComponent);
                    } else {
                      treeProvider.clearTypeFilter();
                    }
                  }
                }, 150);
              });

              const commitFilter = (value: string): void => {
                accepted = true;
                quickPick.dispose();
                if (value.length === 0) {
                  treeProvider.clearTypeFilter();
                  void vscode.commands.executeCommand('setContext', 'sf:orgBrowser.filterActive', false);
                  void context.workspaceState.update('orgBrowser.typeFilter', undefined);
                  void context.workspaceState.update('orgBrowser.componentFilter', undefined);
                } else {
                  void vscode.commands.executeCommand('setContext', 'sf:orgBrowser.filterActive', true);
                  const colonIdx = value.indexOf(':');
                  if (colonIdx > 0) {
                    const typePart = value.substring(0, colonIdx).trim();
                    const resolvedType =
                      cachedTypeNames.find(t => t.toLowerCase() === typePart.toLowerCase()) ?? typePart;
                    const namePart = value.substring(colonIdx + 1).trim();
                    treeProvider.setTypeFilter(new Set([resolvedType]), namePart || undefined);
                    void context.workspaceState.update('orgBrowser.typeFilter', [resolvedType]);
                    void context.workspaceState.update('orgBrowser.componentFilter', namePart || undefined);
                  } else {
                    const lower = value.toLowerCase();
                    const types = cachedTypeNames.filter(t => t.toLowerCase().includes(lower));
                    treeProvider.setTypeFilter(new Set(types));
                    void context.workspaceState.update('orgBrowser.typeFilter', types);
                    void context.workspaceState.update('orgBrowser.componentFilter', undefined);
                  }
                }
                resolve();
              };

              quickPick.onDidAccept(() => {
                const selected = quickPick.selectedItems[0];
                const value = selected?.label ?? quickPick.value;
                // If a type was selected without ':', transition to component search
                if (selected && !value.includes(':')) {
                  quickPick.value = `${value}:`;
                  return;
                }
                commitFilter(value);
              });
              quickPick.onDidHide(() => {
                if (!accepted) {
                  if (previousFilter) {
                    treeProvider.setTypeFilter(previousFilter, previousComponent);
                  } else {
                    treeProvider.clearTypeFilter();
                  }
                }
                quickPick.dispose();
                resolve();
              });
              quickPick.show();
            })
        )
      ),
      registerCommand(`${TREE_VIEW_ID}.clearFilter`, () =>
        Effect.promise(async () => {
          treeProvider.clearTypeFilter();
          await vscode.commands.executeCommand('setContext', 'sf:orgBrowser.filterActive', false);
          await context.workspaceState.update('orgBrowser.typeFilter', undefined);
          await context.workspaceState.update('orgBrowser.componentFilter', undefined);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.deployLocalChange`, (node: OrgBrowserTreeItem) =>
        Effect.gen(function* () {
          if (!node.xmlName || !node.componentName) return;
          const servicesApi = yield* (yield* ExtensionProviderService).getServicesApi;
          const componentSet = yield* servicesApi.services.ComponentSetService.getComponentSetFromProjectDirectories();
          const deployComponents = Array.from(componentSet).filter(
            comp => comp.type.name === node.xmlName && comp.fullName === node.componentName
          );
          if (deployComponents.length === 0) return;
          // eslint-disable-next-line import/no-extraneous-dependencies
          const { ComponentSet: CS } = yield* Effect.promise(() => import('@salesforce/source-deploy-retrieve'));
          const deploySet = new CS();
          deployComponents.forEach(comp => deploySet.add(comp));
          yield* servicesApi.services.MetadataDeployService.deploy(deploySet);
          yield* SourceTrackingCacheService.invalidate;
          yield* Effect.promise(() => treeProvider.refreshType());
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.retrieveAllFiltered`, () =>
        Effect.gen(function* () {
          const rootNodes = yield* Effect.promise(() => treeProvider.getChildren(undefined));
          const typeNodes = rootNodes.filter(n => n.kind === 'type' || n.kind === 'folderType');
          const allMembers: { type: string; fullName: string }[] = [];
          yield* Effect.all(
            typeNodes.map(typeNode =>
              Effect.promise(() => treeProvider.getChildren(typeNode)).pipe(
                Effect.map(children =>
                  children
                    .filter((c): c is OrgBrowserTreeItem & { componentName: string } => Boolean(c.componentName))
                    .forEach(c => allMembers.push({ type: typeNode.xmlName, fullName: c.componentName }))
                )
              )
            ),
            { concurrency: 'unbounded' }
          );
          if (allMembers.length === 0) return;
          yield* OrgBrowserRetrieveService.retrieve(allMembers, false);
          yield* SourceTrackingCacheService.invalidate;
          yield* Effect.promise(() => treeProvider.refreshType());
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.pullAllRemoteChanges`, () =>
        Effect.gen(function* () {
          const servicesApi = yield* (yield* ExtensionProviderService).getServicesApi;
          const trackingCache = yield* SourceTrackingCacheService;
          const allChanges = yield* trackingCache.getAllChanges();
          const remoteChanges = allChanges.filter(r => !r.conflict && r.origin === 'remote');
          if (remoteChanges.length === 0) return;
          const members = remoteChanges.map(r => ({ type: r.type, fullName: r.fullName }));
          yield* servicesApi.services.MetadataRetrieveService.retrieve(members, { ignoreConflicts: false });
          yield* SourceTrackingCacheService.invalidate;
          yield* Effect.promise(() => treeProvider.refreshType());
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.deployAllLocalChanges`, () =>
        Effect.gen(function* () {
          const servicesApi = yield* (yield* ExtensionProviderService).getServicesApi;
          const trackingCache = yield* SourceTrackingCacheService;
          const allChanges = yield* trackingCache.getAllChanges();
          const localChanges = allChanges.filter(r => !r.conflict && r.origin === 'local');
          if (localChanges.length === 0) return;
          const componentSet = yield* servicesApi.services.ComponentSetService.getComponentSetFromProjectDirectories();
          // eslint-disable-next-line import/no-extraneous-dependencies
          const { ComponentSet: CS } = yield* Effect.promise(() => import('@salesforce/source-deploy-retrieve'));
          const deploySet = new CS();
          Array.from(componentSet)
            .filter(comp => localChanges.some(r => r.type === comp.type.name && r.fullName === comp.fullName))
            .forEach(comp => deploySet.add(comp));
          if (deploySet.size === 0) return;
          yield* servicesApi.services.MetadataDeployService.deploy(deploySet);
          yield* SourceTrackingCacheService.invalidate;
          yield* Effect.promise(() => treeProvider.refreshType());
        })
      )
    ],
    { concurrency: 'unbounded' }
  );

  yield* Effect.forkDaemon(
    targetOrgRef.changes.pipe(
      Stream.map(org => org.orgId),
      Stream.changes,
      Stream.tap(orgId => svc.appendToChannel(`Target org changed to ${orgId ?? '<NOT SET>'}`)),
      Stream.tap(() => svc.appendToChannel('Org changed, will try to update OrgBrowser')),
      Stream.tap(() => Effect.sync(() => assetPreviewFs.clear())),
      Stream.tap(() => Effect.promise(invalidateTrackingCache)),
      Stream.runForEach(() => Effect.promise(() => treeProvider.refreshType()))
    )
  );

  // Invalidate tracking cache and re-render when metadata operations complete
  const activeOpRef = yield* api.services.ActiveMetadataOperationRef();
  yield* Effect.forkDaemon(
    activeOpRef.changes.pipe(
      Stream.filter(count => count === 0),
      Stream.debounce(Duration.millis(500)),
      Stream.tap(() => Effect.promise(invalidateTrackingCache)),
      Stream.runForEach(() => Effect.promise(() => treeProvider.refreshType()))
    )
  );

  // Invalidate tracking cache on file changes (debounced) — runs through getOrgBrowserRuntime
  // so the same SourceTrackingCacheService Ref is invalidated that getChildren reads from
  const fileChangePubSub = yield* api.services.FileChangePubSub;
  yield* Effect.forkDaemon(
    Stream.fromPubSub(fileChangePubSub).pipe(
      Stream.debounce(Duration.seconds(2)),
      Stream.runForEach(() =>
        Effect.promise(async () => {
          await invalidateTrackingCache();
          treeProvider.fireChangeEvent();
        })
      )
    )
  );

  // Append completion message
  yield* svc.appendToChannel('Salesforce Org Browser activation complete.');

  // Auto-open walkthrough on first run
  const lastVersion = context.globalState.get<string>('orgBrowser.walkthroughVersion');
  if (lastVersion === undefined) {
    const ver = context.extension.packageJSON?.version;
    const currentVersion = typeof ver === 'string' ? ver : '0.0.0';
    yield* Effect.promise(() => context.globalState.update('orgBrowser.walkthroughVersion', currentVersion));
    yield* Effect.promise(() =>
      vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        'salesforce.salesforcedx-vscode-org-browser#sf.org-browser',
        false
      )
    );
  }
});

export const deactivateEffect = Effect.fn(`deactivation:${EXTENSION_NAME}`)(function* () {
  const servicesApi = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelSvc = yield* servicesApi.services.ChannelService;
  yield* channelSvc.appendToChannel('Salesforce Org Browser extension is now deactivated!');
});
