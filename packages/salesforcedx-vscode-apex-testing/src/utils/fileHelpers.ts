/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { QuickPickItem } from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { APEX_CLASS_EXT, IS_TEST_REG_EXP } from '../constants';
import { AllServicesLayer } from '../services/extensionProvider';

export type TestType = 'All' | 'AllLocal' | 'Suite' | 'Class';

export type ApexTestQuickPickItem = QuickPickItem & {
  type: TestType;
};

type QuickPickItemWithDescription = ApexTestQuickPickItem & Required<Pick<ApexTestQuickPickItem, 'description'>>;

/** Remove the extension from a filename */
const removeExtension = (filename: string, ext: string): string =>
  filename.endsWith(ext) ? filename.slice(0, -ext.length) : filename;

/**
 * Path string for FsService.readFile so toUri() resolves correctly.
 * On web we must pass uri.path (e.g. /MyProject/...) so toUri() produces memfs:/MyProject/...;
 * uriToPath would use fsPath which can be wrong for memfs. On desktop, uriToPath is correct.
 */
const getPathForRead = (uri: URI, uriToPathResult: string): string =>
  process.env.ESBUILD_PLATFORM === 'web' ? uri.path : uriToPathResult;

/** Read the file and return a quickPick Item. Will return undefined if the file has no tests (based on the @isTest annotation). */
export const getTestInfo = async (sourceUri: URI): Promise<QuickPickItemWithDescription | undefined> => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const pathForDisplay = yield* api.services.FsService.uriToPath(sourceUri);
      const pathForRead = getPathForRead(sourceUri, pathForDisplay);
      const content = yield* api.services.FsService.readFile(pathForRead);
      const hasTests = IS_TEST_REG_EXP.test(content);
      if (!hasTests) {
        return undefined;
      }
      return {
        label: removeExtension(Utils.basename(sourceUri), APEX_CLASS_EXT),
        description: pathForDisplay,
        type: 'Class' as const
      };
    }).pipe(Effect.provide(AllServicesLayer))
  );
  return result;
};
