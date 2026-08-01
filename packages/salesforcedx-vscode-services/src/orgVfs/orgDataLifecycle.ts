/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import { URI, Utils } from 'vscode-uri';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { FsService } from '../vscode/fsService';
import { closeMatchingTabs } from '../vscode/tabs';
import { ORG_DATA_SCHEME, orgRoot } from './orgDataUris';

const LEGACY_APEX_TESTING_SCHEME = 'apex-testing';
const orgsRoot = URI.from({ scheme: ORG_DATA_SCHEME, path: '/orgs' });

const orgDirectoryName = (orgKey: string): string => Utils.basename(orgRoot(orgKey));

export const reconcileOrgDataLifecycle = Effect.fn('orgDataLifecycle.reconcile')(function* (
  orgId: string | undefined,
  isFirst: boolean,
  fsService: Context.Tag.Service<typeof FsService>
) {
  const currentOrgDirectory = isString(orgId) ? orgDirectoryName(orgId) : undefined;

  yield* closeMatchingTabs(uri => {
    if (uri.scheme === LEGACY_APEX_TESTING_SCHEME) return true;
    if (uri.scheme !== ORG_DATA_SCHEME) return false;
    if (isFirst || !currentOrgDirectory) return true;
    const [, root, orgDirectory] = uri.path.split('/');
    return root === 'orgs' && orgDirectory !== currentOrgDirectory;
  });

  const orgDirectories = yield* fsService.readDirectory(orgsRoot).pipe(Effect.orElseSucceed(() => []));
  yield* Effect.forEach(
    orgDirectories.filter(uri => !currentOrgDirectory || Utils.basename(uri) !== currentOrgDirectory),
    uri => fsService.deleteOrgData(uri, { recursive: true }).pipe(Effect.ignore),
    { discard: true }
  );
});

export const watchOrgDataLifecycle = Effect.fn('watchOrgDataLifecycle')(function* () {
  const targetOrgRef = yield* getDefaultOrgRef();
  const fsService = yield* FsService;
  const firstEmission = yield* Ref.make(true);

  yield* targetOrgRef.changes.pipe(
    Stream.runForEach(orgInfo =>
      Effect.gen(function* () {
        const isFirst = yield* Ref.getAndSet(firstEmission, false);
        yield* reconcileOrgDataLifecycle(orgInfo.orgId, isFirst, fsService);
      })
    )
  );
});
