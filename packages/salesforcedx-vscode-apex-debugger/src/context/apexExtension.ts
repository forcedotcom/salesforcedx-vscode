/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CallableSchema, getExtensionExports } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';

const APEX_EXTENSION_ID = 'salesforce.salesforcedx-vscode-apex';

// Preserve the manager instance because getStatus reads its state through `this`.
const languageClientManagerSchema: Schema.Schema<Pick<ApexVSCodeApi['languageClientManager'], 'getStatus'>> =
  Schema.declare(
    Schema.is(Schema.Struct({ getStatus: CallableSchema<ApexVSCodeApi['languageClientManager']['getStatus']>() }), {
      exact: false
    })
  );

/** On the error channel of exported `getActiveApexExtension`. @ExportTaggedError */
export class ApexExtensionUnavailable extends Schema.TaggedError<ApexExtensionUnavailable>()(
  'ApexExtensionUnavailable',
  { message: Schema.String }
) {}

/** Get the active Apex extension's exports. */
export const getActiveApexExtension = Effect.fn('ApexDebugger.getActiveApexExtension')(() =>
  getExtensionExports({
    extId: APEX_EXTENSION_ID,
    schema: Schema.Struct({
      getLineBreakpointInfo: CallableSchema<ApexVSCodeApi['getLineBreakpointInfo']>(),
      getExceptionBreakpointInfo: CallableSchema<ApexVSCodeApi['getExceptionBreakpointInfo']>(),
      languageClientManager: languageClientManagerSchema
    })
  }).pipe(
    Effect.catchTags({
      ExtensionNotFoundError: () => Effect.fail(new ApexExtensionUnavailable({ message: 'Apex extension not found' })),
      ExtensionActivationError: ({ cause }) =>
        Effect.fail(new ApexExtensionUnavailable({ message: isError(cause) ? cause.message : String(cause) }))
    })
  )
);
