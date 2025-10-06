/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataMember, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { AllServicesLayer, ExtensionProviderService } from './extensionProvider';

export type OrgBrowserRetrieveService = {
  /**
   * Retrieve metadata components and optionally open them in the editor
   * @param members - Array of MetadataMember to retrieve
   * @param openInEditor - Whether to open retrieved files in the editor
   * @returns Effect that resolves to the retrieve result
   */
  readonly retrieve: (
    members: MetadataMember[],
    openInEditor?: boolean
  ) => Effect.Effect<RetrieveResult, Error, ExtensionProviderService>;
};

export const OrgBrowserRetrieveService = Context.GenericTag<OrgBrowserRetrieveService>('OrgBrowserRetrieveService');

const retrieve = (
  members: MetadataMember[],
  openInEditor = false
): Effect.Effect<RetrieveResult, Error, ExtensionProviderService> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const [retrieveService, channel] = yield* Effect.all(
      [api.services.MetadataRetrieveService, api.services.ChannelService],
      { concurrency: 'unbounded' }
    );

    const result = yield* retrieveService.retrieve(members);

    const fileResponses = result.getFileResponses();
    const fileCount = fileResponses?.length ?? 0;
    yield* channel.appendToChannel(`Retrieve completed. ${fileCount} files retrieved successfully.`);
    if (fileCount > 0) {
      yield* channel.appendToChannel(`Retrieved files: ${fileResponses!.map(f => `  - ${f.filePath}`).join('\n')}`);
    } else {
      return yield* Effect.fail(new Error('No files retrieved'));
    }

    if (openInEditor) {
      yield* Option.match(findFirstSuccessfulFile(result), {
        onNone: () => Effect.succeed(undefined),
        onSome: filePath =>
          openFileInEditor(filePath).pipe(Effect.catchAll(e => Effect.log(`Could not open file: ${String(e)}`)))
      });
    }

    return result;
  }).pipe(
    Effect.provide(AllServicesLayer),
    Effect.mapError(e => new Error(`Retrieve failed: ${String(e)}`))
  );

const findFirstSuccessfulFile = (result: RetrieveResult): Option.Option<string> =>
  // for unknown reasons, the filePath is sometimes prefixed with a backslash
  Option.fromNullable(result.getFileResponses()?.[0]?.filePath?.replace(/^\\/, '\/'));

const openFileInEditor = (filePath: string): Effect.Effect<void, Error> =>
  Effect.tryPromise({
    try: () =>
      vscode.workspace.openTextDocument(
        URI.from({
          scheme: vscode.workspace.workspaceFolders?.[0]?.uri.scheme ?? 'file',
          path: filePath
        })
      ),
    catch: e => new Error(`Failed to open document at ${filePath}: ${String(e)}`)
  }).pipe(
    Effect.flatMap(document =>
      Effect.tryPromise({
        try: () => vscode.window.showTextDocument(document),
        catch: e => new Error(`Failed to show document at ${filePath}: ${String(e)}`)
      })
    ),
    Effect.map((): void => undefined),
    Effect.withSpan('openFileInEditor', { attributes: { filePath } })
  );

export const OrgBrowserRetrieveServiceLive = Layer.effect(OrgBrowserRetrieveService, Effect.succeed({ retrieve }));
