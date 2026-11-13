/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type FileResponse, type MetadataMember } from '@salesforce/source-deploy-retrieve';
import {
  ChannelService,
  FsService,
  SettingsService,
  ComponentSetService,
  MetadataRegistryService,
  MetadataRetrieveService,
  fileResponseHasPath
} from '@salesforce/vscode-services/v2';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import { isNotUndefined, isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';

// exclude apex meta-xml files
const isNotMatchingContentXmlFile = Effect.fn('isNotMatchingContentXmlFile')(function* (r: FileResponse) {
  const registry = yield* MetadataRegistryService.use(service => service.getRegistryAccess());
  return yield* Effect.succeed(
    isNotUndefined(r.filePath) &&
      !(
        registry.getTypeByName(r.type).strategies?.adapter === 'matchingContentFile' && r.filePath.endsWith('-meta.xml')
      )
  );
});

// just open the top-level object file
const isNotCustomObjectDecomposedChild = (r: FileResponse) =>
  r.type !== 'CustomObject' || Boolean(r.filePath?.endsWith('object-meta.xml'));

export const filterFileResponses = Effect.fn('filterFileResponses')(function* (fileResponses: FileResponse[]) {
  const { isSDRSuccess } = yield* ComponentSetService;

  const fsService = yield* FsService;

  const normalized = Stream.fromIterable(fileResponses).pipe(
    Stream.filter(isSDRSuccess),
    Stream.filter(fileResponseHasPath)
  );

  const filesToOpen = normalized.pipe(
    Stream.filter(r => r.type !== 'LightningComponentBundle'),
    Stream.filterEffect(isNotMatchingContentXmlFile),
    Stream.filter(isNotCustomObjectDecomposedChild),
    Stream.map(r => r.filePath),
    Stream.mapEffect(p => fsService.toUri(p))
  );

  const lwcFiles = normalized.pipe(
    Stream.filter(r => r.type === 'LightningComponentBundle'),
    Stream.map(r => r.filePath),
    Stream.mapEffect(fsService.toUri),
    // get ths js file which is always present and matches the component name
    Stream.filter(uri => `${Utils.basename(Utils.dirname(uri))}.js` === Utils.basename(uri))
  );

  return yield* Stream.merge(filesToOpen, lwcFiles).pipe(Stream.runCollect);
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

/** Effect to retrieve metadata on load based on setting */
export const retrieveOnLoadEffect = Effect.fn('retrieveOnLoadEffect')(
  function* () {
    const retrieveOnLoadValue = yield* SettingsService.use(service => service.getRetrieveOnLoad());

    if (retrieveOnLoadValue.length === 0) {
      return;
    }

    const members = parseRetrieveOnLoad(retrieveOnLoadValue);
    const channelService = yield* ChannelService;
    const componentSetService = yield* ComponentSetService;
    if (members.length === 0) {
      return yield* channelService.appendToChannel('No valid metadata members found in retrieveOnLoad setting');
    }

    yield* channelService.appendToChannel(
      `Retrieving metadata on load: ${members.map(m => `${m.type}:${m.fullName}`).join(', ')}`
    );

    const result = yield* MetadataRetrieveService.use(service => service.retrieve(members, { ignoreConflicts: true }));

    const filesToOpen = yield* filterFileResponses(result.getFileResponses().filter(componentSetService.isSDRSuccess));

    yield* channelService.appendToChannel(
      `Retrieve on load completed. ${filesToOpen.length} files retrieved successfully.`
    );

    const fsService = yield* FsService;
    yield* Effect.forEach(filesToOpen, uri => fsService.showTextDocument(uri, { preview: false }));
  },
  Effect.catchCause(
    Effect.fnUntraced(function* (cause) {
      const failure = cause.reasons.find(Cause.isFailReason);
      if (Cause.hasInterrupts(cause) || Cause.hasDies(cause) || !failure) return yield* Effect.failCause(cause);
      const errorMessage = nls.localize('retrieve_on_load_failed', String(failure.error));
      yield* (yield* ChannelService).appendToChannel(errorMessage);
      yield* Effect.sync(() => {
        void vscode.window.showErrorMessage(errorMessage);
      });
    })
  )
);
