/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { parse } from 'node:path';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';

const DEFAULT_MANIFEST = 'package.xml';

const appendExtension = (input: string): string => parse(input).name?.concat('.xml') ?? `${input}.xml`;

const promptForFileName = Effect.fn('promptForFileName')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const inputOptions: vscode.InputBoxOptions = {
    placeHolder: nls.localize('manifest_input_save_placeholder'),
    prompt: nls.localize('manifest_input_save_prompt'),
    value: DEFAULT_MANIFEST
  };
  return yield* Effect.promise(() => vscode.window.showInputBox(inputOptions)).pipe(
    Effect.map(s => (s ? appendExtension(s) : undefined)),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});

const generateManifestFromUris = (uris: URI[]) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const componentSetService = yield* api.services.ComponentSetService;
    const componentSet = yield* componentSetService.getComponentSetFromUris(Array.from(uris));
    return yield* Effect.promise(() => componentSet.getPackageXml());
  });

const saveManifestFile = (workspacePath: URI, fileName: string, packageXML: string) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;
    const fsService = yield* api.services.FsService;
    const promptService = yield* api.services.PromptService;
    // Build manifest directory path
    const manifestFileUri = Utils.joinPath(workspacePath, 'manifest', fileName);

    yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [manifestFileUri] });

    yield* api.services.FsService.safeWriteFile(manifestFileUri, packageXML);
    yield* channelService.appendToChannel(`Manifest file created: ${manifestFileUri.toString()}`);

    yield* fsService.showTextDocument(manifestFileUri);

    return manifestFileUri;
  });

export const generateManifestCommand = Effect.fn('generateManifest')(function* (
  sourceUri: URI | undefined,
  uris: URI[] | undefined
) {
  yield* Effect.annotateCurrentSpan({ sourceUri, uris });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // Resolve source URI from parameter or active editor
  const resolvedSourceUri =
    sourceUri ??
    (yield* api.services.EditorService.getActiveEditorUri().pipe(
      Effect.catchTag('NoActiveEditorError', () =>
        Effect.sync(() => {
          void vscode.window.showErrorMessage(nls.localize('generate_manifest_select_file_or_directory'));
        }).pipe(Effect.as(undefined))
      )
    ));

  if (!resolvedSourceUri) {
    return;
  }

  // Get workspace info for manifest directory
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  // Resolve URIs
  const resolvedUris = uris?.length ? [resolvedSourceUri, ...uris] : [resolvedSourceUri];

  // Prompt for filename and generate package XML in parallel so it's ready as soon as the user responds
  const [fileName, packageXML] = yield* Effect.all([promptForFileName(), generateManifestFromUris(resolvedUris)], {
    concurrency: 'unbounded'
  });

  // Save the manifest file
  yield* saveManifestFile(workspaceInfo.uri, fileName, packageXML);
});
