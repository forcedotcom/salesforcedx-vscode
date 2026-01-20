/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { parse } from 'node:path';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';

const DEFAULT_MANIFEST = 'package.xml';

const appendExtension = (input: string): string => parse(input).name?.concat('.xml') ?? `${input}.xml`;

const promptForFileName = () =>
  Effect.promise(async () => {
    const inputOptions: vscode.InputBoxOptions = {
      placeHolder: nls.localize('manifest_input_save_placeholder'),
      prompt: nls.localize('manifest_input_save_prompt'),
      value: DEFAULT_MANIFEST
    };
    return await vscode.window.showInputBox(inputOptions);
  }).pipe(Effect.map(s => (s ? appendExtension(s) : undefined)));

const promptForOverwrite = (fileName: string) =>
  Effect.promise(() =>
    vscode.window.showWarningMessage(
      nls.localize('manifest_overwrite_confirmation', fileName),
      { modal: true },
      'Overwrite',
      'Cancel'
    )
  );

const generateManifestFromUris = (uris: Set<URI>) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const componentSetService = yield* api.services.ComponentSetService;
    const componentSet = yield* componentSetService.getComponentSetFromUris(uris);
    return yield* Effect.promise(() => componentSet.getPackageXml());
  });

const saveManifestFile = (workspacePath: URI, fileName: string, packageXML: string) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const fsService = yield* api.services.FsService;
    const channelService = yield* api.services.ChannelService;

    // Build manifest directory path
    const manifestFileUri = Utils.joinPath(workspacePath, 'manifest', fileName);

    const shouldWrite =
      // doesn't exist
      !(yield* fsService.fileOrFolderExists(manifestFileUri)) ||
      // exists and user wants to overwrite
      (yield* promptForOverwrite(fileName)) === 'Overwrite';

    if (!shouldWrite) {
      yield* channelService.appendToChannel('Manifest generation cancelled by user');
      return;
    }

    // Write the manifest file (FsService.writeFile automatically creates directories)
    yield* fsService.writeFile(manifestFileUri, packageXML);
    yield* channelService.appendToChannel(`Manifest file created: ${manifestFileUri.toString()}`);

    // Open the generated manifest file
    yield* Effect.promise(async () => {
      const doc = await vscode.workspace.openTextDocument(manifestFileUri);
      await vscode.window.showTextDocument(doc);
    });

    return manifestFileUri;
  });

const generateManifestEffect = Effect.fn('generateManifest')(function* (
  sourceUri: URI | undefined,
  uris: URI[] | undefined
) {
  yield* Effect.annotateCurrentSpan({ sourceUri, uris });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // Resolve source URI from parameter or active editor
  const resolvedSourceUri =
    sourceUri ??
    (yield* (yield* api.services.EditorService).getActiveEditorUri.pipe(
      Effect.catchTag('NoActiveEditorError', () =>
        Effect.promise(() =>
          vscode.window.showErrorMessage(nls.localize('generate_manifest_select_file_or_directory'))
        ).pipe(Effect.as(undefined))
      )
    ));

  if (!resolvedSourceUri) {
    return;
  }

  // Get workspace info for manifest directory
  const workspaceInfo = yield* (yield* api.services.WorkspaceService).getWorkspaceInfoOrThrow;

  // Resolve URIs
  const resolvedUris = new Set(uris?.length ? [resolvedSourceUri, ...uris] : [resolvedSourceUri]);

  // Prompt for filename and generate package XML in parallel so it's ready as soon as the user responds
  const [fileName, packageXML] = yield* Effect.all([promptForFileName(), generateManifestFromUris(resolvedUris)], {
    concurrency: 'unbounded'
  });

  // If user cancelled the input (pressed Escape), don't proceed
  if (fileName === undefined) {
    return;
  }

  // Save the manifest file
  yield* saveManifestFile(workspaceInfo.uri, fileName, packageXML);
});

/** Generate manifest from source paths */
export const generateManifest = async (sourceUri: URI | undefined, uris: URI[] | undefined): Promise<void> => {
  await Effect.runPromise(
    generateManifestEffect(sourceUri, uris).pipe(
      Effect.tapError(error => Effect.sync(() => console.error(JSON.stringify(error, null, 2)))),
      Effect.catchAll(error =>
        Effect.promise(() =>
          vscode.window.showErrorMessage(
            nls.localize('generate_manifest_failed', error instanceof Error ? error.message : JSON.stringify(error))
          )
        ).pipe(Effect.as(undefined))
      ),
      Effect.provide(AllServicesLayer)
    )
  );
};
