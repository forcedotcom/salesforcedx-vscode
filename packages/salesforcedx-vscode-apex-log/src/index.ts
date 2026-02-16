/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeExtensionScope,
  ExtensionPackageJsonSchema,
  ExtensionProviderService,
  type ExtensionPackageJson,
  getExtensionScope
} from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { executeAnonymousDocumentCommand, executeAnonymousSelectionCommand } from './commands/executeAnonymous';
import { logGetCommand } from './commands/logGet';
import { AllServicesLayer, buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await Effect.runPromise(activation(context).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(deactivation().pipe(Effect.provide(AllServicesLayer)));

const activation = Effect.fn('activation')(function* (context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const emptyPjson: ExtensionPackageJson = {};
  const pjson = yield* Schema.decodeUnknown(ExtensionPackageJsonSchema)(context.extension.packageJSON).pipe(
    Effect.catchAll(() => Effect.succeed(emptyPjson))
  );
  const displayName = pjson.displayName ?? 'Salesforce Apex Log';
  yield* api.services.ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel(`${displayName} extension activating`))
  );

  const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);

  yield* Effect.all(
    [
      registerCommand('sf.apex.log.get', logGetCommand),
      registerCommand('sf.anon.apex.execute.document', executeAnonymousDocumentCommand),
      registerCommand('sf.anon.apex.execute.selection', executeAnonymousSelectionCommand)
    ],
    { concurrency: 'unbounded' }
  );

  yield* api.services.ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel(`${displayName} activation complete.`))
  );
});

const deactivation = Effect.fn('deactivation')(function* () {
  yield* closeExtensionScope();
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const displayName = yield* api.services.ExtensionContextService.pipe(
    Effect.flatMap(svc => svc.getDisplayName),
    Effect.catchAll(() => Effect.succeed('Salesforce Apex Log'))
  );
  yield* api.services.ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel(`${displayName} extension deactivated!`))
  );
});
