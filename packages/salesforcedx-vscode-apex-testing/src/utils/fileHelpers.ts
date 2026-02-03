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

/** Reads a file using FsService (works in both desktop and web modes) */
export const readFile = (filePath: string): Promise<string> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const fsService = yield* api.services.FsService;
      return yield* fsService.readFile(filePath);
    }).pipe(Effect.provide(AllServicesLayer))
  );

type QuickPickItemWithDescription = ApexTestQuickPickItem & Required<Pick<ApexTestQuickPickItem, 'description'>>;

/** Remove the extension from a filename */
const removeExtension = (filename: string, ext: string): string =>
  filename.endsWith(ext) ? filename.slice(0, -ext.length) : filename;

/** Read the file and return a quickPick Item. Will return undefined if the file has no tests (based on the @isTest annotation). */
export const getTestInfo = async (sourceUri: URI): Promise<QuickPickItemWithDescription | undefined> =>
  IS_TEST_REG_EXP.test(await readFile(sourceUri.fsPath))
    ? {
        label: removeExtension(Utils.basename(sourceUri), APEX_CLASS_EXT),
        description: sourceUri.fsPath,
        type: 'Class'
      }
    : undefined;
