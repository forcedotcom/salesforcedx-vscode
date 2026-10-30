/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { executeAnonymousExit, type AnonymousExit } from '@salesforce/apex-node/execute-anonymous-compat';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as FiberId from 'effect/FiberId';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

// Temporary genuine V3 errors. W-24615069 removes this adapter and Apex's compat entry.
const OperationFields = {
  operation: Schema.NonEmptyTrimmedString,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
};
class ApexOperationError extends Schema.TaggedError<ApexOperationError>()('ApexOperationError', OperationFields) {}
class ApexResponseDecodeError extends Schema.TaggedError<ApexResponseDecodeError>()(
  'ApexResponseDecodeError',
  OperationFields
) {}
const ExecutionFields = {
  operation: Schema.NonEmptyTrimmedString,
  message: Schema.String,
  line: Schema.Number,
  column: Schema.Number,
  logBody: Schema.optional(Schema.String)
};
export class ApexCompileError extends Schema.TaggedError<ApexCompileError>()('ApexCompileError', {
  ...ExecutionFields,
  compileProblem: Schema.NullOr(Schema.String)
}) {}
export class ApexRuntimeError extends Schema.TaggedError<ApexRuntimeError>()('ApexRuntimeError', {
  ...ExecutionFields,
  exceptionMessage: Schema.NullOr(Schema.String),
  exceptionStackTrace: Schema.NullOr(Schema.String)
}) {}

type FailureReason = Extract<AnonymousExit, { _tag: 'Failure' }>['reasons'][number];
const ApexFailure = Schema.Union(ApexCompileError, ApexRuntimeError, ApexOperationError, ApexResponseDecodeError);
const decodeFailure = Schema.decodeUnknownSync(ApexFailure) satisfies (
  failure: Extract<FailureReason, { _tag: 'Fail' }>['error']
) => typeof ApexFailure.Type;
export type ExecuteAnonymousOutcome = Extract<AnonymousExit, { _tag: 'Success' }>['value'];

const failureCause = (data: unknown): Cause.Cause<typeof ApexFailure.Type> => {
  // eslint-disable-next-line functional/no-try-statements -- A decoding defect must not discard later foreign Cause reasons.
  try {
    return Cause.fail(decodeFailure(data));
  } catch (defect) {
    return Cause.die(defect);
  }
};
const anonymousCause = (reasons: Extract<AnonymousExit, { _tag: 'Failure' }>['reasons']) =>
  reasons.reduce<Cause.Cause<typeof ApexFailure.Type>>((cause, reason) => {
    switch (reason._tag) {
      case 'Fail':
        return Cause.sequential(cause, failureCause(reason.error));
      case 'Die':
        return Cause.sequential(cause, Cause.die(reason.defect));
      case 'Interrupt':
        return Cause.sequential(
          cause,
          Cause.interrupt(isUndefined(reason.fiberId) ? FiberId.none : FiberId.runtime(reason.fiberId, 0))
        );
    }
  }, Cause.empty);

const completeAnonymous = (run: () => Promise<AnonymousExit>): Promise<AnonymousExit> => {
  const die = (defect: unknown): AnonymousExit => ({ _tag: 'Failure', reasons: [{ _tag: 'Die', defect }] });
  // eslint-disable-next-line functional/no-try-statements -- Capture foreign synchronous throws before V3's tracer replaces defect identity.
  try {
    return run().catch(die);
  } catch (defect) {
    return Promise.resolve(die(defect));
  }
};

/** @internal Kept in this package to use its V3 version; remove in W-24615069. */
export const fromAnonymousPromise = (run: (signal: AbortSignal) => Promise<AnonymousExit>) =>
  Effect.uninterruptibleMask(restore =>
    Effect.sync(() => new AbortController()).pipe(
      Effect.flatMap(controller => {
        const completion = completeAnonymous(() => run(controller.signal));
        return restore(
          Effect.async<AnonymousExit>(resume => {
            completion.then(
              exit => resume(Effect.succeed(exit)),
              defect => resume(Effect.die(defect))
            );
            return Effect.sync(() => controller.abort());
          })
        ).pipe(
          Effect.exit,
          Effect.flatMap(waitExit => {
            if (Exit.isSuccess(waitExit)) {
              return waitExit.value._tag === 'Success'
                ? Effect.succeed(waitExit.value.value)
                : Effect.failCause(anonymousCause(waitExit.value.reasons));
            }
            if (!Cause.isInterrupted(waitExit.cause)) return Effect.failCause(waitExit.cause);
            return Effect.sync(() => controller.abort()).pipe(
              Effect.zipRight(Effect.promise(() => completion)),
              Effect.flatMap(hostExit =>
                Effect.failCause(
                  hostExit._tag === 'Failure'
                    ? Cause.sequential(waitExit.cause, anonymousCause(hostExit.reasons))
                    : waitExit.cause
                )
              )
            );
          })
        );
      })
    )
  );

/** The V3 caller aborts and awaits V4 completion; no foreign Effect or error instance crosses. */
export const executeAnonymous = (
  connection: Parameters<typeof executeAnonymousExit>[0],
  options: Parameters<typeof executeAnonymousExit>[1]
) => fromAnonymousPromise(signal => executeAnonymousExit(connection, options, signal));
