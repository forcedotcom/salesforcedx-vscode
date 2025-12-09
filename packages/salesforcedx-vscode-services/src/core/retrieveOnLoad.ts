/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileResponse, type MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ChannelService } from '../vscode/channelService';
import { SettingsService } from '../vscode/settingsService';
import { WorkspaceService } from '../vscode/workspaceService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { MetadataRegistryService } from './metadataRegistryService';
import { MetadataRetrieveService } from './metadataRetrieveService';
import { ProjectService } from './projectService';
import { fileResponseHasPath, isFileResponseSuccess } from './sdrGuards';
import { SourceTrackingService } from './sourceTrackingService';

export const filterFileResponses = Effect.fn('filterFileResponses')(function* (
  fileResponses: FileResponse[],
  members: MetadataMember[]
) {
  const allowedSuffixes = yield* getAllowedSuffixes(members);
  return fileResponses
    .filter(isFileResponseSuccess)
    .filter(fileResponseHasPath)
    .map(fileResponse => fileResponse.filePath?.replaceAll('\\', '/'))
    .filter(filePath => allowedSuffixes.some(suffix => filePath.endsWith(suffix)));
});

/** Parse retrieve on load setting into MetadataMember array */
export const parseRetrieveOnLoad = (value: string): MetadataMember[] =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(isString)
    .map(item => {
      const parts = item.split(':');
      const type = parts[0]?.trim() ?? '';
      const fullName = parts[1]?.trim() ?? '';
      return parts.length === 2 && type.length > 0 && fullName.length > 0 ? { type, fullName } : undefined;
    })
    .filter((item): item is MetadataMember => item !== undefined);

/** Get unique file suffixes for metadata types */
const getAllowedSuffixes = Effect.fn('getAllowedSuffixes')(function* (members: MetadataMember[]) {
  const registry = yield* (yield* MetadataRegistryService).getRegistryAccess();

  const suffixes = Array.from(new Set(members.map(member => member.type)))
    .map(mdType => registry.getTypeByName(mdType))
    .map(metadataType =>
      metadataType.strategies?.adapter === 'matchingContentFile'
        ? metadataType.suffix // we want to open, for example, Foo.cls but not Foo-meta.xml
        : `${metadataType.suffix}-meta.xml`
    )
    .filter(isString);

  yield* Effect.annotateCurrentSpan({ suffixes });
  return suffixes;
});

/** Effect to retrieve metadata on load based on setting */
export const retrieveOnLoadEffect = (): Effect.Effect<
  void,
  Error,
  | SettingsService
  | MetadataRetrieveService
  | ChannelService
  | WorkspaceService
  | ConnectionService
  | ProjectService
  | ConfigService
  | MetadataRegistryService
  | SourceTrackingService
> =>
  Effect.gen(function* () {
    const [settingsService, channelService] = yield* Effect.all([SettingsService, ChannelService], {
      concurrency: 'unbounded'
    });

    const retrieveOnLoadValue = yield* settingsService.getRetrieveOnLoad;

    if (retrieveOnLoadValue.length === 0) {
      return;
    }

    const members = parseRetrieveOnLoad(retrieveOnLoadValue);

    if (members.length === 0) {
      return yield* channelService.appendToChannel('No valid metadata members found in retrieveOnLoad setting');
    }

    yield* channelService.appendToChannel(
      `Retrieving metadata on load: ${members.map(m => `${m.type}:${m.fullName}`).join(', ')}`
    );

    const result = yield* (yield* MetadataRetrieveService).retrieve(members);

    if (typeof result === 'string') {
      return yield* channelService.appendToChannel(`Retrieve canceled: ${result}`);
    }

    const fileResponses = yield* filterFileResponses(result.getFileResponses(), members);

    yield* channelService.appendToChannel(
      `Retrieve on load completed. ${fileResponses.length} files retrieved successfully.`
    );

    yield* Effect.forEach(
      fileResponses,
      filePath =>
        Effect.tryPromise({
          try: async () => {
            const document = await vscode.workspace.openTextDocument(
              URI.from({
                scheme: vscode.workspace.workspaceFolders?.[0]?.uri.scheme ?? 'file',
                path: filePath
              })
            );
            await vscode.window.showTextDocument(document, { preview: false });
          },
          catch: e => new Error(`Failed to open retrieved file ${filePath}: ${String(e)}`)
        }).pipe(Effect.catchAll(error => channelService.appendToChannel(`Could not open file: ${String(error)}`))),
      { concurrency: 'unbounded' }
    );
  }).pipe(
    Effect.withSpan('retrieveOnLoadEffect'),
    Effect.catchAll(error =>
      Effect.gen(function* () {
        const errorMessage = `Retrieve on load failed: ${String(error)}`;
        yield* (yield* ChannelService).appendToChannel(errorMessage);
        yield* Effect.sync(() => {
          void vscode.window.showErrorMessage(errorMessage);
        });
      })
    )
  );
