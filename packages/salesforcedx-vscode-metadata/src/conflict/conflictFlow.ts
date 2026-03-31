/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from '../shared/diff/diffTypes';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { NonEmptyComponentSet } from 'salesforcedx-vscode-services';
import { nls } from '../messages';
import { getDetectConflictsForDeployAndRetrieve } from '../settings/deployOnSaveSettings';
import { detectConflictsFromTracking } from './conflictDetection';
import { detectConflictsFromTimestamps } from './conflictDetectionTimestamp';
import { ConflictsDetectedError } from './conflictErrors';
import { getConflictStateRef } from './conflictTreeProvider';
import { handleConflictsModal } from './conflictUi';
import { conflictTreeProvider, ensureConflictView } from './conflictView';

export type HandleConflictWithRetryOptions<A, E, R> = {
  retryOperation: Effect.Effect<A, E, R>;
  pairs: DiffFilePair[];
  operationType: 'deploy' | 'retrieve';
};

/** Unified conflict detection: tracking orgs use tracking; non-tracking use timestamps when setting enabled. Yields ConflictsDetectedError when conflicts are found. */
export const detectConflicts = Effect.fn('detectConflicts')(function* (
  componentSet: NonEmptyComponentSet,
  operationType: 'deploy' | 'retrieve'
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());

  const pairs =
    orgInfo.tracksSource === true
      ? yield* detectConflictsFromTracking(componentSet)
      : getDetectConflictsForDeployAndRetrieve()
        ? yield* detectConflictsFromTimestamps(componentSet, operationType)
        : [];

  if (pairs.length > 0) return yield* new ConflictsDetectedError({ pairs, componentSet, operationType });
});

/**
 * On conflict: show modal, if Override retry with retryEffect, else cancel.
 * Use for deploy/retrieve where retry with skipConflictCheck/ignoreConflicts is supported.
 */
export const handleConflictWithRetry = Effect.fn('handleConflictWithRetry')(function* <A, E, R>(
  options: HandleConflictWithRetryOptions<A, E, R>
) {
  yield* ensureConflictView();

  const result = yield* handleConflictsModal({
    pairs: options.pairs,
    mode: 'conflicts',
    stateRef: getConflictStateRef(),
    treeProviderFire: () => conflictTreeProvider.fireChange(),
    warningMessage:
      options.operationType === 'deploy'
        ? nls.localize('conflict_detect_conflicts_during_deploy')
        : nls.localize('conflict_detect_conflicts_during_retrieve'),
    viewConflictsText:
      options.operationType === 'deploy'
        ? nls.localize('conflict_detect_show_conflicts_deploy')
        : nls.localize('conflict_detect_show_conflicts_retrieve'),
    overrideText:
      options.operationType === 'deploy'
        ? nls.localize('conflict_detect_override_deploy')
        : nls.localize('conflict_detect_override_retrieve'),
    emptyLabel: nls.localize('conflict_detect_no_conflicts')
  });

  return result === 'continue' ? yield* options.retryOperation : yield* Effect.void;
});
