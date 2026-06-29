/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { Utils } from 'vscode-uri';

const STATE_FOLDER = '.sfdx';
const TOOLS = 'tools';
const TEST_RESULTS = 'testresults';
const TEST_TYPE = 'apex';

/** No default org set, so the org-scoped test results folder can't be resolved. */
/** @ExportTaggedError */
export class NoDefaultOrgError extends Schema.TaggedError<NoDefaultOrgError>()('NoDefaultOrgError', {
  message: Schema.String
}) {}

/**
 * Gets the org-scoped apex test results folder URI, creating it if it doesn't exist.
 * Effect-native: provides its own NoDefaultOrgError / NoWorkspaceOpenError instead of wrapping in tryPromise.
 */
export const getTestResultsFolder = Effect.fn('pathHelpers.getTestResultsFolder')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { orgId } = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  if (!orgId) {
    return yield* new NoDefaultOrgError({ message: 'No default org; cannot resolve apex test results folder.' });
  }
  const workspace = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const folderUri = Utils.joinPath(workspace.uri, STATE_FOLDER, TOOLS, TEST_RESULTS, TEST_TYPE, orgId);
  yield* api.services.FsService.createDirectory(folderUri).pipe(
    Effect.tapError(error => Effect.logError(error)),
    Effect.catchAll(() => Effect.void)
  );
  return folderUri;
});
