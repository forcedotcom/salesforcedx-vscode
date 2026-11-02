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
  extId: Schema.String,
  message: Schema.String
}) {}

/** On the error channel of `getExtensionExports`. @ExportTaggedError */
export class ExtensionActivationError extends Schema.TaggedError<ExtensionActivationError>()(
  'ExtensionActivationError',
  {
    extId: Schema.String,
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

const getRawExtensionExports = (extId: string) =>
  Effect.sync(() => vscode.extensions.getExtension<unknown>(extId)).pipe(
    Effect.filterOrFail(
      isNotUndefined,
      () => new ExtensionNotFoundError({ extId, message: `Extension '${extId}' is not installed` })
    ),
    Effect.flatMap(extension =>
      extension.isActive
        ? Effect.sync(() => extension.exports)
        : Effect.tryPromise({
            try: () => extension.activate(),
            catch: cause =>
              new ExtensionActivationError({
                extId,
                message: `Failed to activate extension '${extId}': ${isError(cause) ? cause.message : String(cause)}`,
                cause
              })
          })
    )
  );

const decodeExtensionExports = <S extends Schema.Schema.AnyNoContext>(schema: S, exports: unknown) =>
  Schema.decodeUnknown(Schema.asSchema(schema), { onExcessProperty: 'ignore' })(exports);

/**
 * Find an installed extension, activate it if needed, and decode its exports
 * using the consumer's schema. Only describe the exports you need: extra object
 * properties are accepted and omitted from the decoded result.
 *
 * Omit the schema to return unvalidated exports as `unknown`. Missing extensions
 * and activation failures carry the extension ID and a descriptive message;
 * schema mismatches retain Effect's original parse error and property path.
 *
 * `CallableSchema` checks callable exports while retaining their TypeScript
 * signatures. For stateful class instances, use an identity-preserving schema
 * such as `Schema.declare` so decoding does not copy methods away from their state.
 *
 * @example
 * const api = yield* getExtensionExports({
 *   extId: 'salesforce.salesforcedx-vscode-apex',
 *   schema: Schema.Struct({
 *     getLineBreakpointInfo: CallableSchema<ApexVSCodeApi['getLineBreakpointInfo']>()
 *   })
 * });
 *
 * const breakpoints = yield* Effect.promise(() => api.getLineBreakpointInfo());
 */
export const getExtensionExports = <S extends Schema.Schema.AnyNoContext = typeof Schema.Unknown>({
  extId,
  // With no schema, the default result is unknown; S is inferred from a supplied schema.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  schema = Schema.Unknown as unknown as S
}: {
  extId: string;
  schema?: S;
}) =>
  getRawExtensionExports(extId).pipe(
    Effect.flatMap(exports => decodeExtensionExports(schema, exports)),
    Effect.withSpan('getExtensionExports')
  );
