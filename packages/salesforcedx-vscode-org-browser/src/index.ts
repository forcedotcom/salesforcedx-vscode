/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isString, isUndefined } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { makeFilterState } from './browser/filter';
import { OrgBrowserWebviewProvider } from './browser/orgBrowserWebviewProvider';
import { EXTENSION_NAME, TREE_VIEW_ID } from './constants';
import {
  AllServicesLayer,
  buildAllServicesLayer,
  getOrgBrowserRuntime,
  setAllServicesLayer
} from './services/extensionProvider';

const encodePattern = (pattern: string | undefined, isRegex: boolean): string =>
  pattern ? (isRegex ? `/${pattern}/` : pattern) : '';

const restoreFilterText = (context: vscode.ExtensionContext): string => {
  const type = context.workspaceState.get<string>('orgBrowser.typeFilter');
  const component = context.workspaceState.get<string>('orgBrowser.componentFilter');
  const typeIsRegex = context.workspaceState.get<boolean>('orgBrowser.typeIsRegex') ?? false;
  const componentIsRegex = context.workspaceState.get<boolean>('orgBrowser.componentIsRegex') ?? false;
  if (component !== undefined)
    return `${encodePattern(type, typeIsRegex)}:${encodePattern(component, componentIsRegex)}`;
  return encodePattern(type, typeIsRegex);
};

const migrateLegacyFilterState = Effect.fn('OrgBrowser.migrateLegacyFilterState')(function* (
  context: vscode.ExtensionContext
) {
  const legacyViewMode = context.workspaceState.get<string>('orgBrowser.viewMode');
  if (legacyViewMode === undefined) return;
  yield* Effect.all(
    [
      Effect.promise(() => context.workspaceState.update('orgBrowser.showLocal', legacyViewMode !== 'orgOnly')),
      Effect.promise(() => context.workspaceState.update('orgBrowser.showOrg', legacyViewMode !== 'localOnly')),
      Effect.promise(() => context.workspaceState.update('orgBrowser.viewMode', undefined))
    ],
    { concurrency: 'unbounded', discard: true }
  );
});

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await Effect.runPromise(activateEffect(context).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(deactivateEffect().pipe(Effect.provide(AllServicesLayer)));

export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;
  yield* channel.appendToChannel('Salesforce Org Browser extension activating');

  yield* api.services.ConnectionService.getConnection();
  const targetOrgRef = yield* api.services.TargetOrgRef();
  yield* Effect.repeat(SubscriptionRef.get(targetOrgRef), {
    until: org => org.orgId !== undefined,
    schedule: Schedule.exponential(Duration.millis(10))
  });

  yield* migrateLegacyFilterState(context);
  const provider = new OrgBrowserWebviewProvider(
    context,
    makeFilterState(
      context.workspaceState.get<boolean>('orgBrowser.showLocal') ?? true,
      context.workspaceState.get<boolean>('orgBrowser.showOrg') ?? true,
      restoreFilterText(context)
    )
  );
  context.subscriptions.push(
    provider,
    vscode.window.registerWebviewViewProvider(TREE_VIEW_ID, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  const extensionScope = yield* getExtensionScope();
  const catalogChanges = yield* api.services.OrgMetadataCatalogChangePubSub;
  yield* Effect.forkIn(
    Stream.fromPubSub(catalogChanges).pipe(
      Stream.debounce(Duration.millis(100)),
      Stream.runForEach(() => Effect.sync(() => provider.refreshFromCatalog()))
    ),
    extensionScope
  );

  const registerCommand = api.services.registerCommandWithRuntime(getOrgBrowserRuntime());
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
      registerCommand(`${TREE_VIEW_ID}.refreshType`, (node?: { readonly id?: string }) =>
        Effect.sync(() => provider.refresh(node?.id))
      ),
      registerCommand(`${TREE_VIEW_ID}.collapseAll`, () => Effect.sync(() => provider.collapseAll())),
      registerCommand(`${TREE_VIEW_ID}.retrieveMetadata`, (node?: { readonly id?: string }) =>
        Effect.sync(() => {
          if (node?.id) provider.retrieve(node.id);
        })
      ),
      registerCommand(`${TREE_VIEW_ID}.showLocal.on`, () => Effect.sync(() => provider.setLocalPresence(true))),
      registerCommand(`${TREE_VIEW_ID}.showLocal.off`, () => Effect.sync(() => provider.setLocalPresence(false))),
      registerCommand(`${TREE_VIEW_ID}.showOrg.on`, () => Effect.sync(() => provider.setOrgPresence(true))),
      registerCommand(`${TREE_VIEW_ID}.showOrg.off`, () => Effect.sync(() => provider.setOrgPresence(false))),
      registerCommand(`${TREE_VIEW_ID}.filterText`, () => Effect.sync(() => provider.focusFilter())),
      registerCommand(`${TREE_VIEW_ID}.filterText.active`, () => Effect.sync(() => provider.focusFilter()))
    ],
    { concurrency: 'unbounded', discard: true }
  );

  yield* Effect.forkIn(
    targetOrgRef.changes.pipe(
      Stream.map(org => org.orgId),
      Stream.changes,
      Stream.tap(orgId => channel.appendToChannel(`Target org changed to ${orgId ?? '<NOT SET>'}`)),
      Stream.runForEach(() => Effect.sync(() => provider.refreshFromCatalog()))
    ),
    extensionScope
  );

  yield* channel.appendToChannel('Salesforce Org Browser activation complete.');
  const lastVersion = context.globalState.get<string>('orgBrowser.walkthroughVersion');
  if (isUndefined(lastVersion)) {
    const version = context.extension.packageJSON?.version;
    yield* Effect.promise(() =>
      context.globalState.update('orgBrowser.walkthroughVersion', isString(version) ? version : '0.0.0')
    );
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
  yield* (yield* api.services.ChannelService).appendToChannel('Salesforce Org Browser extension is now deactivated!');
});
