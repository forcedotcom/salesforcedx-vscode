/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MetadataTypeTreeProvider } from '../tree/metadataTypeTreeProvider';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import { isNotUndefined } from 'effect/Predicate';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { OrgMetadataCatalog } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { getOrgBrowserRuntime } from '../services/extensionProvider';
import { saveFilterState } from '../services/filterState';
import { discoverFullOrgMetadata } from '../services/fullOrgDiscovery';
import { matchesPattern } from '../utils/wildcardPattern';

const parsePattern = (input: string): { pattern: string; isRegex: boolean } => {
  if (input.startsWith('/')) {
    const closeIdx = input.indexOf('/', 1);
    if (closeIdx !== -1) return { pattern: input.substring(1, closeIdx), isRegex: true };
  }
  return { pattern: input, isRegex: false };
};

const isCompletePattern = (input: string): boolean => {
  if (!input.startsWith('/')) return true;
  const closeIdx = input.indexOf('/', 1);
  if (closeIdx === -1 || closeIdx !== input.length - 1) return false;
  // eslint-disable-next-line functional/no-try-statements
  try {
    new RegExp(input.substring(1, closeIdx));
    return true;
  } catch {
    return false;
  }
};

/** Whether an input is complete and valid enough to request an org-wide metadata discovery. */
export const isCompleteSearchTerm = (value: string): boolean => {
  const colonIdx = value.indexOf(':');
  return colonIdx === -1
    ? isCompletePattern(value.trim())
    : isCompletePattern(value.substring(0, colonIdx).trim()) && isCompletePattern(value.substring(colonIdx + 1).trim());
};

export const isInvalidStructuredSearchTerm = (value: string): boolean => {
  const colonIdx = value.indexOf(':');
  return (
    (value.startsWith('/') || colonIdx !== -1) &&
    (!isCompleteSearchTerm(value) || (colonIdx > 0 && value.substring(colonIdx + 1).trim() === ''))
  );
};

type ParsedFilter = ReturnType<typeof parseFilterValue>;

const promptRestoredFilterDiscovery = (
  treeProvider: MetadataTypeTreeProvider,
  context: vscode.ExtensionContext,
  catalog: OrgMetadataCatalog,
  orgId: string,
  filter: ParsedFilter
) =>
  Effect.gen(function* () {
    const refreshScheduled = yield* Ref.make(false);
    const releaseFilterProjection = () => {
      treeProvider.setTextFilter(
        filter.typeFilter,
        filter.componentFilter,
        filter.typeIsRegex,
        filter.componentIsRegex
      );
    };
    if (!filter.componentFilter) return;
    const matchingTypes = (yield* catalog.getChildren()).filter(
      entry =>
        entry.kind === 'type' &&
        entry.reference.type &&
        (!filter.typeFilter || matchesPattern(entry.reference.type, filter.typeFilter, filter.typeIsRegex))
    );
    const unfetchedTypes = yield* Effect.filter(matchingTypes, entry =>
      catalog.hasTypeInventory(entry.reference.type!).pipe(Effect.map(loaded => !loaded))
    );
    if (unfetchedTypes.length === 0 || treeProvider.hasStartedFullDiscovery(orgId)) {
      releaseFilterProjection();
      return;
    }

    const approved = yield* Effect.promise(
      async () =>
        (await vscode.window.showInformationMessage(
          nls.localize('filter_discovery_confirmation', unfetchedTypes.length),
          nls.localize('search_all_types_button'),
          nls.localize('use_loaded_results_button')
        )) === nls.localize('search_all_types_button')
    );
    if (!approved) {
      releaseFilterProjection();
      return;
    }

    treeProvider.markFullDiscoveryStarted(orgId);
    releaseFilterProjection();
    treeProvider.setDiscoveryInProgress(true);
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(status);
    status.show();
    void getOrgBrowserRuntime().runPromise(
      discoverFullOrgMetadata(catalog, ({ completed, total }) => {
        status.text = `$(sync~spin) Discovering org metadata ${completed}/${total}`;
        void getOrgBrowserRuntime().runPromise(
          Ref.modify(refreshScheduled, scheduled => [!scheduled, true]).pipe(
            Effect.flatMap(shouldRefresh =>
              shouldRefresh
                ? Effect.sleep(Duration.millis(500)).pipe(
                    Effect.zipRight(Effect.sync(() => treeProvider.fireChangeEvent())),
                    Effect.ensuring(Ref.set(refreshScheduled, false))
                  )
                : Effect.void
            )
          )
        );
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            status.dispose();
            treeProvider.setDiscoveryInProgress(false);
          })
        ),
        Effect.catchAllCause(error => Effect.logWarning('Full org metadata discovery failed', error))
      )
    );
    treeProvider.fireChangeEvent();
  });

/** Evaluates a restored component filter after the Org Browser runtime is fully initialized. */
export const requestRestoredFilterDiscovery = (
  treeProvider: MetadataTypeTreeProvider,
  context: vscode.ExtensionContext,
  filter: ParsedFilter
): void => {
  void getOrgBrowserRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const catalog = yield* api.services.OrgMetadataCatalog;
      const { orgId } = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
      if (!orgId) return;
      yield* promptRestoredFilterDiscovery(treeProvider, context, catalog, orgId, filter);
    })
  );
};

export const parseFilterValue = (
  value: string
): {
  typeFilter: string | undefined;
  componentFilter: string | undefined;
  typeIsRegex: boolean;
  componentIsRegex: boolean;
} => {
  if (value.length === 0)
    return { typeFilter: undefined, componentFilter: undefined, typeIsRegex: false, componentIsRegex: false };

  if (value.startsWith(':')) {
    const { pattern, isRegex } = parsePattern(value.substring(1));
    return { typeFilter: '*', componentFilter: pattern, typeIsRegex: false, componentIsRegex: isRegex };
  }

  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) {
    const { pattern, isRegex } = parsePattern(value.trim());
    return { typeFilter: undefined, componentFilter: pattern, typeIsRegex: false, componentIsRegex: isRegex };
  }

  const typeParsed = parsePattern(value.substring(0, colonIdx).trim());
  const componentParsed = parsePattern(value.substring(colonIdx + 1).trim());
  return {
    typeFilter: typeParsed.pattern === '' ? '*' : typeParsed.pattern,
    componentFilter: componentParsed.pattern,
    typeIsRegex: typeParsed.isRegex,
    componentIsRegex: componentParsed.isRegex
  };
};

export const openFilterTextPicker = Effect.fn('OrgBrowser.openFilterTextPicker')(function* (
  treeProvider: MetadataTypeTreeProvider,
  context: vscode.ExtensionContext
) {
  const previousTypeFilter = treeProvider.typeFilter;
  const previousComponentFilter = treeProvider.componentFilter;
  const previousTypeIsRegex = treeProvider.typeIsRegex;
  const previousComponentIsRegex = treeProvider.componentIsRegex;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgMetadataCatalog = yield* api.services.OrgMetadataCatalog;
  const runtime = yield* Effect.runtime();
  const run = Runtime.runFork(runtime);
  const queue = yield* Queue.unbounded<string>();
  const deferred = yield* Deferred.make<void>();
  const discoveryPromptOpen = yield* Ref.make(false);
  const discoveryRefreshScheduled = yield* Ref.make(false);

  const picker = vscode.window.createQuickPick<vscode.QuickPickItem>();
  picker.placeholder = nls.localize('filter_text_placeholder');
  picker.matchOnDescription = false;
  picker.value = previousTypeFilter
    ? isNotUndefined(previousComponentFilter)
      ? previousTypeIsRegex
        ? `/${previousTypeFilter}/:${previousComponentIsRegex ? `/${previousComponentFilter}/` : previousComponentFilter}`
        : `${previousTypeFilter}:${previousComponentIsRegex ? `/${previousComponentFilter}/` : previousComponentFilter}`
      : previousTypeIsRegex
        ? `/${previousTypeFilter}/`
        : previousTypeFilter
    : previousComponentIsRegex
      ? `/${previousComponentFilter ?? ''}/`
      : (previousComponentFilter ?? '');
  picker.items = [];

  const updateFilterContext = (active: boolean) =>
    Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.textFilterActive', active));

  const updateInvalidSearchContext = (value: string) =>
    Effect.promise(() =>
      vscode.commands.executeCommand(
        'setContext',
        'sf:orgBrowser.invalidStructuredSearch',
        isInvalidStructuredSearchTerm(value)
      )
    );

  const startFullDiscovery = (orgId: string) => {
    treeProvider.markFullDiscoveryStarted(orgId);
    treeProvider.setDiscoveryInProgress(true);
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(status);
    status.show();
    void getOrgBrowserRuntime().runPromise(
      discoverFullOrgMetadata(orgMetadataCatalog, ({ completed, total }) => {
        status.text = `$(sync~spin) Discovering org metadata ${completed}/${total}`;
        void getOrgBrowserRuntime().runPromise(
          Ref.modify(discoveryRefreshScheduled, scheduled => [!scheduled, true]).pipe(
            Effect.flatMap(shouldRefresh =>
              shouldRefresh
                ? Effect.sleep(Duration.millis(500)).pipe(
                    Effect.zipRight(Effect.sync(() => treeProvider.fireChangeEvent())),
                    Effect.ensuring(Ref.set(discoveryRefreshScheduled, false))
                  )
                : Effect.void
            )
          )
        );
      }).pipe(
        // Release the status indicator and ensure the final discovered type is projected.
        Effect.ensuring(
          Effect.sync(() => {
            status.dispose();
            treeProvider.setDiscoveryInProgress(false);
          })
        ),
        Effect.catchAllCause(error => Effect.logWarning('Full org metadata discovery failed', error))
      )
    );
  };

  const promptFullDiscovery = (value: string, filter: ReturnType<typeof parseFilterValue>) =>
    Effect.gen(function* () {
      if (!filter.componentFilter || !isCompleteSearchTerm(value)) return;
      const types = yield* orgMetadataCatalog.getChildren();
      const { orgId } = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
      const matchingTypes = types.filter(
        entry =>
          entry.kind === 'type' &&
          entry.reference.type &&
          (!filter.typeFilter || matchesPattern(entry.reference.type, filter.typeFilter, filter.typeIsRegex))
      );
      const unfetchedTypes = yield* Effect.filter(matchingTypes, entry =>
        orgMetadataCatalog.hasTypeInventory(entry.reference.type!).pipe(Effect.map(loaded => !loaded))
      );
      if (!orgId || unfetchedTypes.length === 0 || treeProvider.hasStartedFullDiscovery(orgId)) return;

      const approved = yield* Effect.promise(
        async () =>
          (await vscode.window.showInformationMessage(
            nls.localize('filter_discovery_confirmation', unfetchedTypes.length),
            nls.localize('search_all_types_button'),
            nls.localize('use_loaded_results_button')
          )) === nls.localize('search_all_types_button')
      );
      if (approved) startFullDiscovery(orgId);
    });

  const requestFullDiscovery = (value: string, filter: ReturnType<typeof parseFilterValue>) =>
    Effect.gen(function* () {
      const canPrompt = yield* Ref.modify(discoveryPromptOpen, open => [!open, true]);
      if (!canPrompt) return;
      yield* Effect.forkDaemon(
        promptFullDiscovery(value, filter).pipe(Effect.ensuring(Ref.set(discoveryPromptOpen, false)))
      );
    });

  const applyFilter = (value: string) =>
    Effect.gen(function* () {
      const filter = parseFilterValue(value);
      const invalidStructuredSearch = isInvalidStructuredSearchTerm(value);
      const { typeFilter, componentFilter, typeIsRegex, componentIsRegex } = filter;
      treeProvider.setTextFilter(typeFilter, componentFilter, typeIsRegex, componentIsRegex, invalidStructuredSearch);
      const { orgId } = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
      if (orgId) yield* Effect.promise(() => saveFilterState(context, orgId, filter));
      yield* updateFilterContext(isNotUndefined(typeFilter) || isNotUndefined(componentFilter));
      yield* updateInvalidSearchContext(value);
      // VS Code dismisses the non-modal prompt while the user corrects an invalid expression.
      // Allow the next valid, debounced term to raise a fresh prompt.
      if (invalidStructuredSearch) yield* Ref.set(discoveryPromptOpen, false);
      yield* requestFullDiscovery(value, filter);
    });

  const liveFilterFiber = yield* Stream.fromQueue(queue).pipe(
    Stream.debounce(Duration.millis(300)),
    Stream.runForEach(value => applyFilter(value).pipe(Effect.uninterruptible)),
    Effect.fork
  );

  picker.onDidChangeValue(value => run(Queue.offer(queue, value)));
  picker.onDidAccept(() => picker.hide());
  picker.onDidHide(() =>
    run(
      Effect.gen(function* () {
        yield* Fiber.interrupt(liveFilterFiber);
        yield* applyFilter(picker.value);
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => picker.dispose()).pipe(Effect.ensuring(Deferred.succeed(deferred, undefined)))
        )
      )
    )
  );

  picker.show();
  yield* Deferred.await(deferred);
});
