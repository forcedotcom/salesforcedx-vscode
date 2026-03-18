/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
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
  operationType: 'deploy' | 'retrieve';
  componentSet: ComponentSet;
};

/** Unified conflict detection: tracking orgs use tracking; non-tracking use timestamps when setting enabled. */
export const detectConflicts = Effect.fn('detectConflicts')(function* (
  componentSet: ComponentSet,
  operationType: 'deploy' | 'retrieve'
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());

  if (orgInfo.tracksSource === true) {
    return yield* detectConflictsFromTracking(componentSet);
  }
  return getDetectConflictsForDeployAndRetrieve()
    ? yield* detectConflictsFromTimestamps(componentSet, operationType)
    : [];
});

/**
 * On conflict: detect diffs, show modal, if Override retry with retryEffect, else cancel.
 * Use for deploy/retrieve where retry with skipConflictCheck/ignoreConflicts is supported.
 */
export const handleConflictWithRetry = Effect.fn('handleConflictWithRetry')(function* <A, E, R>(
  options: HandleConflictWithRetryOptions<A, E, R>
) {
  yield* ensureConflictView();
  const pairs = yield* detectConflicts(options.componentSet, options.operationType);
  if (pairs.length === 0) {
    return yield* new ConflictsDetectedError({
      message: nls.localize(
        options.operationType === 'deploy' ? 'deploy_source_conflicts_detected' : 'retrieve_source_conflicts_detected',
        'Could not load conflict details'
      )
    });
  }

  const result = yield* handleConflictsModal({
    pairs,
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

  return result === 'continue' ? yield* options.retryOperation : Effect.void;
});
