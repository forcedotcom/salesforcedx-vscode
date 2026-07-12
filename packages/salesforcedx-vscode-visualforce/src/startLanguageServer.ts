/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import {
  Color,
  ColorInformation,
  ColorPresentation,
  type ExtensionContext,
  languages,
  Position,
  Range,
  TextDocument
} from 'vscode';
import { RequestType, TextDocumentPositionParams } from 'vscode-languageclient';
import {
  type ColorPresentationParams,
  ColorPresentationRequest,
  type DocumentColorParams,
  DocumentColorRequest,
  type ColorInformation as LSPColorInformation,
  type ColorPresentation as LSPColorPresentation
} from 'vscode-languageserver-protocol';
import { createLanguageClient } from './languageClient';
import { buildSchemes } from './languageClient/clientOptions';
import { activateTagClosing } from './tagClosing';

const TagCloseRequest = {
  type: new RequestType<TextDocumentPositionParams, string, any>('html/tag')
} as const;

// Web drops the JavaScript embedded mode (its `typescript` dep is node-only); css stays on both platforms.
const embeddedLanguages = { css: true, javascript: process.env.ESBUILD_PLATFORM !== 'web' };

export const startLanguageServer = Effect.fn('startLanguageServer')(function* (context: ExtensionContext) {
  const client = yield* createLanguageClient(context.extensionUri, { embeddedLanguages }).pipe(
    Effect.catchTag('LanguageClientWorkerStartError', error =>
      // Non-fatal for the spike: LSP unavailable, but the extension still activates.
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        yield* api.services.ChannelService.pipe(
          Effect.flatMap(svc =>
            svc.appendToChannel(
              `Visualforce language server unavailable: failed to start worker from ${error.serverPath}`
            )
          )
        );
        return undefined;
      })
    )
  );
  if (!client) {
    return;
  }

  yield* Effect.promise(() => client.start());
  context.subscriptions.push(client);

  const schemes = buildSchemes();

  // non-fatal: color/tag-closing features unavailable if this throws
  yield* Effect.try(() => {
    const colorDisposable = languages.registerColorProvider(
      schemes.map(scheme => ({ language: 'visualforce', scheme })),
      {
        provideDocumentColors: (document: TextDocument): Thenable<ColorInformation[]> => {
          const params: DocumentColorParams = {
            textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document)
          };
          return client.sendRequest(DocumentColorRequest.type, params).then((symbols: LSPColorInformation[]) =>
            symbols.map((symbol: LSPColorInformation) => {
              const range = client.protocol2CodeConverter.asRange(symbol.range);
              const color = new Color(symbol.color.red, symbol.color.green, symbol.color.blue, symbol.color.alpha);
              return new ColorInformation(range, color);
            })
          );
        },
        provideColorPresentations: (
          color: Color,
          colorContext: { document: TextDocument; range: Range }
        ): Thenable<ColorPresentation[]> => {
          const params: ColorPresentationParams = {
            textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(colorContext.document),
            range: client.code2ProtocolConverter.asRange(colorContext.range),
            color
          };
          return client
            .sendRequest(ColorPresentationRequest.type, params)
            .then(async (presentations: LSPColorPresentation[]) =>
              Promise.all(
                presentations.map(async (p: LSPColorPresentation) => {
                  const presentation = new ColorPresentation(p.label);
                  presentation.textEdit = p.textEdit && client.protocol2CodeConverter.asTextEdit(p.textEdit);
                  presentation.additionalTextEdits =
                    p.additionalTextEdits && (await client.protocol2CodeConverter.asTextEdits(p.additionalTextEdits));
                  return presentation;
                })
              )
            );
        }
      }
    );
    context.subscriptions.push(colorDisposable);

    const tagDisposable = activateTagClosing(
      (document: TextDocument, position: Position) => {
        const param = client.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
        return client.sendRequest(TagCloseRequest.type, param);
      },
      { visualforce: true },
      'visualforce.autoClosingTags'
    );
    context.subscriptions.push(tagDisposable);
  }).pipe(Effect.ignore);
});
