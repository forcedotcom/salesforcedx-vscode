/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { createApexAction } from './commands/apexActionController';
import { validateOpenApiDocument } from './commands/oasDocumentChecker';
import { nls } from './messages/nls';
import { buildAllServicesLayer, getApexOasRuntime, setAllServicesLayer } from './services/extensionProvider';

export const activate = async (_context: vscode.ExtensionContext) => {
  setAllServicesLayer(buildAllServicesLayer(_context, nls.localize('channel_name')));
  await getApexOasRuntime().runPromise(activateEffect());
  return {};
};

const activateEffect = Effect.fn('activation:salesforcedx-vscode-apex-oas')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  // Create registerCommand pre-loaded with the runtime for proper tracing
  const registerCommand = api.services.registerCommandWithRuntime(getApexOasRuntime());
  yield* Effect.all(
    [
      registerCommand('sf.create.apex.action.class', (sourceUri: URI | URI[]) => createApexAction(sourceUri)),
      registerCommand('sf.validate.oas.document', (sourceUri: URI | URI[]) => validateOpenApiDocument(sourceUri))
    ],
    { concurrency: 'unbounded' }
  );
});

export const deactivate = async () => {};
