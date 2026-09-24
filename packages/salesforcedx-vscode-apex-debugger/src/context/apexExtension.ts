/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { isError, isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';

const APEX_EXTENSION_ID = 'salesforce.salesforcedx-vscode-apex';

/** On the error channel of exported `getActiveApexExtension`. @ExportTaggedError */
export class ApexExtensionUnavailable extends Schema.TaggedError<ApexExtensionUnavailable>()(
  'ApexExtensionUnavailable',
  { message: Schema.String }
) {}

/** Get the active Apex extension */
export const getActiveApexExtension = Effect.fn('ApexDebugger.getActiveApexExtension')(function* () {
  const extension = yield* Effect.sync(() => vscode.extensions.getExtension<ApexVSCodeApi>(APEX_EXTENSION_ID)).pipe(
    Effect.filterOrFail(isNotUndefined, () => new ApexExtensionUnavailable({ message: 'Apex extension not found' }))
  );
  if (!extension.isActive) {
    yield* Effect.tryPromise({
      try: () => extension.activate(),
      catch: cause => new ApexExtensionUnavailable({ message: isError(cause) ? cause.message : String(cause) })
    });
  }
  return extension;
});
