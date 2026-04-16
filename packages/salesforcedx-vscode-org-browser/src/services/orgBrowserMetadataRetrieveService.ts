/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { MetadataMember, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

/** @ExportTaggedError See docs on TS4023 errors for more information about why this is needed*/
export class NoFilesRetrievedError extends Schema.TaggedError<NoFilesRetrievedError>()('NoFilesRetrievedError', {
  message: Schema.String
}) {}

const retrieve = Effect.fn('OrgBrowserRetrieveService.retrieve')(function* (
  members: MetadataMember[],
  openInEditor = false
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;

  const result = yield* api.services.MetadataRetrieveService.retrieve(members, { ignoreConflicts: true });
  if (typeof result === 'string') {
    return result;
  }
  const fileResponses = result.getFileResponses().filter(f => f.filePath);
  yield* channel.appendToChannel(`Retrieve completed. ${fileResponses.length} files retrieved successfully.`);
  if (fileResponses.length > 0) {
    yield* channel.appendToChannel(
      `${['Retrieved files: '].concat(fileResponses!.map(f => `  - ${f.filePath} : ${f.type}`)).join('\n')}`
    );
  } else {
    return yield* Effect.fail(new NoFilesRetrievedError({ message: 'No files retrieved' }));
  }

  if (openInEditor) {
    const fsService = yield* api.services.FsService;
    yield* Option.match(findFirstSuccessfulFile(result), {
      onNone: () => Effect.succeed(undefined),
      onSome: filePath =>
        fsService
          .showTextDocument(
            URI.from({ scheme: vscode.workspace.workspaceFolders?.[0]?.uri.scheme ?? 'file', path: filePath })
          )
          .pipe(Effect.catchAll(e => Effect.log(`Could not open file: ${String(e)}`)))
    });
  }

  return result;
});

const findFirstSuccessfulFile = (result: RetrieveResult): Option.Option<string> =>
  // for unknown reasons, the filePath is sometimes prefixed with a backslash
  Option.fromNullable(result.getFileResponses()?.[0]?.filePath?.replace(/^\\/, '/'));

export class OrgBrowserRetrieveService extends Effect.Service<OrgBrowserRetrieveService>()(
  'OrgBrowserRetrieveService',
  {
    accessors: true,
    succeed: {
      /**
       * Retrieve metadata components and optionally open them in the editor
       * @param members - Array of MetadataMember to retrieve
       * @param openInEditor - Whether to open retrieved files in the editor
       * @returns Effect that resolves to the retrieve result
       */
      retrieve
    }
  }
) {}
