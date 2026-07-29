/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getExtensionScope, NotificationModeService } from '@salesforce/effect-ext-utils';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isNotUndefined, isString, isUndefined } from 'effect/Predicate';
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
import { buildAllServicesLayer, getOrgBrowserRuntime, setAllServicesLayer } from './services/extensionProvider';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem } from './tree/orgBrowserNode';
import { matchesPattern, MAX_TYPES_FOR_COMPONENT_PREFETCH } from './utils/wildcardPattern';

/**
 * Parse a single pattern (type or component) and return the pattern + regex flag.
 * Handles /pattern/ regex syntax, returns pattern without delimiters.
 */
const parsePattern = (input: string): { pattern: string; isRegex: boolean } => {
  if (input.startsWith('/')) {
    const closeIdx = input.indexOf('/', 1);
    if (closeIdx !== -1) {
      return { pattern: input.substring(1, closeIdx), isRegex: true };
    }
  }
  return { pattern: input, isRegex: false };
};

const parseFilterValue = (
  value: string
): {
  typeFilter: string | undefined;
  componentFilter: string | undefined;
  typeIsRegex: boolean;
  componentIsRegex: boolean;
} => {
  if (value.length === 0)
    return { typeFilter: undefined, componentFilter: undefined, typeIsRegex: false, componentIsRegex: false };

  // Convenience pattern: :component (empty type defaults to *)
  if (value.startsWith(':')) {
    const input = value.substring(1);
    const { pattern, isRegex } = parsePattern(input);
    return { typeFilter: '*', componentFilter: pattern, typeIsRegex: false, componentIsRegex: isRegex };
  }

  // Split at first unescaped colon
  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) {
    // Type-only pattern
    const { pattern, isRegex } = parsePattern(value.trim());
    return { typeFilter: pattern, componentFilter: undefined, typeIsRegex: isRegex, componentIsRegex: false };
  }

  // Type:component pattern
  const typeInput = value.substring(0, colonIdx).trim();
  const componentInput = value.substring(colonIdx + 1).trim();

  const typeParsed = parsePattern(typeInput);
  const componentParsed = parsePattern(componentInput);

  // Empty type defaults to * (match all types)
  const typeFilter = typeParsed.pattern === '' ? '*' : typeParsed.pattern;

  return {
    typeFilter,
    componentFilter: componentParsed.pattern,
    typeIsRegex: typeParsed.isRegex,
    componentIsRegex: componentParsed.isRegex
  };
};

type FilterQuickPickItem = vscode.QuickPickItem;

const openFilterTextPicker = Effect.fn('OrgBrowser.openFilterTextPicker')(function* (
  treeProvider: MetadataTypeTreeProvider,
  context: vscode.ExtensionContext
) {
  const previousTypeFilter = treeProvider.typeFilter;
  const previousComponentFilter = treeProvider.componentFilter;
  const previousTypeIsRegex = treeProvider.typeIsRegex;
  const previousComponentIsRegex = treeProvider.componentIsRegex;

  // Resolve services once for reuse in commit
  const svcProvider = yield* ExtensionProviderService;
  const api = yield* svcProvider.getServicesApi;
  const metadataDescribeService = yield* api.services.MetadataDescribeService;

  const runtime = yield* Effect.runtime();
  const run = Runtime.runFork(runtime);

  const queue = yield* Queue.unbounded<string>();
  const deferred = yield* Deferred.make<void>();
  const acceptedRef = yield* Ref.make(false);

  const picker = vscode.window.createQuickPick<FilterQuickPickItem>();
  picker.placeholder = nls.localize('filter_text_placeholder');
  picker.matchOnDescription = false;

  // Reconstruct filter value with regex delimiters if needed
  picker.value = previousTypeFilter
    ? isNotUndefined(previousComponentFilter)
      ? previousTypeIsRegex
        ? `/${previousTypeFilter}/:${previousComponentIsRegex ? `/${previousComponentFilter}/` : previousComponentFilter}`
        : `${previousTypeFilter}:${previousComponentIsRegex ? `/${previousComponentFilter}/` : previousComponentFilter}`
      : previousTypeIsRegex
        ? `/${previousTypeFilter}/`
        : previousTypeFilter
    : '';
  picker.items = []; // Suggestions populated by live filtering as user types

  const commit = (value: string) =>
    Effect.gen(function* () {
      yield* Ref.set(acceptedRef, true);
      const { typeFilter, componentFilter, typeIsRegex, componentIsRegex } = parseFilterValue(value);

      // Check if we should prompt for broad component fetch
      const userApprovedBroadFetch =
        componentFilter && componentFilter !== '' && typeFilter
          ? yield* Effect.gen(function* () {
              const types = yield* metadataDescribeService.describe();
              const matchedCount = types.filter(t => matchesPattern(t.xmlName, typeFilter, typeIsRegex)).length;

              if (matchedCount > MAX_TYPES_FOR_COMPONENT_PREFETCH) {
                return yield* Effect.promise(async () => {
                  const result = await vscode.window.showInformationMessage(
                    nls.localize('filter_fetch_confirmation', matchedCount.toString()),
                    nls.localize('yes_button'),
                    nls.localize('no_button')
                  );
                  return result === nls.localize('yes_button');
                });
              }
              return false;
            })
          : false;

      treeProvider.setTextFilter(typeFilter, componentFilter, typeIsRegex, componentIsRegex, userApprovedBroadFetch);
      yield* Effect.all(
        [
          Effect.promise(() => context.workspaceState.update('orgBrowser.typeFilter', typeFilter)),
          Effect.promise(() => context.workspaceState.update('orgBrowser.componentFilter', componentFilter)),
          Effect.promise(() => context.workspaceState.update('orgBrowser.typeIsRegex', typeIsRegex)),
          Effect.promise(() => context.workspaceState.update('orgBrowser.componentIsRegex', componentIsRegex)),
          Effect.promise(() =>
            vscode.commands.executeCommand(
              'setContext',
              'sf:orgBrowser.textFilterActive',
              isNotUndefined(typeFilter) || isNotUndefined(componentFilter)
            )
          )
        ],
        { concurrency: 'unbounded' }
      );
      picker.dispose();
      yield* Deferred.succeed(deferred, undefined);
    });

  picker.onDidChangeValue(value => run(Queue.offer(queue, value)));
  picker.onDidAccept(() => {
    // Accept whatever the user typed, not just selected items
    const valueToCommit = picker.value;
    run(commit(valueToCommit));
  });
  picker.onDidHide(() =>
    run(
      Effect.gen(function* () {
        const accepted = yield* Ref.get(acceptedRef);
        if (!accepted) {
          treeProvider.setTextFilter(
            previousTypeFilter,
            previousComponentFilter,
            previousTypeIsRegex,
            previousComponentIsRegex
          );
          // Restore context key to match restored filter state
          yield* Effect.promise(() =>
            vscode.commands.executeCommand(
              'setContext',
              'sf:orgBrowser.textFilterActive',
              isNotUndefined(previousTypeFilter) || isNotUndefined(previousComponentFilter)
            )
          );
        }
        picker.dispose();
        yield* Deferred.succeed(deferred, undefined);
      })
    )
  );

  // Live filtering: update tree as user types
  yield* Stream.fromQueue(queue).pipe(
    Stream.debounce(Duration.millis(150)),
    Stream.runForEach(value =>
      Effect.gen(function* () {
        const { typeFilter, componentFilter, typeIsRegex, componentIsRegex } = parseFilterValue(value);
        treeProvider.setTextFilter(typeFilter, componentFilter, typeIsRegex, componentIsRegex);
        yield* Effect.promise(() =>
          vscode.commands.executeCommand(
            'setContext',
            'sf:orgBrowser.textFilterActive',
            isNotUndefined(typeFilter) || isNotUndefined(componentFilter)
          )
        );
      })
    ),
    Effect.fork
  );

  picker.show();
  yield* Deferred.await(deferred);
});

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await getOrgBrowserRuntime().runPromise(activateEffect(context).pipe(Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> => getOrgBrowserRuntime().runPromise(deactivateEffect());

// export for testing
export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const svc = yield* api.services.ChannelService;
  yield* svc.appendToChannel('Salesforce Org Browser extension activating');
  const notifSvc = yield* NotificationModeService;
  yield* Effect.sync(() => context.subscriptions.push({ dispose: () => notifSvc.runDispose() }));

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

  // Read persisted filter state
  const showLocal = context.workspaceState.get<boolean>('orgBrowser.showLocal') ?? true;
  const showOrg = context.workspaceState.get<boolean>('orgBrowser.showOrg') ?? true;
  const typeFilter = context.workspaceState.get<string | undefined>('orgBrowser.typeFilter');
  const componentFilter = context.workspaceState.get<string | undefined>('orgBrowser.componentFilter');
  const typeIsRegex = context.workspaceState.get<boolean>('orgBrowser.typeIsRegex') ?? false;
  const componentIsRegex = context.workspaceState.get<boolean>('orgBrowser.componentIsRegex') ?? false;

  treeProvider.setShowLocal(showLocal);
  treeProvider.setShowOrg(showOrg);
  if (isNotUndefined(typeFilter) || isNotUndefined(componentFilter)) {
    treeProvider.setTextFilter(typeFilter, componentFilter, typeIsRegex, componentIsRegex);
  }

  // Set initial context keys
  yield* Effect.all(
    [
      Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showLocal', showLocal)),
      Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.showOrg', showOrg)),
      Effect.promise(() =>
        vscode.commands.executeCommand(
          'setContext',
          'sf:orgBrowser.textFilterActive',
          isNotUndefined(typeFilter) || isNotUndefined(componentFilter)
        )
      ),
      Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.treeEmpty', false))
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
      registerCommand(`${TREE_VIEW_ID}.filterText`, () => openFilterTextPicker(treeProvider, context)),
      registerCommand(`${TREE_VIEW_ID}.filterText.active`, () => openFilterTextPicker(treeProvider, context))
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
