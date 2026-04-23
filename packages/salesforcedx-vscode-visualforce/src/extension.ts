/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { closeExtensionScope, ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Scope from 'effect/Scope';
import { type ExtensionContext } from 'vscode';
import { URI } from 'vscode-uri';
import { createVisualforceComponentCommand } from './commands/createVisualforceComponent';
import { createVisualforcePageCommand } from './commands/createVisualforcePage';
import { configureLanguages } from './languageConfiguration';
import { buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { getRuntime } from './services/runtime';
import { startLanguageServer } from './startLanguageServer';

export const activate = async (context: ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await getRuntime().runPromise(activation(context).pipe(Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> => getRuntime().runPromise(deactivation());

const activation = Effect.fn('activation')(function* (context: ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  yield* api.services.ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel('Visualforce extension activating'))
  );

  const registerCommand = api.services.registerCommandWithRuntime(getRuntime());

  yield* Effect.all([
    startLanguageServer(context),
    registerCommand('sf.visualforce.generate.page', (arg?: URI) => createVisualforcePageCommand(arg)),
    registerCommand('sf.visualforce.generate.component', (arg?: URI) => createVisualforceComponentCommand(arg)),
    configureLanguages()
  ]);

  yield* api.services.ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel('Visualforce extension activation complete.'))
  );
});

const deactivation = Effect.fn('deactivation')(function* () {
  yield* closeExtensionScope();
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel('Visualforce extension deactivated.'))
  );
});
