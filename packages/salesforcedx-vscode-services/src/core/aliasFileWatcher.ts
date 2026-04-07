/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core/global';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { join, normalize } from 'node:path';
import { FileWatcherService } from '../vscode/fileWatcherService';
import { AliasService } from './alias';
import { getDefaultOrgRef } from './defaultOrgRef';

export type AliasChangeEvent = { readonly type: 'changed' };

/** General-purpose broadcaster that signals when ~/.sfdx/alias.json changes on disk.
 * Has no knowledge of target-org or org context — consumers decide how to react. */
export class AliasFileWatcherService extends Effect.Service<AliasFileWatcherService>()('AliasFileWatcherService', {
  scoped: Effect.gen(function* () {
    const aliasFilePath = normalize(join(Global.SFDX_DIR, 'alias.json'));
    const pubsub = yield* PubSub.sliding<AliasChangeEvent>(100);
    const fileWatcherService = yield* FileWatcherService;

    yield* Stream.fromPubSub(fileWatcherService.pubsub).pipe(
      Stream.filter(event => normalize(event.uri.fsPath) === aliasFilePath),
      Stream.debounce(Duration.millis(50)),
      Stream.runForEach(() => PubSub.publish(pubsub, { type: 'changed' as const })),
      Effect.forkScoped
    );

    return { pubsub };
  })
}) {}

/**
 * Merges a fresh alias list from disk with the current aliases, preserving the primary alias
 * (aliases[0]) at position 0 so the VS Code status bar label stays stable.
 * If the primary alias was deleted externally, fall back to disk order.
 */
const mergeAliases = (currentAliases: readonly string[] | undefined, freshAliases: string[]): string[] => {
  const primaryAlias = currentAliases?.[0];
  if (primaryAlias && freshAliases.includes(primaryAlias)) {
    return [primaryAlias, ...freshAliases.filter(a => a !== primaryAlias)];
  }
  return freshAliases;
};

/** Subscribes to AliasFileWatcherService and refreshes defaultOrgRef.aliases when alias.json changes.
 * Preserves aliases[0] (the primary display alias) at position 0 for status bar stability. */
export const watchDefaultOrgAliases = () =>
  Effect.scoped(
    Effect.gen(function* () {
      const aliasWatcher = yield* AliasFileWatcherService;
      const aliasService = yield* AliasService;

      yield* Stream.fromPubSub(aliasWatcher.pubsub).pipe(
        Stream.runForEach(() =>
          Effect.gen(function* () {
            const ref = yield* getDefaultOrgRef();
            const current = yield* SubscriptionRef.get(ref);
            if (!current.username) return;

            // Array.from ensures a mutable string[] regardless of Effect inference on the empty-array fallback
            const freshAliases = Array.from(yield* aliasService.getAliasesFromUsername(current.username));
            yield* SubscriptionRef.update(ref, existing => ({
              ...existing,
              aliases: mergeAliases(existing.aliases, freshAliases)
            }));
          })
        )
      );
    })
  );
