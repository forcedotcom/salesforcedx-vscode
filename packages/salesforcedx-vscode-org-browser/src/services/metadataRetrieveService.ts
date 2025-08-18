/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataMember, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import { Context, Effect, Layer, Option, pipe } from 'effect';
import { WebSdkLayer } from 'salesforcedx-vscode-services/src/observability/spans';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ExtensionProviderService } from './extensionProvider';

export type MetadataRetrieveService = {
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

export const MetadataRetrieveService = Context.GenericTag<MetadataRetrieveService>('MetadataRetrieveService');

const retrieve = (
  members: MetadataMember[],
  openInEditor = false
): Effect.Effect<RetrieveResult, Error, ExtensionProviderService> =>
  pipe(
    Effect.flatMap(ExtensionProviderService, svc => svc.getServicesApi),
    Effect.flatMap(api => {
      const allLayers = Layer.mergeAll(
        api.services.MetadataRetrieveServiceLive,
        api.services.ConnectionServiceLive,
        api.services.ConfigServiceLive,
        api.services.WorkspaceServiceLive,
        api.services.ProjectServiceLive,
        api.services.ChannelServiceLayer('Salesforce Org Browser'),
        api.services.SettingsServiceLive,
        api.services.WebSdkLayer
      );

      return pipe(
        Effect.provide(
          pipe(
            Effect.flatMap(api.services.MetadataRetrieveService, svc => svc.retrieve(members)),
            Effect.tap(result => {
              const fileResponses = result.getFileResponses();
              const fileCount = fileResponses?.length || 0;
              return Effect.flatMap(api.services.ChannelService, channel =>
                pipe(
                  channel.appendToChannel(`Retrieve completed. ${fileCount} files retrieved successfully.`),
                  Effect.tap(() =>
                    fileCount > 0
                      ? channel.appendToChannel(`Retrieved files: ${fileResponses!.map(f => f.filePath).join(', ')}`)
                      : Effect.fail(new Error('No files retrieved'))
                  )
                )
              );
            })
          ),
          allLayers
        ),
        Effect.mapError(e => new Error(`Retrieve failed: ${String(e)}`)),
        Effect.tap(result =>
          openInEditor
            ? pipe(
                Effect.sync(() => findFirstSuccessfulFile(result)),
                Effect.flatMap(fileOption =>
                  Option.match(fileOption, {
                    onNone: () => Effect.succeed(undefined),
                    onSome: filePath => openFileInEditor(filePath)
                  })
                ),
                Effect.catchAll(e => Effect.sync(() => console.log(`Could not open file: ${String(e)}`)))
              )
            : Effect.succeed(undefined)
        )
      );
    })
  );

const findFirstSuccessfulFile = (result: RetrieveResult): Option.Option<string> =>
  Option.fromNullable(result.getFileResponses()?.[0]?.filePath);

const openFileInEditor = (filePath: string): Effect.Effect<void, Error, never> =>
  pipe(
    Effect.tryPromise({
      try: () =>
        vscode.workspace.openTextDocument(
          URI.from({
            scheme: vscode.workspace.workspaceFolders?.[0]?.uri.scheme ?? 'file',
            path: filePath
          })
        ),
      catch: e => new Error(`Failed to open document at ${filePath}: ${String(e)}`)
    }),
    Effect.flatMap(document =>
      Effect.tryPromise({
        try: () => vscode.window.showTextDocument(document),
        catch: e => new Error(`Failed to show document at ${filePath}: ${String(e)}`)
      })
    ),
    Effect.map(() => undefined),
    Effect.withSpan('openFileInEditor', { attributes: { filePath } }),
    Effect.provide(WebSdkLayer)
  );

export const MetadataRetrieveServiceLive = Layer.effect(MetadataRetrieveService, Effect.succeed({ retrieve }));
