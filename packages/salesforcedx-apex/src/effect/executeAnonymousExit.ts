/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import { ApexCompileError, ApexOperationError, ApexResponseDecodeError, ApexRuntimeError } from './errors.js';
import { executeAnonymous, type ExecuteAnonymousOptions, type ExecuteAnonymousOutcome } from './executeAnonymous.js';

const ApexFailure = Schema.Union([ApexCompileError, ApexRuntimeError, ApexOperationError, ApexResponseDecodeError]);

type AnonymousReason =
  | { readonly _tag: 'Fail'; readonly error: typeof ApexFailure.Encoded }
  | { readonly _tag: 'Die'; readonly defect: unknown }
  | { readonly _tag: 'Interrupt'; readonly fiberId: number | undefined };

/** @internal Migration-only data protocol. Remove with the services V4 migration (W-24615069). */
export type AnonymousExit =
  | { readonly _tag: 'Success'; readonly value: ExecuteAnonymousOutcome }
  | { readonly _tag: 'Failure'; readonly reasons: readonly AnonymousReason[] };

const encodeFailure = (error: typeof ApexFailure.Type): AnonymousReason => {
  try {
    return { _tag: 'Fail', error: Schema.encodeSync(ApexFailure)(error) };
  } catch (defect) {
    return { _tag: 'Die', defect };
  }
};

/** @internal Copy every reason into fresh records; retain opaque defects, never runnable typed errors. */
export const encodeAnonymousExit = (
  exit: Exit.Exit<ExecuteAnonymousOutcome, typeof ApexFailure.Type>
): AnonymousExit =>
  Exit.isSuccess(exit)
    ? { _tag: 'Success', value: { ...exit.value } }
    : {
        _tag: 'Failure',
        reasons: exit.cause.reasons.map((reason): AnonymousReason => {
          switch (reason._tag) {
            case 'Fail':
              return encodeFailure(reason.error);
            case 'Die':
              return { _tag: 'Die', defect: reason.defect };
            case 'Interrupt':
              return { _tag: 'Interrupt', fiberId: reason.fiberId };
          }
        })
      };

/** @internal Promise/AbortSignal boundary for the temporarily V3 ExecuteAnonymousService. */
export const executeAnonymousExit = (
  connection: Connection,
  options: ExecuteAnonymousOptions,
  signal: AbortSignal
): Promise<AnonymousExit> =>
  signal.aborted
    ? Promise.resolve({ _tag: 'Failure', reasons: [{ _tag: 'Interrupt', fiberId: undefined }] })
    : Effect.runPromiseExit(executeAnonymous(connection, options), { signal }).then(encodeAnonymousExit);
