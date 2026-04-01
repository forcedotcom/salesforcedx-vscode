/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileResponse, type MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
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
  const registry = yield* MetadataRegistryService.getRegistryAccess();
  const allowedSuffixes = yield* getAllowedSuffixes(members);

  const bundleTypes = new Set(
    members
      .map(m => registry.getTypeByName(m.type))
      .filter(t => t.strategies?.adapter === 'bundle')
      .map(t => t.name)
  );

  const fsService = yield* FsService;

  const normalized = Stream.fromIterable(fileResponses).pipe(
    Stream.filter(isSDRSuccess),
    Stream.filter(fileResponseHasPath)
  );

  const filesToOpen = yield* normalized.pipe(
    Stream.filter(r => !bundleTypes.has(r.type)),
    Stream.map(r => r.filePath),
    Stream.filter(p => allowedSuffixes.some(suffix => p.endsWith(suffix))),
    Stream.mapEffect(p => fsService.toUri(p)),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  );

  const foldersToReveal = yield* normalized.pipe(
    Stream.filter(r => bundleTypes.has(r.type)),
    Stream.mapEffect(r => fsService.toUri(r.filePath)),
    Stream.map(uri => Utils.dirname(uri)),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  );

  return { filesToOpen, foldersToReveal };
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

/** Get unique file suffixes for non-bundle metadata types */
const getAllowedSuffixes = Effect.fn('getAllowedSuffixes')(function* (members: MetadataMember[]) {
  const registry = yield* MetadataRegistryService.getRegistryAccess();

  const suffixes = Array.from(new Set(members.map(member => member.type)))
    .map(mdType => registry.getTypeByName(mdType))
    .filter(metadataType => metadataType.strategies?.adapter !== 'bundle')
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
export const retrieveOnLoadEffect = Effect.fn('retrieveOnLoadEffect')(
  function* () {
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

    const { filesToOpen, foldersToReveal } = yield* filterFileResponses(result.getFileResponses(), members);

    yield* channelService.appendToChannel(
      `Retrieve on load completed. ${filesToOpen.length} files retrieved, ${foldersToReveal.length} bundle folders revealed.`
    );

    const fsService = yield* FsService;
    yield* Effect.forEach(filesToOpen, uri => fsService.showTextDocument(uri, { preview: false }), {
      concurrency: 'unbounded'
    });
    yield* Effect.forEach(foldersToReveal, uri =>
      Effect.sync(() => {
        void vscode.commands.executeCommand('revealInExplorer', uri);
      })
    );
  },
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
