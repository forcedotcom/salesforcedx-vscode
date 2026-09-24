/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core/global';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { join } from 'node:path';
import { AliasService } from './alias';
import { getDefaultOrgRef } from './defaultOrgRef';
import { HostFileWatcher } from './hostFileWatcher';

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

/** Watches `~/.sfdx/alias.json` via HostFileWatcher. */
export const watchAliasFile = Effect.fn('watchAliasFile')(function* () {
  const aliasFilePath = join(Global.SFDX_DIR, 'alias.json');
  const [hostFileWatcher, aliasService, ref] = yield* Effect.all([HostFileWatcher, AliasService, getDefaultOrgRef()], {
    concurrency: 'unbounded'
  });

  yield* hostFileWatcher.watch(aliasFilePath).pipe(
    Stream.debounce(Duration.millis(50)),
    Stream.mapEffect(() => SubscriptionRef.get(ref)),
    Stream.map(r => r.username),
    Stream.filter(isString),
    Stream.mapEffect(aliasService.getAliasesFromUsername),
    Stream.runForEach(freshAliases =>
      SubscriptionRef.update(ref, existing => ({
        ...existing,
        aliases: mergeAliases(existing.aliases, freshAliases)
      }))
    )
  );
});
