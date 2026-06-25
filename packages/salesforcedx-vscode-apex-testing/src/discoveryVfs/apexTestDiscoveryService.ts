/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass } from '../testDiscovery/schemas';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';
import { getFullClassName } from '../utils/testUtils';
import {
  ApexTestingDiscoveryFsProviderLive,
  ApexTestingDiscoveryFsProviderTag
} from './apexTestDiscoveryFsProviderTag';
import {
  getApexTestingClassUri,
  getOrgClassesDirUri,
  getOrgDiscoveryUri,
  getOrgIndexUri
} from './apexTestingDiscoveryFs';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** Number of per-org index snapshots to keep cached at once (covers normal multi-org use). */
const INDEX_CACHE_CAPACITY = 20;
/** How long a successfully read index snapshot stays cached before re-reading the VFS. */
const INDEX_CACHE_TTL = Duration.minutes(5);

/** Crosses the JSON VFS boundary — keep in sync with the `ToolingTestClass` type. */
const ToolingTestMethodSchema = Schema.Struct({
  name: Schema.String,
  line: Schema.optional(Schema.Number),
  column: Schema.optional(Schema.Number)
});

const ToolingTestClassSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  namespacePrefix: Schema.String,
  testMethods: Schema.Array(ToolingTestMethodSchema)
});

/** Serialized index persisted to the discovery VFS. */
const DiscoveredApexClassesIndex = Schema.Struct({
  orgKey: Schema.String,
  classes: Schema.Array(ToolingTestClassSchema)
});
type DiscoveredApexClassesIndex = Schema.Schema.Type<typeof DiscoveredApexClassesIndex>;

export class DiscoveryReadError extends Schema.TaggedError<DiscoveryReadError>()('DiscoveryReadError', {
  orgKey: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

/** @ExportTaggedError */
export class DiscoveryClearError extends Schema.TaggedError<DiscoveryClearError>()('DiscoveryClearError', {
  orgKey: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

/** Org cache key resolution (pure). orgId preferred; username fallback; else a stable placeholder. */
export const resolveDiscoveryOrgKey = (orgInfo: { orgId?: string; username?: string }): string =>
  orgInfo.orgId ?? orgInfo.username ?? 'unknown-org';

const isFileNotFound = (error: unknown): boolean =>
  error instanceof vscode.FileSystemError && error.code === 'FileNotFound';

// Deleting a never-discovered org walks a missing parent dir; the provider surfaces this as either
// FileNotFound (the org dir) or FileNotADirectory (an ancestor like /orgs). Both mean "nothing to clear".
const isAbsent = (error: unknown): boolean =>
  error instanceof vscode.FileSystemError && (error.code === 'FileNotFound' || error.code === 'FileNotADirectory');

/** Internal sentinel: the org has no persisted index yet (expected, recovered to Option.none). */
class IndexNotFound extends Schema.TaggedError<IndexNotFound>()('IndexNotFound', {}) {}

export class ApexTestDiscoveryService extends Effect.Service<ApexTestDiscoveryService>()('ApexTestDiscoveryService', {
  accessors: true,
  dependencies: [ApexTestingDiscoveryFsProviderLive],
  effect: Effect.gen(function* () {
    const provider = yield* ApexTestingDiscoveryFsProviderTag;

    // Per-org index snapshot cache. FileNotFound (never-discovered org) resolves to Option.none and
    // is treated as a successful lookup; genuine read/decode failures surface as DiscoveryReadError.
    const indexCache = yield* Cache.makeWith({
      capacity: INDEX_CACHE_CAPACITY,
      timeToLive: Exit.match({
        onSuccess: () => INDEX_CACHE_TTL,
        onFailure: () => Duration.zero
      }),
      lookup: (orgKey: string): Effect.Effect<Option.Option<DiscoveredApexClassesIndex>, DiscoveryReadError> =>
        Effect.try({
          // Read raw bytes + JSON.parse. FileNotFound becomes IndexNotFound (recovered to none);
          // any other read/parse failure becomes a surfaced DiscoveryReadError.
          try: (): unknown => JSON.parse(decoder.decode(provider.readFile(getOrgIndexUri(orgKey)))),
          catch: error =>
            isFileNotFound(error)
              ? new IndexNotFound()
              : new DiscoveryReadError({
                  orgKey,
                  message: `Failed to read discovery index for ${orgKey}`,
                  cause: error
                })
        }).pipe(
          Effect.flatMap(parsed =>
            Schema.decodeUnknown(DiscoveredApexClassesIndex)(parsed).pipe(
              Effect.mapError(
                error =>
                  new DiscoveryReadError({
                    orgKey,
                    message: `Failed to decode discovery index for ${orgKey}`,
                    cause: error
                  })
              )
            )
          ),
          Effect.map(Option.some),
          // IndexNotFound = never discovered for this org; expected, recover to Option.none.
          Effect.catchTag('IndexNotFound', () => Effect.succeed(Option.none<DiscoveredApexClassesIndex>()))
        )
    });

    const clearOrg = Effect.fn('ApexTestDiscoveryService.clearOrg')(function* (orgKey: string) {
      yield* Effect.try({
        try: () => provider.deleteInternal(getOrgDiscoveryUri(orgKey), { recursive: true }),
        // Absent org becomes IndexNotFound (nothing to clear, recovered below); any other
        // delete failure becomes a surfaced DiscoveryClearError.
        catch: error =>
          isAbsent(error)
            ? new IndexNotFound()
            : new DiscoveryClearError({
                orgKey,
                message: `Failed to clear discovery state for ${orgKey}`,
                cause: error
              })
      }).pipe(
        // Nothing to clear (org never discovered) is fine.
        Effect.catchTag('IndexNotFound', () => Effect.void)
      );
      yield* indexCache.invalidate(orgKey);
    });

    const saveDiscoveredClasses = Effect.fn('ApexTestDiscoveryService.saveDiscoveredClasses')(function* (
      orgKey: string,
      classes: readonly ToolingTestClass[],
      classBodiesByFullName: ReadonlyMap<string, string>
    ) {
      const indexPayload: DiscoveredApexClassesIndex = {
        orgKey,
        classes
      };

      // clearOrg already invalidates the cache, so the next read reflects the new data.
      yield* clearOrg(orgKey);
      yield* Effect.sync(() => {
        provider.createDirectoryInternal(getOrgDiscoveryUri(orgKey));
        provider.createDirectoryInternal(getOrgClassesDirUri(orgKey));
        classes.map(cls => {
          const fullClassName = getFullClassName(cls);
          const content =
            classBodiesByFullName.get(fullClassName) ??
            nls.localize('apex_discovery_vfs_class_body_placeholder', fullClassName);
          const classUri = getApexTestingClassUri(orgKey, fullClassName);
          provider.createDirectoryInternal(Utils.dirname(classUri));
          return provider.writeFileInternal(classUri, encoder.encode(content), { create: true, overwrite: true });
        });
        // The index schema is a flat struct with no transforms, so JSON.stringify of the typed
        // payload is equivalent to encoding it first.
        provider.writeFileInternal(getOrgIndexUri(orgKey), encoder.encode(JSON.stringify(indexPayload, null, 2)), {
          create: true,
          overwrite: true
        });
      });
      yield* Effect.log('persisted discovered classes', { orgKey, count: classes.length });
    });

    const readDiscoveredClassesIndex = Effect.fn('ApexTestDiscoveryService.readDiscoveredClassesIndex')(function* (
      orgKey: string
    ) {
      return yield* indexCache.get(orgKey);
    });

    return { saveDiscoveredClasses, readDiscoveredClassesIndex, clearOrg };
  })
}) {}
