/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { URI, Utils } from 'vscode-uri';
import { getDefaultOrgInfo } from '../coreExtensionUtils';
import { getApexTestingRuntime } from '../services/extensionProvider';

const STATE_FOLDER = '.sfdx';
const TOOLS = 'tools';
const TEST_RESULTS = 'testresults';
const TEST_TYPE = 'apex';

/** Gets the org-scoped apex test results folder URI and creates it if it doesn't exist. */
export const getTestResultsFolder = async (): Promise<URI> => {
  const { orgId } = await getDefaultOrgInfo();
  if (!orgId) {
    throw new Error('No default org; cannot resolve apex test results folder.');
  }
  return getTestResultsFolderForOrg(orgId);
};

/** Gets the apex test results folder URI for a specific org and creates it if it doesn't exist. */
const getTestResultsFolderForOrg = async (orgKey: string): Promise<URI> =>
  getApexTestingRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const workspaceService = yield* api.services.WorkspaceService;
      const workspace = yield* workspaceService.getWorkspaceInfoOrThrow();
      const folderUri = Utils.joinPath(workspace.uri, STATE_FOLDER, TOOLS, TEST_RESULTS, TEST_TYPE, orgKey);
      yield* api.services.FsService.createDirectory(folderUri).pipe(
        Effect.tapError(error => Effect.logError(error)),
        Effect.catchAll(() => Effect.void)
      );
      return folderUri;
    })
  );
