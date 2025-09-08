/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { MetadataRegistryService } from 'salesforcedx-vscode-services/src/core/metadataRegistryService';
import { MetadataRetrieveService } from 'salesforcedx-vscode-services/src/core/metadataRetrieveService';
import { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import * as vscode from 'vscode';
import { MetadataListResultItem } from './types';

const ignoredGlob = '**/.*';

export const fileIsPresent = (glob: string): Effect.Effect<boolean, Error> =>
  Effect.promise(() => vscode.workspace.findFiles(glob, ignoredGlob, 1))
    .pipe(
      Effect.tap(files => Effect.log(`files: ${files.map(f => f.fsPath).join(', ')}`)),
      Effect.map(files => files.length > 0)
    )
    .pipe(Effect.withSpan('fileIsPresent', { attributes: { glob } }));

export const getFileGlob =
  (xmlName: string) =>
  (
    c: MetadataListResultItem
  ): Effect.Effect<string[], Error, MetadataRetrieveService | MetadataRegistryService | WorkspaceService> =>
    Effect.gen(function* () {
      const reg = yield* (yield* MetadataRegistryService).getRegistryAccess();
      const type = reg.getTypeByName(xmlName);
      const basicPaths = yield* (yield* MetadataRetrieveService).getFilePath(type, c.fullName);
      yield* Effect.annotateCurrentSpan({ paths: basicPaths });
      return basicPaths.map(path => `**/${path}`);
    }).pipe(Effect.withSpan('getFileGlob', { attributes: { xmlName, fullName: c.fullName } }));
