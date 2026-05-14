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
import {
  AllServicesLayer,
  buildAllServicesLayer,
  getOrgBrowserRuntime,
  setAllServicesLayer
} from './services/extensionProvider';
import { SourceTrackingCacheService } from './services/sourceTrackingCacheService';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';
import { SINGLE_FILE_ADAPTER, OrgBrowserTreeItem } from './tree/orgBrowserNode';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
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
          } else {
            yield* Effect.promise(() => vscode.window.showTextDocument(URI.file(node.localPath!)));
          }
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.createComponent`, (node: OrgBrowserTreeItem) =>
        Effect.promise(async () => {
          const entry = creatableTypes.get(node.xmlName);
          if (entry) await vscode.commands.executeCommand(entry.commandId);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.showAllTypes`, () =>
        Effect.promise(async () => {
          treeProvider.toggleShowAllTypes();
          await vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showAllTypes', true);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.showTypesWithContent`, () =>
        Effect.promise(async () => {
          treeProvider.toggleShowAllTypes();
          await vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showAllTypes', false);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.filterTypes`, () =>
        Effect.promise(async () => {
          const input = await vscode.window.showInputBox({
            prompt: 'Enter comma-separated metadata type names',
            placeHolder: 'e.g. ApexClass,CustomObject,Layout'
          });
          if (input === undefined) return;
          const types = input
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
          if (types.length === 0) return;
          treeProvider.setTypeFilter(new Set(types));
          await vscode.commands.executeCommand('setContext', 'sf:orgBrowser.filterActive', true);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.clearFilter`, () =>
        Effect.promise(async () => {
          treeProvider.clearTypeFilter();
          await vscode.commands.executeCommand('setContext', 'sf:orgBrowser.filterActive', false);
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
