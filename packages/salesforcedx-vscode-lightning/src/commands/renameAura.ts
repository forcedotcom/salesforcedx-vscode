/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  AURA_TYPE,
  bundleFilePattern,
  getBundleKind,
  getBundleUri,
  LWC_TYPE,
  normalizeComponentName,
  NotInBundleError,
  TEST_FOLDER
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { promptForAuraName } from './promptForAuraName';

export const renameAuraCommand = Effect.fn('renameAuraCommand')(function* (sourceUri?: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  const editorService = yield* api.services.EditorService;
  const promptService = yield* api.services.PromptService;
  const componentSetService = yield* api.services.ComponentSetService;
  const lightningComponentService = yield* api.services.LightningComponentService;

  const resolvedSource = yield* promptService.considerUndefinedAsCancellation(sourceUri);
  const bundleUri = yield* Option.match(getBundleUri(resolvedSource), {
    onNone: () =>
      Effect.fail(
        new NotInBundleError({
          sourceUri: resolvedSource.toString(),
          message: 'Source path is not within an aura bundle'
        })
      ),
    onSome: Effect.succeed
  });
  if (getBundleKind(bundleUri) !== 'aura') {
    return yield* new NotInBundleError({
      sourceUri: resolvedSource.toString(),
      message: 'Source path is not within an aura bundle'
    });
  }

  const oldName = Utils.basename(bundleUri);

  const projectSet = yield* componentSetService.getComponentSetFromProjectDirectories({
    metadataMembers: [
      { type: LWC_TYPE, fullName: '*' },
      { type: AURA_TYPE, fullName: '*' }
    ]
  });
  const existingNames = new Set(Array.from(projectSet.getSourceComponents()).map(c => c.fullName.toLowerCase()));

  const bundleFileNames = (yield* fsService.readDirectory(bundleUri).pipe(
    Effect.flatMap(top =>
      Effect.gen(function* () {
        const testDir = top.find(c => Utils.basename(c) === TEST_FOLDER);
        const tests = testDir ? yield* fsService.readDirectory(testDir) : [];
        return [...top, ...tests];
      })
    )
  )).map(uri => Utils.basename(uri));

  const newName = normalizeComponentName(
    yield* promptForAuraName({ existingNames, initialValue: oldName, bundleFileNames }),
    'aura'
  );

  const oldMainFile =
    bundleFileNames.find(f => bundleFilePattern(oldName, 'aura').test(f) && /\.(cmp|app|evt)$/.test(f)) ??
    `${oldName}.cmp`;
  const oldMainUri = Utils.joinPath(bundleUri, oldMainFile);

  const newBundleUri = yield* lightningComponentService.renameBundle({ bundleUri, oldName, newName, kind: 'aura' });

  const newMainUri = Utils.joinPath(newBundleUri, oldMainFile.replace(oldName, newName));
  const activeUri = yield* editorService.getActiveEditorUri().pipe(Effect.option);
  if (Option.isSome(activeUri) && activeUri.value.toString() === oldMainUri.toString()) {
    yield* fsService.showTextDocument(newMainUri, { preview: false });
  }

  void vscode.window.showWarningMessage(nls.localize('rename_component_warning'));
});
