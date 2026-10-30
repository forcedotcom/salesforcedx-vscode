/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getExtensionExports } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';

const APEX_EXTENSION_ID = 'salesforce.salesforcedx-vscode-apex';

/** On the error channel of exported `getActiveApexExtension`. @ExportTaggedError */
export class ApexExtensionUnavailable extends Schema.TaggedError<ApexExtensionUnavailable>()(
  'ApexExtensionUnavailable',
  { message: Schema.String }
) {}

/** Get the active Apex extension's exports. */
export const getActiveApexExtension = Effect.fn('ApexDebugger.getActiveApexExtension')(() =>
  getExtensionExports<ApexVSCodeApi>(APEX_EXTENSION_ID).pipe(
    Effect.catchTags({
      ExtensionNotFoundError: () => Effect.fail(new ApexExtensionUnavailable({ message: 'Apex extension not found' })),
      ExtensionActivationError: ({ cause }) =>
        Effect.fail(new ApexExtensionUnavailable({ message: isError(cause) ? cause.message : String(cause) }))
    })
  )
);
