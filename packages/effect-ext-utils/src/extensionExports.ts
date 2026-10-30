/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { isError, isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';

/** On the error channel of `getExtensionExports`. @ExportTaggedError */
export class ExtensionNotFoundError extends Schema.TaggedError<ExtensionNotFoundError>()('ExtensionNotFoundError', {
  extensionId: Schema.String,
  message: Schema.String
}) {}

/** On the error channel of `getExtensionExports`. @ExportTaggedError */
export class ExtensionActivationError extends Schema.TaggedError<ExtensionActivationError>()(
  'ExtensionActivationError',
  {
    extensionId: Schema.String,
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

/** Get an extension's exports, activating it only when inactive. */
export const getExtensionExports = Effect.fn('getExtensionExports')(function* <T = unknown>(extensionId: string) {
  const extension = yield* Effect.sync(() => vscode.extensions.getExtension<T>(extensionId)).pipe(
    Effect.filterOrFail(
      isNotUndefined,
      () => new ExtensionNotFoundError({ extensionId, message: `Extension '${extensionId}' is not installed` })
    )
  );
  if (extension.isActive) {
    return extension.exports;
  }
  return yield* Effect.tryPromise({
    try: () => extension.activate(),
    catch: cause =>
      new ExtensionActivationError({
        extensionId,
        message: `Failed to activate extension '${extensionId}': ${isError(cause) ? cause.message : String(cause)}`,
        cause
      })
  });
});
