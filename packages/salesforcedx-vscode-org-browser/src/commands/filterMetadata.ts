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
import { discoverFullOrgMetadata, type FullOrgDiscoveryProgress } from '../services/fullOrgDiscovery';

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
  return (value.startsWith('/') || colonIdx !== -1) && !isCompleteSearchTerm(value);
};

type ParsedFilter = ReturnType<typeof parseFilterValue>;

const formatDiscoveryProgress = ({
  completed,
  total,
  componentCompleted,
  componentTotal
}: FullOrgDiscoveryProgress): string =>
  componentTotal === 0
    ? `$(sync~spin) Discovering org metadata types ${completed}/${total}`
    : `$(sync~spin) Discovering org metadata types ${completed}/${total} components ${componentCompleted}/${componentTotal}`;

const promptRestoredFilterDiscovery = (
  treeProvider: MetadataTypeTreeProvider,
  context: vscode.ExtensionContext,
  catalog: OrgMetadataCatalog,
  orgId: string,
  filter: ParsedFilter,
  requestTreeRefresh: (immediate?: boolean) => void
) =>
  Effect.gen(function* () {
    const releaseFilterProjection = (decision: string) =>
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan({ decision, projectionReleased: true });
        treeProvider.setTextFilter(
          filter.typeFilter,
          filter.componentFilter,
          filter.typeIsRegex,
          filter.componentIsRegex
        );
      });
    if (!filter.typeFilter && !filter.componentFilter) {
      yield* Effect.annotateCurrentSpan({ decision: 'no-filter', projectionReleased: false });
      return;
    }
    if (treeProvider.hasShownDiscoveryOffer()) {
      yield* releaseFilterProjection('offer-already-shown');
      return;
    }
    const types = (yield* catalog.getChildren()).filter(entry => entry.kind === 'type' && entry.reference.type);
    const unfetchedTypes = yield* Effect.filter(types, entry =>
      catalog.hasTypeInventory(entry.reference.type!).pipe(Effect.map(loaded => !loaded))
    );
    if (unfetchedTypes.length === 0 || treeProvider.hasStartedFullDiscovery(orgId)) {
      yield* releaseFilterProjection(unfetchedTypes.length === 0 ? 'loaded-results' : 'discovery-already-started');
      return;
    }
    if (!treeProvider.claimDiscoveryOffer()) {
      yield* releaseFilterProjection('offer-already-shown');
      return;
    }

    yield* Effect.annotateCurrentSpan({ notificationShown: true, unfetchedTypeCount: unfetchedTypes.length });
    const response = yield* Effect.promise(
      async () =>
        await vscode.window.showInformationMessage(
          nls.localize('filter_discovery_confirmation', unfetchedTypes.length),
          nls.localize('search_all_types_button'),
          nls.localize('use_loaded_results_button')
        )
    );
    if (response !== nls.localize('search_all_types_button')) {
      yield* releaseFilterProjection(
        response === nls.localize('use_loaded_results_button') ? 'use-loaded-results' : 'dismissed'
      );
      return;
    }

    treeProvider.markFullDiscoveryStarted(orgId);
    yield* Effect.annotateCurrentSpan({ decision: 'search-all-types', fullDiscoveryStarted: true });
    yield* releaseFilterProjection('search-all-types');
    requestTreeRefresh(true);
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(status);
    status.show();
    void getOrgBrowserRuntime().runPromise(
      discoverFullOrgMetadata(catalog, progress => {
        status.text = formatDiscoveryProgress(progress);
        requestTreeRefresh();
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            status.dispose();
            requestTreeRefresh();
          })
        )
      )
    );
  }).pipe(
    Effect.withSpan('OrgBrowser.restoreFilterDiscovery', {
      attributes: {
        orgId,
        typeFilter: filter.typeFilter,
        componentFilter: filter.componentFilter,
        typeIsRegex: filter.typeIsRegex,
        componentIsRegex: filter.componentIsRegex
      }
    })
  );

/** Evaluates a restored component filter after the Org Browser runtime is fully initialized. */
export const requestRestoredFilterDiscovery = (
  treeProvider: MetadataTypeTreeProvider,
  context: vscode.ExtensionContext,
  filter: ParsedFilter,
  requestTreeRefresh: (immediate?: boolean) => void
): void => {
  void getOrgBrowserRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const catalog = yield* api.services.OrgMetadataCatalog;
      const { orgId } = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
      if (!orgId) return;
      yield* promptRestoredFilterDiscovery(treeProvider, context, catalog, orgId, filter, requestTreeRefresh);
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
  context: vscode.ExtensionContext,
  requestTreeRefresh: (immediate?: boolean) => void
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
    requestTreeRefresh(true);
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    context.subscriptions.push(status);
    status.show();
    void getOrgBrowserRuntime().runPromise(
      discoverFullOrgMetadata(orgMetadataCatalog, progress => {
        status.text = formatDiscoveryProgress(progress);
        requestTreeRefresh();
      }).pipe(
        // Release the status indicator and ensure the final discovered type is projected.
        Effect.ensuring(
          Effect.sync(() => {
            status.dispose();
            requestTreeRefresh();
          })
        ),
        Effect.catchAllCause(error => Effect.logWarning('Full org metadata discovery failed', error))
      )
    );
  };

  const promptFullDiscovery = (value: string) =>
    Effect.gen(function* () {
      if (!value.trim() || !isCompleteSearchTerm(value)) return;
      const { orgId } = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
      if (!orgId || treeProvider.hasStartedFullDiscovery(orgId) || treeProvider.hasShownDiscoveryOffer()) return;
      const types = (yield* orgMetadataCatalog.getChildren()).filter(
        entry => entry.kind === 'type' && entry.reference.type
      );
      const unfetchedTypes = yield* Effect.filter(types, entry =>
        orgMetadataCatalog.hasTypeInventory(entry.reference.type!).pipe(Effect.map(loaded => !loaded))
      );
      if (unfetchedTypes.length === 0 || !treeProvider.claimDiscoveryOffer()) return;

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

  const requestFullDiscovery = (value: string) =>
    Effect.gen(function* () {
      const canPrompt = yield* Ref.modify(discoveryPromptOpen, open => [!open, true]);
      if (!canPrompt) return;
      yield* Effect.forkDaemon(promptFullDiscovery(value).pipe(Effect.ensuring(Ref.set(discoveryPromptOpen, false))));
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
      // Release the picker's in-flight guard if an expression becomes invalid.
      // The provider still enforces the session-wide one-time offer.
      if (invalidStructuredSearch) yield* Ref.set(discoveryPromptOpen, false);
      yield* requestFullDiscovery(value);
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
