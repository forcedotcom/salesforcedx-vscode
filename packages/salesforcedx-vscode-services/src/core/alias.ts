/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Global } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { join } from 'node:path';
import { FsService } from '../vscode/fsService';

/**
 * yeah, I know.  Totally violating the salesforce/core library.
 * But there's not a good way to bypass the StateAggregator cache without totally resetting it
 * it doesn't account for alias.json being changed outside of the running process and being stale.
 * I just want to read the alias file as is
 */

const AliasFileSchema = Schema.Struct({
  orgs: Schema.Record({ key: Schema.String, value: Schema.String })
});

export class AliasService extends Effect.Service<AliasService>()('AliasService', {
  accessors: true,
  dependencies: [FsService.Default],
  effect: Effect.gen(function* () {
    const fsService = yield* FsService;

    const readAliasFile = Effect.fn('AliasService.readAliasFile')(function* () {
      const aliasPath = join(Global.SFDX_DIR, 'alias.json');
      return yield* fsService.readJSON(aliasPath, AliasFileSchema);
    });

    /** Get all aliases as Record<alias, username> */
    const getAllAliases = Effect.fn('AliasService.getAllAliases')(function* () {
      return yield* readAliasFile().pipe(Effect.map(a => a.orgs));
    });

    /** Get all aliases for a given username */
    const getAliasesFromUsername = Effect.fn('AliasService.getAliasesFromUsername')(function* (username: string) {
      return yield* readAliasFile().pipe(
        Effect.map(aliasContents => aliasContents.orgs),
        Effect.map(orgs =>
          Array.from(Object.entries(orgs))
            .filter(([, v]) => v === username)
            .map(([k]) => k)
        ),
        Effect.catchAll(() => Effect.succeed([]))
      );
    });

    /** Get the username for a given alias */
    const getUsernameFromAlias = Effect.fn('AliasService.getUsernameFromAlias')(function* (alias: string) {
      return yield* readAliasFile().pipe(
        Effect.map(aliasContents => Option.fromNullable(aliasContents.orgs[alias])),
        Effect.catchAll(() => Effect.succeed(Option.none()))
      );
    });

    return { getAllAliases, getAliasesFromUsername, getUsernameFromAlias };
  })
}) {}
