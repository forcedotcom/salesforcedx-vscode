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

  if (value.startsWith(':')) {
    const { pattern, isRegex } = parsePattern(value.substring(1));
    return { typeFilter: '*', componentFilter: pattern, typeIsRegex: false, componentIsRegex: isRegex };
  }

  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) {
    const { pattern, isRegex } = parsePattern(value.trim());
    return { typeFilter: pattern, componentFilter: undefined, typeIsRegex: isRegex, componentIsRegex: false };
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
  // VS Code may hide the picker immediately after acceptance, so this must update synchronously.
  // eslint-disable-next-line functional/no-let
  let accepted = false;

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
    : '';
  picker.items = [];

  const updateFilterContext = (active: boolean) =>
    Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:orgBrowser.textFilterActive', active));

  const commit = (value: string) =>
    Effect.gen(function* () {
      const { typeFilter, componentFilter, typeIsRegex, componentIsRegex } = parseFilterValue(value);
      const userApprovedBroadFetch =
        componentFilter && componentFilter !== '' && typeFilter
          ? yield* Effect.gen(function* () {
              const types = yield* orgMetadataCatalog.getChildren();
              const matchedCount = types.filter(
                entry =>
                  entry.kind === 'type' &&
                  entry.reference.type &&
                  matchesPattern(entry.reference.type, typeFilter, typeIsRegex)
              ).length;
              if (matchedCount <= MAX_TYPES_FOR_COMPONENT_PREFETCH) return false;
              return yield* Effect.promise(
                async () =>
                  (await vscode.window.showInformationMessage(
                    nls.localize('filter_fetch_confirmation', matchedCount.toString()),
                    nls.localize('yes_button'),
                    nls.localize('no_button')
                  )) === nls.localize('yes_button')
              );
            })
          : false;

      treeProvider.setTextFilter(typeFilter, componentFilter, typeIsRegex, componentIsRegex, userApprovedBroadFetch);
      yield* Effect.all(
        [
          Effect.promise(() => context.workspaceState.update('orgBrowser.typeFilter', typeFilter)),
          Effect.promise(() => context.workspaceState.update('orgBrowser.componentFilter', componentFilter)),
          Effect.promise(() => context.workspaceState.update('orgBrowser.typeIsRegex', typeIsRegex)),
          Effect.promise(() => context.workspaceState.update('orgBrowser.componentIsRegex', componentIsRegex)),
          updateFilterContext(isNotUndefined(typeFilter) || isNotUndefined(componentFilter))
        ],
        { concurrency: 'unbounded' }
      );
      picker.dispose();
      yield* Deferred.succeed(deferred, undefined);
    });

  picker.onDidChangeValue(value => run(Queue.offer(queue, value)));
  picker.onDidAccept(() => {
    accepted = true;
    run(commit(picker.value));
  });
  picker.onDidHide(() =>
    run(
      Effect.gen(function* () {
        if (!accepted) {
          treeProvider.setTextFilter(
            previousTypeFilter,
            previousComponentFilter,
            previousTypeIsRegex,
            previousComponentIsRegex
          );
          yield* updateFilterContext(isNotUndefined(previousTypeFilter) || isNotUndefined(previousComponentFilter));
        }
        picker.dispose();
        yield* Deferred.succeed(deferred, undefined);
      })
    )
  );

  yield* Stream.fromQueue(queue).pipe(
    Stream.debounce(Duration.millis(150)),
    Stream.runForEach(value =>
      Effect.gen(function* () {
        const { typeFilter, componentFilter, typeIsRegex, componentIsRegex } = parseFilterValue(value);
        treeProvider.setTextFilter(typeFilter, componentFilter, typeIsRegex, componentIsRegex);
        yield* updateFilterContext(isNotUndefined(typeFilter) || isNotUndefined(componentFilter));
      })
    ),
    Effect.fork
  );

  picker.show();
  yield* Deferred.await(deferred);
});
