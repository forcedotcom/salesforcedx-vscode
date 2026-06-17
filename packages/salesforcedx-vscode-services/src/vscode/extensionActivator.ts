/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ProjectService } from '../core/projectService';
import { EditorService } from './editorService';
import { ExtensionsService } from './extensionsService';

const LWC_EXTENSION_ID = 'salesforce.salesforcedx-vscode-lwc';
const AURA_EXTENSION_ID = 'salesforce.salesforcedx-vscode-lightning';

const isLwc = (uri: URI): boolean => uri.path.includes('/lwc/');
const isAura = (uri: URI): boolean => uri.path.includes('/aura/');

const activateExtension = (id: string) =>
  Effect.promise(() => vscode.extensions.getExtension(id)?.activate() ?? Promise.resolve());

/** Programmatically activate the LWC and Aura extensions when a file in their directories is opened */
export const watchLwcAuraExtensionActivation = Effect.fn('watchLwcAuraExtensionActivation')(function* () {
  const editorService = yield* EditorService;
  const projectService = yield* ProjectService;
  const extensionsService = yield* ExtensionsService;

  // only need to run once per extension, even if subsequent files are opened
  const activateLwc = yield* Effect.once(activateExtension(LWC_EXTENSION_ID));
  const activateAura = yield* Effect.once(activateExtension(AURA_EXTENSION_ID));

  const isLwcOrAuraUri = (installed: ReadonlySet<string>) => (uri: URI) =>
    (isLwc(uri) && installed.has(LWC_EXTENSION_ID)) || (isAura(uri) && installed.has(AURA_EXTENSION_ID));

  yield* Stream.merge(
    Stream.fromEffect(Effect.sync(() => vscode.window.activeTextEditor)),
    Stream.fromPubSub(editorService.pubsub)
  ).pipe(
    Stream.debounce(Duration.millis(50)),
    Stream.filter(isNotUndefined),
    Stream.map(editor => editor.document.uri),
    Stream.filterEffect(uri => Effect.map(extensionsService.get, installed => isLwcOrAuraUri(installed)(uri))),
    Stream.filterEffect(uri =>
      projectService.isInPackageDirectories(uri).pipe(Effect.catchAll(() => Effect.succeed(false)))
    ),
    Stream.tap(uri => (isLwc(uri) ? activateLwc : activateAura)),
    Stream.runDrain
  );
});
