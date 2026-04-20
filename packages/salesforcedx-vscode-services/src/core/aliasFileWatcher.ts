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
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { AliasService } from './alias';
import { getDefaultOrgRef } from './defaultOrgRef';

// --- INSTRUMENTATION: remove before shipping ---
// eslint-disable-next-line functional/no-let
let received = 0;
setInterval(() => {
  console.log(`[After Measurement] aliasFileWatcher: received ${received}`);
}, 10_000);
// --- END INSTRUMENTATION ---

const mergeAliases = (currentAliases: readonly string[] | undefined, freshAliases: string[]): string[] => {
  const primaryAlias = currentAliases?.[0];
  if (primaryAlias && freshAliases.includes(primaryAlias)) {
    return [primaryAlias, ...freshAliases.filter(a => a !== primaryAlias)];
  }
  return freshAliases;
};

export const watchAliasFile = Effect.fn('watchAliasFile')(function* () {
  const [aliasService, ref] = yield* Effect.all(
    [AliasService, getDefaultOrgRef()],
    { concurrency: 'unbounded' }
  );

  yield* Effect.acquireUseRelease(
    Effect.sync(() =>
      vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(URI.file(Global.SFDX_DIR), 'alias.json')
      )
    ),
    watcher =>
      Stream.async<void>(emit => {
        const fire = () => { received++; void emit.single(undefined); };
        watcher.onDidCreate(fire);
        watcher.onDidChange(fire);
        watcher.onDidDelete(fire);
        return Effect.sync(() => watcher.dispose());
      }).pipe(
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
      ),
    watcher => Effect.sync(() => watcher.dispose())
  );
});
