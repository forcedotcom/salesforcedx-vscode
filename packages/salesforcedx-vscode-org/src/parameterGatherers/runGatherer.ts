/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CancelResponse, ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import type { UserCancellationError } from 'salesforcedx-vscode-services';
import { getOrgRuntime, OrgRuntimeContext } from '../extensionProvider';

/**
 * Run a gatherer Effect through the org runtime, mapping success to `ContinueResponse<T>` and any
 * `UserCancellationError` to `CancelResponse`. Other errors reject the returned promise (matching the
 * pre-refactor behavior where only the cancellation tag was caught). Collapses the CONTINUE/CANCEL
 * plumbing every `ParametersGatherer` would otherwise repeat.
 */
export const runGatherer = <T, E>(
  effect: Effect.Effect<T, E | UserCancellationError, OrgRuntimeContext>
): Promise<CancelResponse | ContinueResponse<T>> =>
  getOrgRuntime().runPromise(
    effect.pipe(
      Effect.map((data): ContinueResponse<T> => ({ type: 'CONTINUE', data })),
      Effect.catchTag('UserCancellationError', (): Effect.Effect<CancelResponse> => Effect.succeed({ type: 'CANCEL' }))
    )
  );
