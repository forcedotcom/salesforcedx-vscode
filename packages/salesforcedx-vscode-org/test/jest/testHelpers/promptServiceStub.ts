/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
// Real tagged error so `new UserCancellationError({})` is yieldable in Effect and `Effect.catchTag` matches.
import { UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';

export { UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';

/** Stub of `PromptService.considerUndefinedAsCancellation`. Uses `isString` to match the production
 * predicate (promptService.ts) and avoid silent drift. */
export const considerUndefinedAsCancellation = <T>(value: T | undefined): Effect.Effect<T, UserCancellationError> =>
  value === undefined || (isString(value) && value.trim().length === 0)
    ? Effect.fail(new UserCancellationError())
    : Effect.succeed(value);

/** Stub of `PromptService.confirmOrThrow`: `confirm: true` resolves, `false` fails with cancellation. */
export const makeConfirmOrThrow =
  (confirm: boolean) =>
  (_params: { readonly message: string; readonly confirmLabel: string }): Effect.Effect<void, UserCancellationError> =>
    confirm ? Effect.void : Effect.fail(new UserCancellationError());
