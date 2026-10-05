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
import * as Runtime from 'effect/Runtime';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { matchesPattern, MAX_TYPES_FOR_COMPONENT_PREFETCH } from '../utils/wildcardPattern';

const parsePattern = (input: string): { pattern: string; isRegex: boolean } => {
  if (input.startsWith('/')) {
    const closeIdx = input.indexOf('/', 1);
    if (closeIdx !== -1) return { pattern: input.substring(1, closeIdx), isRegex: true };
  }
  return { pattern: input, isRegex: false };
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
  const previousUserApprovedBroadFetch = treeProvider.userApprovedBroadFetch;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgMetadataCatalog = yield* api.services.OrgMetadataCatalog;
  const runtime = yield* Effect.runtime();
  const run = Runtime.runFork(runtime);
  const queue = yield* Queue.unbounded<string>();
  const deferred = yield* Deferred.make<void>();

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
  const initialValue = picker.value;
  picker.items = [];

  const updateFilterContext = (active: boolean) =>
    Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.textFilterActive', active));

  const applyFilter = (filter: ReturnType<typeof parseFilterValue>, userApprovedBroadFetch = false) =>
    Effect.gen(function* () {
      const { typeFilter, componentFilter, typeIsRegex, componentIsRegex } = filter;
      treeProvider.setTextFilter(typeFilter, componentFilter, typeIsRegex, componentIsRegex, userApprovedBroadFetch);
      yield* Effect.promise(() => context.workspaceState.update('orgBrowser.typeFilter', typeFilter));
      yield* Effect.promise(() => context.workspaceState.update('orgBrowser.componentFilter', componentFilter));
      yield* Effect.promise(() => context.workspaceState.update('orgBrowser.typeIsRegex', typeIsRegex));
      yield* Effect.promise(() => context.workspaceState.update('orgBrowser.componentIsRegex', componentIsRegex));
      yield* updateFilterContext(isNotUndefined(typeFilter) || isNotUndefined(componentFilter));
    });

  const liveFilterFiber = yield* Stream.fromQueue(queue).pipe(
    Stream.debounce(Duration.millis(150)),
    Stream.runForEach(value => applyFilter(parseFilterValue(value)).pipe(Effect.uninterruptible)),
    Effect.fork
  );

  picker.onDidChangeValue(value => run(Queue.offer(queue, value)));
  picker.onDidAccept(() => picker.hide());
  picker.onDidHide(() =>
    run(
      Effect.gen(function* () {
        yield* Fiber.interrupt(liveFilterFiber);
        const filter = parseFilterValue(picker.value);
        const unchanged = picker.value === initialValue;
        yield* applyFilter(filter, unchanged && previousUserApprovedBroadFetch);

        if (!unchanged && filter.componentFilter) {
          const types = yield* orgMetadataCatalog.getChildren();
          const matchedCount = types.filter(
            entry =>
              entry.kind === 'type' &&
              entry.reference.type &&
              (!filter.typeFilter || matchesPattern(entry.reference.type, filter.typeFilter, filter.typeIsRegex))
          ).length;
          if (matchedCount > MAX_TYPES_FOR_COMPONENT_PREFETCH) {
            const approved = yield* Effect.promise(
              async () =>
                (await vscode.window.showInformationMessage(
                  nls.localize('filter_fetch_confirmation', matchedCount.toString()),
                  nls.localize('yes_button'),
                  nls.localize('no_button')
                )) === nls.localize('yes_button')
            );
            if (approved)
              treeProvider.setTextFilter(
                filter.typeFilter,
                filter.componentFilter,
                filter.typeIsRegex,
                filter.componentIsRegex,
                true
              );
          }
        }
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
