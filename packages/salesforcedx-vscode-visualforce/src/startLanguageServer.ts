/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
import { ConfigurationFeature } from 'vscode-languageclient/lib/common/configuration';
import { LanguageClient, RequestType, TextDocumentPositionParams, TransportKind } from 'vscode-languageclient/node';
import {
  type ColorPresentationParams,
  ColorPresentationRequest,
  type DocumentColorParams,
  DocumentColorRequest,
  type ColorInformation as LSPColorInformation,
  type ColorPresentation as LSPColorPresentation
} from 'vscode-languageserver-protocol';
import { Utils } from 'vscode-uri';
import { activateTagClosing } from './tagClosing';

const TagCloseRequest = {
  type: new RequestType<TextDocumentPositionParams, string, any>('html/tag')
} as const;

export const startLanguageServer = Effect.fn('startLanguageServer')(function* (context: ExtensionContext) {
  const module = Utils.joinPath(context.extensionUri, 'dist', 'visualforceServer.js').fsPath;
  const client = new LanguageClient(
    'visualforce',
    'Visualforce Language Server',
    {
      run: { module, transport: TransportKind.ipc },
      debug: {
        module,
        transport: TransportKind.ipc,
        options: { execArgv: ['--nolazy', '--inspect=6004'] }
      }
    },
    {
      documentSelector: [
        {
          language: 'visualforce',
          scheme: 'file'
        }
      ],
      synchronize: {
        configurationSection: ['visualforce', 'css', 'javascript']
      },
      initializationOptions: {
        embeddedLanguages: { css: true, javascript: true }
      }
    }
  );
  client.registerFeature(new ConfigurationFeature(client));

  yield* Effect.promise(() => client.start());
  context.subscriptions.push(client);

  // non-fatal: color/tag-closing features unavailable if this throws
  yield* Effect.try(() => {
    const colorDisposable = languages.registerColorProvider(
      [
        {
          language: 'visualforce',
          scheme: 'file'
        }
      ],
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
