/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { window } from 'vscode';
import { LanguageClient, LanguageClientOptions, RevealOutputChannelOn } from 'vscode-languageclient/browser';
import {
  buildDocumentSelector,
  buildSchemes,
  getBaseClientOptions,
  type VisualforceInitializationOptions
} from './clientOptions';

/** The web language server runs in a `Worker`; construction can fail (bad URL, CSP). Surfaced as a tagged error. */
export class LanguageClientWorkerStartError extends Schema.TaggedError<LanguageClientWorkerStartError>()(
  'LanguageClientWorkerStartError',
  {
    message: Schema.String,
    serverPath: Schema.String,
    cause: Schema.Unknown
  }
) {}

/**
 * Browser language client: the server runs in a web worker over `BrowserMessageReader/Writer`.
 * Fails with {@link LanguageClientWorkerStartError} (no `throw`) when the worker cannot be created.
 */
export const createLanguageClient = Effect.fn('createWebLanguageClient')(function* (
  serverPath: string,
  initializationOptions: VisualforceInitializationOptions
) {
  const worker = yield* Effect.try({
    try: () => new Worker(serverPath),
    catch: cause =>
      new LanguageClientWorkerStartError({
        message: `failed to start Visualforce language server worker from ${serverPath}`,
        serverPath,
        cause
      })
  });

  const outputChannel = window.createOutputChannel('Visualforce Language Server');

  const clientOptions: LanguageClientOptions = {
    ...getBaseClientOptions(initializationOptions),
    documentSelector: buildDocumentSelector(buildSchemes()),
    outputChannel,
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    traceOutputChannel: outputChannel
  };

  // Browser LanguageClient constructor signature: (id, name, clientOptions, worker)
  return new LanguageClient('visualforce', 'Visualforce Language Server', clientOptions, worker);
});
