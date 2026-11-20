/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getApexLanguageServerExports, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import type { DocumentSymbol, SymbolInformation } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { ApexExtensionUnavailable, ApexLspRequestFailed } from '../errors';
import { analyzeApexSource, type OasSourceToken } from '../oas/apexSourceMetadata';
import { resolveSourceText } from '../oas/sourceTextResolver';

const DOCUMENT_STATE_UNAVAILABLE = 'No document state is available';
const DOCUMENT_STATE_READY_SCHEDULE = Schedule.fixed(Duration.millis(100)).pipe(
  Schedule.intersect(Schedule.recurs(30))
);

type ApexExtensionApi = {
  readonly client: {
    readonly semanticTokens: (params: {
      readonly textDocument: { readonly uri: string };
    }) => Promise<readonly OasSourceToken[] | undefined>;
    readonly documentSymbol: (params: {
      readonly textDocument: { readonly uri: string };
    }) => Promise<DocumentSymbol[] | SymbolInformation[] | null>;
  };
};

const ApexExtensionApiSchema = Schema.Struct({
  // The concrete client exposes methods on its prototype, so validate the narrow consumer surface explicitly.
  client: Schema.declare<ApexExtensionApi['client']>(
    (value): value is ApexExtensionApi['client'] =>
      typeof value === 'object' &&
      value !== null &&
      'semanticTokens' in value &&
      typeof value.semanticTokens === 'function' &&
      'documentSymbol' in value &&
      typeof value.documentSymbol === 'function',
    { identifier: 'ApexClient' }
  )
});

const getApexClient = Effect.fn('ApexOas.Lsp.getApexClient')(function* () {
  return yield* getApexLanguageServerExports(ApexExtensionApiSchema).pipe(
    Effect.map(api => api.client),
    Effect.catchTags({
      ExtensionNotFoundError: () =>
        Effect.fail(new ApexExtensionUnavailable({ message: 'Apex Language Server extension is not installed' })),
      ExtensionActivationError: ({ cause }) =>
        Effect.fail(
          new ApexExtensionUnavailable({
            message: `Failed to activate Apex Language Server extension: ${String(cause)}`
          })
        )
    })
  );
});

/** Verifies that the new Apex LS is installed, activatable, and exposes OAS-required requests. */
export const ensureApexLsAvailable = Effect.fn('ApexOas.Lsp.ensureAvailable')(function* () {
  yield* getApexClient();
});

const isDocumentSymbol = (symbol: DocumentSymbol | SymbolInformation): symbol is DocumentSymbol =>
  'selectionRange' in symbol;

const ensureDocumentOpen = Effect.fn('ApexOas.Lsp.ensureDocumentOpen')(function* (resourceUri: URI) {
  // This registers an Explorer-selected file with the LS without revealing an editor.
  yield* Effect.tryPromise({
    try: () => vscode.workspace.openTextDocument(URI.parse(resourceUri.toString())),
    catch: cause => new ApexLspRequestFailed({ message: `Failed to open Apex document: ${String(cause)}`, cause })
  });
});

export class ApexMetadataService extends Effect.Service<ApexMetadataService>()('ApexMetadataService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const analyze = Effect.fn('ApexOas.Lsp.analyze')(function* (resourceUri: URI) {
      const client = yield* getApexClient();
      yield* ensureDocumentOpen(resourceUri);
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const text = yield* resolveSourceText(
        resourceUri,
        vscode.workspace.textDocuments,
        api.services.FsService.readFile
      );
      const params = { textDocument: { uri: resourceUri.toString() } };
      const [tokens, symbols] = yield* Effect.all([
        Effect.tryPromise({
          try: () => client.semanticTokens(params),
          catch: cause =>
            new ApexLspRequestFailed({ message: `semantic tokens request failed: ${String(cause)}`, cause })
        }),
        Effect.tryPromise({
          try: () => client.documentSymbol(params),
          catch: cause =>
            new ApexLspRequestFailed({ message: `document symbol request failed: ${String(cause)}`, cause })
        })
      ]).pipe(
        Effect.retry({
          schedule: DOCUMENT_STATE_READY_SCHEDULE,
          while: error => error.message.includes(DOCUMENT_STATE_UNAVAILABLE)
        })
      );
      if (!tokens)
        return yield* new ApexLspRequestFailed({ message: 'Apex Language Server does not provide semantic tokens' });
      if (!symbols?.every(isDocumentSymbol)) {
        return yield* new ApexLspRequestFailed({
          message: 'Apex Language Server did not provide hierarchical document symbols'
        });
      }
      const analysis = analyzeApexSource(resourceUri, text, tokens, symbols);
      if (!analysis) return yield* new ApexLspRequestFailed({ message: 'No Apex class declaration found in document' });
      return analysis;
    });
    return { analyze };
  })
}) {}
