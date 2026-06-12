/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { ExtensionsService } from './extensionsService';
import { FileChangePubSub } from './fileChangePubSub';

const MULE_DX_API_EXTENSION_ID = 'salesforce.mule-dx-agentforce-api-component';
const SFDX_PROJECT_FILE = 'sfdx-project.json';
const ESR_DECOMPOSE_FLAG = 'decomposeExternalServiceRegistrationBeta';

const setContext = (key: string, value: boolean) =>
  Effect.promise(() => vscode.commands.executeCommand('setContext', key, value));

/**
 * Owns `sf:muleDxApiInactive`. The original key in salesforcedx-vscode-apex-oas read
 * `isActive` once at activation and never updated. vscode.extensions.onDidChange does
 * not fire on activation, so this redefines the gate as "mule extension is not
 * installed/enabled" — which is what onDidChange actually surfaces.
 */
export const watchMuleDxApiInactiveContext = Effect.fn('watchMuleDxApiInactiveContext')(function* () {
  const extensionsService = yield* ExtensionsService;
  yield* Stream.merge(Stream.fromEffect(extensionsService.get), extensionsService.changes).pipe(
    Stream.map(installed => !installed.has(MULE_DX_API_EXTENSION_ID)),
    Stream.changes,
    Stream.runForEach(value => setContext('sf:muleDxApiInactive', value))
  );
});

const readSfdxProject = Effect.fn('readSfdxProject')(function* () {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return undefined;
  const uri = vscode.Uri.joinPath(folders[0].uri, SFDX_PROJECT_FILE);
  const bytes = yield* Effect.tryPromise({
    try: () => Promise.resolve(vscode.workspace.fs.readFile(uri)),
    catch: () => undefined
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
  if (!bytes) return undefined;
  return yield* Effect.try({
    try: (): { sourceBehaviorOptions?: readonly string[] } => JSON.parse(Buffer.from(bytes).toString('utf8')),
    catch: () => undefined
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
});

const isEsrDecomposed = Effect.fn('isEsrDecomposed')(function* () {
  const json = yield* readSfdxProject();
  return Boolean(json?.sourceBehaviorOptions?.includes(ESR_DECOMPOSE_FLAG));
});

/**
 * Owns `sf:is_esr_decomposed`. Re-evaluates whenever sfdx-project.json changes,
 * via the shared FileChangePubSub.
 */
export const watchEsrDecomposedContext = Effect.fn('watchEsrDecomposedContext')(function* () {
  const fileChangePubSub = yield* FileChangePubSub;
  yield* Stream.merge(
    Stream.fromEffect(isEsrDecomposed()),
    Stream.fromPubSub(fileChangePubSub).pipe(
      Stream.filter(event => event.uri.path.endsWith(`/${SFDX_PROJECT_FILE}`)),
      Stream.debounce(Duration.millis(50)),
      Stream.mapEffect(() => isEsrDecomposed())
    )
  ).pipe(
    Stream.changes,
    Stream.runForEach(value => setContext('sf:is_esr_decomposed', value))
  );
});
