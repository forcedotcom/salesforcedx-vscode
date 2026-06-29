/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass } from '../testDiscovery/schemas';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { getFullClassName } from '../utils/toolingTestClassHelpers';
import {
  ApexTestingDiscoveryFsProviderLive,
  ApexTestingDiscoveryFsProviderTag
} from './apexTestDiscoveryFsProviderTag';
import {
  getApexTestingClassUri,
  getForeignOrgClassesDirUris,
  getOrgClassesDirUri,
  getOrgDiscoveryUri,
  getOrgsRootUri
} from './apexTestingDiscoveryFs';

const encoder = new TextEncoder();

/** @ExportTaggedError */
export class DiscoveryClearError extends Schema.TaggedError<DiscoveryClearError>()('DiscoveryClearError', {
  orgKey: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

// Deleting an absent entry walks a missing parent dir; the provider surfaces this as either FileNotFound
// (the target) or FileNotADirectory (an ancestor like /orgs). Both mean "nothing to clear".
const isAbsent = (error: unknown): boolean =>
  error instanceof vscode.FileSystemError && (error.code === 'FileNotFound' || error.code === 'FileNotADirectory');

/** Internal sentinel: the target entry is absent, so a delete is a no-op (recovered to Effect.void). */
class AbsentEntry extends Schema.TaggedError<AbsentEntry>()('AbsentEntry', {}) {}

export class ApexTestDiscoveryService extends Effect.Service<ApexTestDiscoveryService>()('ApexTestDiscoveryService', {
  accessors: true,
  dependencies: [ApexTestingDiscoveryFsProviderLive],
  effect: Effect.gen(function* () {
    const provider = yield* ApexTestingDiscoveryFsProviderTag;

    // Best-effort recursive delete. Absent target (FileNotFound/FileNotADirectory) is fine; any other
    // failure surfaces as a DiscoveryClearError tagged with the org it was clearing.
    const deleteDir = (uri: URI, orgKey: string) =>
      Effect.try({
        try: () => provider.deleteInternal(uri, { recursive: true }),
        catch: error =>
          isAbsent(error)
            ? new AbsentEntry()
            : new DiscoveryClearError({
                orgKey,
                message: `Failed to clear discovery classes for ${orgKey}`,
                cause: error
              })
      }).pipe(Effect.catchTag('AbsentEntry', () => Effect.void));

    // Clears only the org's discovered `classes/` subtree, leaving the org dir (and anything else another
    // feature may persist under it) intact.
    const clearOrg = Effect.fn('ApexTestDiscoveryService.clearOrg')(function* (orgKey: string) {
      yield* deleteDir(getOrgClassesDirUri(orgKey), orgKey);
    });

    // On a default-org change, drop every OTHER org's discovered classes so the in-memory VFS holds only
    // the current org's tree. Only touches `classes/` subtrees — never the org dirs themselves.
    const pruneForeignOrgClasses = Effect.fn('ApexTestDiscoveryService.pruneForeignOrgClasses')(function* (
      currentOrgKey: string
    ) {
      // The orgs root is absent until the first org is discovered; a failed/missing read just means
      // there is nothing to prune.
      const orgDirNames = yield* Effect.try(() => provider.readDirectory(getOrgsRootUri()).map(([name]) => name)).pipe(
        Effect.orElseSucceed(() => [])
      );

      yield* Effect.forEach(
        getForeignOrgClassesDirUris(currentOrgKey, orgDirNames),
        dir => deleteDir(dir, currentOrgKey),
        { discard: true }
      );
    });

    const saveDiscoveredClasses = Effect.fn('ApexTestDiscoveryService.saveDiscoveredClasses')(function* (
      orgKey: string,
      classes: readonly ToolingTestClass[],
      classBodiesByFullName: ReadonlyMap<string, string>
    ) {
      yield* clearOrg(orgKey);
      yield* Effect.sync(() => {
        provider.createDirectoryInternal(getOrgDiscoveryUri(orgKey));
        provider.createDirectoryInternal(getOrgClassesDirUri(orgKey));
        classes.map(getFullClassName).map(fullClassName => {
          const content =
            classBodiesByFullName.get(fullClassName) ??
            nls.localize('apex_discovery_vfs_class_body_placeholder', fullClassName);
          const classUri = getApexTestingClassUri(orgKey, fullClassName);
          provider.createDirectoryInternal(Utils.dirname(classUri));
          return provider.writeFileInternal(classUri, encoder.encode(content), { create: true, overwrite: true });
        });
      });
      yield* Effect.log('persisted discovered classes', { orgKey, count: classes.length });
    });

    return { saveDiscoveredClasses, clearOrg, pruneForeignOrgClasses };
  })
}) {}
