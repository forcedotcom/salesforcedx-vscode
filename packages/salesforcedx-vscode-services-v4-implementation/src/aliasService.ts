/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Global, StateAggregator } from '@salesforce/core';
import { AliasService, FsService } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Rec from 'effect/Record';
import * as Schema from 'effect/Schema';
import { URI, Utils } from 'vscode-uri';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

const AliasFile = Schema.Struct({ orgs: Schema.Record(Schema.String, Schema.String) });

export const AliasServiceLayer = Layer.effect(
  AliasService,
  Effect.gen(function* () {
    const fs = yield* FsService;
    const operations = yield* ServiceOperations;
    // Read disk directly: StateAggregator does not notice external alias-file edits without a reset.
    const readAliasFile = Effect.fn('AliasService.readAliasFile')(() =>
      fs.readJSON(Utils.joinPath(URI.file(Global.SFDX_DIR), 'alias.json').fsPath, AliasFile)
    );
    return AliasService.of({
      getAllAliases: Effect.fn('AliasService.getAllAliases')(() =>
        operations.run(readAliasFile().pipe(Effect.map(value => value.orgs)))
      ),
      getAliasesFromUsername: Effect.fn('AliasService.getAliasesFromUsername')((username: string) =>
        operations.run(
          readAliasFile().pipe(
            Effect.map(value => Rec.keys(value.orgs).filter(alias => value.orgs[alias] === username)),
            Effect.catchTag('FsServiceError', () => Effect.succeed([]))
          )
        )
      ),
      getUsernameFromAlias: Effect.fn('AliasService.getUsernameFromAlias')((alias: string) =>
        operations.run(
          readAliasFile().pipe(
            Effect.map(value => Option.fromNullishOr(value.orgs[alias])),
            Effect.catchTag('FsServiceError', () => Effect.succeed(Option.none()))
          )
        )
      ),
      unsetAliases: Effect.fn('AliasService.unsetAliases')(function* (aliases: readonly string[]) {
        const state = yield* Effect.promise(() => StateAggregator.getInstance());
        yield* Effect.forEach(
          aliases,
          alias => Effect.tryPromise(() => state.aliases.unsetAndSave(alias)).pipe(Effect.ignore),
          { discard: true }
        );
      }, operations.run)
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
