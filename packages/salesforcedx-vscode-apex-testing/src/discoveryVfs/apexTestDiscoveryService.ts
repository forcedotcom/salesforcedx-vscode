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
import { Utils } from 'vscode-uri';
import { nls } from '../messages';
import { getFullClassName } from '../utils/testUtils';
import {
  ApexTestingDiscoveryFsProviderLive,
  ApexTestingDiscoveryFsProviderTag
} from './apexTestDiscoveryFsProviderTag';
import { getApexTestingClassUri, getOrgClassesDirUri, getOrgDiscoveryUri } from './apexTestingDiscoveryFs';

const encoder = new TextEncoder();

/** @ExportTaggedError */
export class DiscoveryClearError extends Schema.TaggedError<DiscoveryClearError>()('DiscoveryClearError', {
  orgKey: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

/** Org cache key resolution (pure). orgId preferred; username fallback; else a stable placeholder. */
export const resolveDiscoveryOrgKey = (orgInfo: { orgId?: string; username?: string }): string =>
  orgInfo.orgId ?? orgInfo.username ?? 'unknown-org';

// Deleting a never-discovered org walks a missing parent dir; the provider surfaces this as either
// FileNotFound (the org dir) or FileNotADirectory (an ancestor like /orgs). Both mean "nothing to clear".
const isAbsent = (error: unknown): boolean =>
  error instanceof vscode.FileSystemError && (error.code === 'FileNotFound' || error.code === 'FileNotADirectory');

/** Internal sentinel: the org dir is absent, so a clear is a no-op (recovered to Effect.void). */
class IndexNotFound extends Schema.TaggedError<IndexNotFound>()('IndexNotFound', {}) {}

export class ApexTestDiscoveryService extends Effect.Service<ApexTestDiscoveryService>()('ApexTestDiscoveryService', {
  accessors: true,
  dependencies: [ApexTestingDiscoveryFsProviderLive],
  effect: Effect.gen(function* () {
    const provider = yield* ApexTestingDiscoveryFsProviderTag;

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
        classes.map(cls => {
          const fullClassName = getFullClassName(cls);
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

    return { saveDiscoveredClasses, clearOrg };
  })
}) {}
