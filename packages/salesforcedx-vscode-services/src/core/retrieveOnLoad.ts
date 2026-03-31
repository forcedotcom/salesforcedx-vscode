/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileResponse, type MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { ChannelService } from '../vscode/channelService';
import { FsService } from '../vscode/fsService';
import { SettingsService } from '../vscode/settingsService';
import { ComponentSetService } from './componentSetService';
import { MetadataRegistryService } from './metadataRegistryService';
import { MetadataRetrieveService } from './metadataRetrieveService';
import { fileResponseHasPath } from './sdrGuards';

export const filterFileResponses = Effect.fn('filterFileResponses')(function* (
  fileResponses: FileResponse[],
  members: MetadataMember[]
) {
  const { isSDRSuccess } = yield* ComponentSetService;
  const allowedSuffixes = yield* getAllowedSuffixes(members);
  return fileResponses
    .filter(isSDRSuccess)
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
    .filter(isNotUndefined);

/** Get unique file suffixes for metadata types */
const getAllowedSuffixes = Effect.fn('getAllowedSuffixes')(function* (members: MetadataMember[]) {
  const registry = yield* MetadataRegistryService.getRegistryAccess();

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
export const retrieveOnLoadEffect = () =>
  Effect.gen(function* () {
    const retrieveOnLoadValue = yield* SettingsService.getRetrieveOnLoad();

    if (retrieveOnLoadValue.length === 0) {
      return;
    }

    const members = parseRetrieveOnLoad(retrieveOnLoadValue);
    const channelService = yield* ChannelService;

    if (members.length === 0) {
      return yield* channelService.appendToChannel('No valid metadata members found in retrieveOnLoad setting');
    }

    yield* channelService.appendToChannel(
      `Retrieving metadata on load: ${members.map(m => `${m.type}:${m.fullName}`).join(', ')}`
    );

    const result = yield* MetadataRetrieveService.retrieve(members, { ignoreConflicts: true });

    if (typeof result === 'string') {
      return yield* channelService.appendToChannel(`Retrieve canceled: ${result}`);
    }

    const fileResponses = yield* filterFileResponses(result.getFileResponses(), members);

    yield* channelService.appendToChannel(
      `Retrieve on load completed. ${fileResponses.length} files retrieved successfully.`
    );

    const fsService = yield* FsService;
    yield* Effect.forEach(fileResponses, filePath => fsService.showTextDocument(filePath, { preview: false }), {
      concurrency: 'unbounded'
    });
  }).pipe(
    Effect.withSpan('retrieveOnLoadEffect'),
    Effect.catchAll(error =>
      Effect.gen(function* () {
        const errorMessage = nls.localize('retrieve_on_load_failed', String(error));
        yield* (yield* ChannelService).appendToChannel(errorMessage);
        yield* Effect.sync(() => {
          void vscode.window.showErrorMessage(errorMessage);
        });
      })
    )
  );
