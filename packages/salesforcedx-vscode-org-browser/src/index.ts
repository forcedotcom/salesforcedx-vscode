/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isNotUndefined, isString, isUndefined } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { openFilterTextPicker, requestRestoredFilterDiscovery } from './commands/filterMetadata';
import { retrieveEffect } from './commands/retrieveMetadata';
import { EXTENSION_NAME, TREE_VIEW_ID } from './constants';
import {
  buildAllServicesLayer,
  disposeOrgBrowserRuntime,
  getOrgBrowserRuntime,
  setAllServicesLayer
} from './services/extensionProvider';
import { getFilterState, saveFilterState, type OrgBrowserFilterState } from './services/filterState';
import { coalesceTreeRefreshes } from './tree/catalogChange';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem } from './tree/orgBrowserNode';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await getOrgBrowserRuntime().runPromise(activateEffect(context).pipe(Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> => {
  await getOrgBrowserRuntime().runPromise(deactivateEffect()).finally(disposeOrgBrowserRuntime);
};

// export for testing
export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel('Salesforce Org Browser extension activating');
  yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.initialized', false));

  const treeProvider = new MetadataTypeTreeProvider();
  // Register the tree provider
  context.subscriptions.push(vscode.window.registerTreeDataProvider(TREE_VIEW_ID, treeProvider));

  // --- Filter state: persistence, migration, and initial context keys ---
  // Legacy migration: convert old viewMode to boolean type
  const legacyViewMode = context.workspaceState.get<string>('orgBrowser.viewMode');
  if (isNotUndefined(legacyViewMode)) {
    const migratedShowLocal = legacyViewMode !== 'orgOnly';
    const migratedShowOrg = legacyViewMode !== 'localOnly';
    yield* Effect.all(
      [
        Effect.promise(() => context.workspaceState.update('orgBrowser.showLocal', migratedShowLocal)),
        Effect.promise(() => context.workspaceState.update('orgBrowser.showOrg', migratedShowOrg)),
        Effect.promise(() => context.workspaceState.update('orgBrowser.viewMode', undefined))
      ],
      { concurrency: 'unbounded' }
    );
  }

  const showLocal = context.workspaceState.get<boolean>('orgBrowser.showLocal') ?? true;
  const showOrg = context.workspaceState.get<boolean>('orgBrowser.showOrg') ?? true;

  treeProvider.setShowLocal(showLocal);
  treeProvider.setShowOrg(showOrg);

  // Set initial context keys
  yield* Effect.all(
    [
      Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showLocal', showLocal)),
      Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showOrg', showOrg)),
      Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.textFilterActive', false)),
      Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.treeEmpty', false)),
      Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.invalidStructuredSearch', false))
    ],
    { concurrency: 'unbounded' }
  );

  const saveActiveFilterState = (filter: Partial<OrgBrowserFilterState>) =>
    Effect.gen(function* () {
      const { orgId } = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
      if (orgId) yield* Effect.promise(() => saveFilterState(context, orgId, filter));
    });

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
      registerCommand(`${TREE_VIEW_ID}.retrieveMetadata`, (node: OrgBrowserTreeItem | undefined) =>
        retrieveEffect(node, treeProvider)
      ),
      registerCommand(`${TREE_VIEW_ID}.showLocal.on`, () =>
        Effect.gen(function* () {
          yield* Effect.all(
            [
              saveActiveFilterState({ showLocal: true }),
              Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showLocal', true))
            ],
            { concurrency: 'unbounded' }
          );
          treeProvider.setShowLocal(true);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.showLocal.off`, () =>
        Effect.gen(function* () {
          yield* Effect.all(
            [
              saveActiveFilterState({ showLocal: false }),
              Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showLocal', false))
            ],
            { concurrency: 'unbounded' }
          );
          treeProvider.setShowLocal(false);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.showOrg.on`, () =>
        Effect.gen(function* () {
          yield* Effect.all(
            [
              saveActiveFilterState({ showOrg: true }),
              Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showOrg', true))
            ],
            { concurrency: 'unbounded' }
          );
          treeProvider.setShowOrg(true);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.showOrg.off`, () =>
        Effect.gen(function* () {
          yield* Effect.all(
            [
              saveActiveFilterState({ showOrg: false }),
              Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showOrg', false))
            ],
            { concurrency: 'unbounded' }
          );
          treeProvider.setShowOrg(false);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.filterText`, () => openFilterTextPicker(treeProvider, context)),
      registerCommand(`${TREE_VIEW_ID}.filterText.active`, () => openFilterTextPicker(treeProvider, context))
    ],
    { concurrency: 'unbounded' }
  );

  yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.initialized', true));

  // get a connection to initiate the ref
  yield* api.services.ConnectionService.getConnection();
  // wait for the target org ref to have an orgId
  const targetOrgRef = yield* api.services.TargetOrgRef();
  yield* Effect.repeat(SubscriptionRef.get(targetOrgRef), {
    until: org => isNotUndefined(org.orgId),
    schedule: Schedule.exponential(Duration.millis(10))
  });
  const legacyFilter: OrgBrowserFilterState | undefined = (() => {
    const typeFilter = context.workspaceState.get<string | undefined>('orgBrowser.typeFilter');
    const componentFilter = context.workspaceState.get<string | undefined>('orgBrowser.componentFilter');
    return isNotUndefined(typeFilter) || isNotUndefined(componentFilter)
      ? {
          typeFilter,
          componentFilter,
          typeIsRegex: context.workspaceState.get<boolean>('orgBrowser.typeIsRegex') ?? false,
          componentIsRegex: context.workspaceState.get<boolean>('orgBrowser.componentIsRegex') ?? false,
          showLocal,
          showOrg
        }
      : undefined;
  })();
  const restoreFilter = (orgId: string, refresh = true, deferComponentFilter = false) =>
    Effect.gen(function* () {
      const persistedFilter = getFilterState(context, orgId);
      const filter = persistedFilter ?? (orgId === initialOrgId ? legacyFilter : undefined);
      if (legacyFilter && orgId === initialOrgId && !persistedFilter) {
        yield* Effect.promise(() => saveFilterState(context, orgId, legacyFilter));
        yield* Effect.all(
          [
            Effect.promise(() => context.workspaceState.update('orgBrowser.typeFilter', undefined)),
            Effect.promise(() => context.workspaceState.update('orgBrowser.componentFilter', undefined)),
            Effect.promise(() => context.workspaceState.update('orgBrowser.typeIsRegex', undefined)),
            Effect.promise(() => context.workspaceState.update('orgBrowser.componentIsRegex', undefined)),
            Effect.promise(() => context.workspaceState.update('orgBrowser.showLocal', undefined)),
            Effect.promise(() => context.workspaceState.update('orgBrowser.showOrg', undefined))
          ],
          { concurrency: 'unbounded', discard: true }
        );
      }
      treeProvider.setTextFilter(
        filter?.typeFilter,
        filter?.componentFilter,
        filter?.typeIsRegex,
        filter?.componentIsRegex,
        deferComponentFilter && Boolean(filter?.componentFilter),
        refresh
      );
      treeProvider.setShowLocal(filter?.showLocal ?? true);
      treeProvider.setShowOrg(filter?.showOrg ?? true);
      yield* Effect.all(
        [
          Effect.promise(() =>
            vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showLocal', filter?.showLocal ?? true)
          ),
          Effect.promise(() =>
            vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showOrg', filter?.showOrg ?? true)
          ),
          Effect.promise(() =>
            vscode.commands.executeCommand(
              'setContext',
              'sf:orgBrowser.textFilterActive',
              isNotUndefined(filter?.typeFilter) || isNotUndefined(filter?.componentFilter)
            )
          ),
          Effect.promise(() =>
            vscode.commands.executeCommand('setContext', 'sf:orgBrowser.invalidStructuredSearch', false)
          )
        ],
        { concurrency: 'unbounded', discard: true }
      );
      return filter;
    });
  const { orgId: initialOrgId } = yield* SubscriptionRef.get(targetOrgRef);
  const initialFilter = initialOrgId ? yield* restoreFilter(initialOrgId, false, true) : undefined;
  const orgMetadataChanges = yield* api.services.OrgMetadataCatalogChangePubSub;
  const extensionScope = yield* getExtensionScope();
  yield* Effect.forkIn(
    orgMetadataChanges.pipe(
      changes => Stream.fromPubSub(changes),
      coalesceTreeRefreshes,
      Stream.runForEach(() => Effect.sync(() => treeProvider.fireChangeEvent()))
    ),
    extensionScope
  );
  if (initialFilter?.componentFilter) {
    yield* Effect.sync(() =>
      requestRestoredFilterDiscovery(treeProvider, context, {
        ...initialFilter
      })
    );
  } else {
    treeProvider.fireChangeEvent();
  }

  yield* Effect.forkDaemon(
    targetOrgRef.changes.pipe(
      Stream.map(org => org.orgId),
      Stream.drop(1),
      Stream.changes,
      Stream.tap(orgId => svc.appendToChannel(`Target org changed to ${orgId ?? '<NOT SET>'}`)),
      Stream.tap(() => svc.appendToChannel('Org changed, will try to update OrgBrowser')),
      Stream.runForEach(orgId =>
        Effect.gen(function* () {
          if (orgId) yield* restoreFilter(orgId);
          else treeProvider.clearTextFilter();
          return yield* orgId
            ? Effect.tryPromise(() => treeProvider.refreshType()).pipe(
                Effect.catchAll(error =>
                  Effect.logWarning('Failed to refresh Org Browser after an org change', error).pipe(
                    Effect.zipRight(Effect.sync(() => treeProvider.fireChangeEvent()))
                  )
                )
              )
            : Effect.tryPromise(() => treeProvider.updateTreeEmptyContext(true)).pipe(
                Effect.zipRight(Effect.sync(() => treeProvider.fireChangeEvent())),
                Effect.catchAll(error => Effect.logWarning('Failed to clear the Org Browser tree', error))
              );
        })
      )
    )
  );

  // Append completion message
  yield* svc.appendToChannel('Salesforce Org Browser activation complete.');

  // Auto-open walkthrough on first run
  const lastVersion = context.globalState.get<string>('orgBrowser.walkthroughVersion');
  if (isUndefined(lastVersion)) {
    const ver = context.extension.packageJSON?.version;
    const currentVersion = isString(ver) ? ver : '0.0.0';
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
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel('Salesforce Org Browser extension is now deactivated!');
});
