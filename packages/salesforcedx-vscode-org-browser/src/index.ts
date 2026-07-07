/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as Schedule from 'effect/Schedule';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { retrieveEffect } from './commands/retrieveMetadata';
import { EXTENSION_NAME, TREE_VIEW_ID } from './constants';
import { nls } from './messages';
import {
  AllServicesLayer,
  buildAllServicesLayer,
  getOrgBrowserRuntime,
  setAllServicesLayer
} from './services/extensionProvider';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem } from './tree/orgBrowserNode';

type FilterQuickPickItem = vscode.QuickPickItem;

const parseFilterValue = (
  value: string,
  cachedTypeNames: string[]
): { typeFilter: string | undefined; componentFilter: string | undefined } => {
  if (value.length === 0) return { typeFilter: undefined, componentFilter: undefined };
  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) {
    return value.length >= 3
      ? { typeFilter: value, componentFilter: undefined }
      : { typeFilter: undefined, componentFilter: undefined };
  }
  const typePart = value.substring(0, colonIdx).trim();
  const resolvedType = cachedTypeNames.find(t => t.toLowerCase() === typePart.toLowerCase()) ?? typePart;
  const componentPart = value.substring(colonIdx + 1).trim();
  return { typeFilter: resolvedType, componentFilter: componentPart };
};

const computeSuggestions = (
  value: string,
  cachedTypeNames: string[],
  treeProvider: MetadataTypeTreeProvider
): Promise<FilterQuickPickItem[]> => {
  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) {
    const lower = value.toLowerCase();
    const names = value.length >= 3 ? cachedTypeNames.filter(t => t.toLowerCase().includes(lower)) : cachedTypeNames;
    return Promise.resolve(names.map(label => ({ label })));
  }
  const typePart = value.substring(0, colonIdx).trim();
  const componentPart = value
    .substring(colonIdx + 1)
    .trim()
    .toLowerCase();
  const resolvedType = cachedTypeNames.find(t => t.toLowerCase() === typePart.toLowerCase()) ?? typePart;
  const typeNode = new OrgBrowserTreeItem({ kind: 'type', xmlName: resolvedType, label: resolvedType });
  return treeProvider
    .getChildren(typeNode)
    .then(children =>
      children
        .filter(c => c.componentName?.toLowerCase().includes(componentPart))
        .map(c => ({ label: `${typePart}:${c.componentName ?? ''}` }))
    );
};

const openFilterTextPicker = Effect.fn('OrgBrowser.openFilterTextPicker')(function* (
  treeProvider: MetadataTypeTreeProvider
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const previousTypeFilter = treeProvider.typeFilter;
  const previousComponentFilter = treeProvider.componentFilter;

  const cachedTypeNames = yield* api.services.MetadataDescribeService.describe().pipe(
    Effect.map(types => types.map(t => t.xmlName).toSorted()),
    Effect.catchAll(() => Effect.succeed<string[]>([]))
  );

  const runtime = yield* Effect.runtime();
  const run = Runtime.runFork(runtime);

  const queue = yield* Queue.unbounded<string>();
  const deferred = yield* Deferred.make<void>();
  const acceptedRef = yield* Ref.make(false);

  const picker = vscode.window.createQuickPick<FilterQuickPickItem>();
  picker.placeholder = nls.localize('filter_text_placeholder');
  picker.matchOnDescription = false;
  picker.value = previousTypeFilter
    ? previousComponentFilter !== undefined
      ? `${previousTypeFilter}:${previousComponentFilter}`
      : previousTypeFilter
    : '';
  picker.items = cachedTypeNames.map(label => ({ label }));

  const commit = (value: string) =>
    Effect.gen(function* () {
      yield* Ref.set(acceptedRef, true);
      const { typeFilter, componentFilter } = parseFilterValue(value, cachedTypeNames);
      treeProvider.setTextFilter(typeFilter, componentFilter);
      yield* Effect.promise(() =>
        vscode.commands.executeCommand('setContext', 'sf:orgBrowser.textFilterActive', typeFilter !== undefined)
      );
      picker.dispose();
      yield* Deferred.succeed(deferred, undefined);
    });

  picker.onDidChangeValue(value => run(Queue.offer(queue, value)));
  picker.onDidAccept(() => run(commit(picker.value)));
  picker.onDidHide(() =>
    run(
      Effect.gen(function* () {
        const accepted = yield* Ref.get(acceptedRef);
        if (!accepted) {
          treeProvider.setTextFilter(previousTypeFilter, previousComponentFilter);
        }
        picker.dispose();
        yield* Deferred.succeed(deferred, undefined);
      })
    )
  );

  yield* Effect.fork(
    Stream.fromQueue(queue).pipe(
      Stream.debounce(Duration.millis(150)),
      Stream.runForEach(value =>
        Effect.gen(function* () {
          const { typeFilter, componentFilter } = parseFilterValue(value, cachedTypeNames);
          treeProvider.setTextFilter(typeFilter, componentFilter);
          const suggestions = yield* Effect.tryPromise({
            try: () => computeSuggestions(value, cachedTypeNames, treeProvider),
            catch: () => new Error('computeSuggestions failed')
          }).pipe(Effect.catchAll(() => Effect.succeed<FilterQuickPickItem[]>([])));
          picker.items = suggestions;
        })
      )
    )
  );

  picker.show();
  yield* Deferred.await(deferred);
});

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await Effect.runPromise(activateEffect(context).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(deactivateEffect().pipe(Effect.provide(AllServicesLayer)));

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
  // Register the tree provider
  vscode.window.registerTreeDataProvider(TREE_VIEW_ID, treeProvider);

  // --- Filter state: persistence, migration, and initial context keys ---
  // Legacy migration: convert old viewMode to boolean flags
  const legacyViewMode = context.workspaceState.get<string>('orgBrowser.viewMode');
  if (legacyViewMode !== undefined) {
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

  // Read persisted filter state
  const showLocal = context.workspaceState.get<boolean>('orgBrowser.showLocal') ?? true;
  const showOrg = context.workspaceState.get<boolean>('orgBrowser.showOrg') ?? true;
  treeProvider.setShowLocal(showLocal);
  treeProvider.setShowOrg(showOrg);

  // Set initial context keys
  yield* Effect.all(
    [
      Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showLocal', showLocal)),
      Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showOrg', showOrg))
    ],
    { concurrency: 'unbounded' }
  );

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
      registerCommand(`${TREE_VIEW_ID}.showLocal.on`, () =>
        Effect.gen(function* () {
          yield* Effect.all(
            [
              Effect.promise(() => context.workspaceState.update('orgBrowser.showLocal', true)),
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
              Effect.promise(() => context.workspaceState.update('orgBrowser.showLocal', false)),
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
              Effect.promise(() => context.workspaceState.update('orgBrowser.showOrg', true)),
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
              Effect.promise(() => context.workspaceState.update('orgBrowser.showOrg', false)),
              Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showOrg', false))
            ],
            { concurrency: 'unbounded' }
          );
          treeProvider.setShowOrg(false);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.filterText`, () => openFilterTextPicker(treeProvider)),
      registerCommand(`${TREE_VIEW_ID}.filterText.active`, () => openFilterTextPicker(treeProvider))
    ],
    { concurrency: 'unbounded' }
  );

  yield* Effect.forkDaemon(
    targetOrgRef.changes.pipe(
      Stream.map(org => org.orgId),
      Stream.changes,
      // we do want a change to "no org" to trigger the refresh so it shows the empty state.
      Stream.tap(orgId => svc.appendToChannel(`Target org changed to ${orgId ?? '<NOT SET>'}`)),
      Stream.tap(() => svc.appendToChannel('Org changed, will try to update OrgBrowser')),
      Stream.runForEach(() => Effect.promise(() => treeProvider.refreshType()))
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
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel('Salesforce Org Browser extension is now deactivated!');
});
