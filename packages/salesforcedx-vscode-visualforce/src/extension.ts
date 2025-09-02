/* eslint-disable header/header */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import type { SalesforceVSCodeCoreApi } from 'salesforcedx-vscode-core';

import {
  Color,
  ColorInformation,
  ColorPresentation,
  ExtensionContext,
  extensions,
  IndentAction,
  languages,
  Position,
  Range,
  TextDocument,
  Disposable
} from 'vscode';
import { ConfigurationFeature } from 'vscode-languageclient/lib/common/configuration';
import {
  LanguageClient,
  LanguageClientOptions,
  RequestType,
  ServerOptions,
  TextDocumentPositionParams,
  TransportKind
} from 'vscode-languageclient/node';
import {
  type ColorPresentationParams,
  ColorPresentationRequest,
  type DocumentColorParams,
  DocumentColorRequest,
  type ColorInformation as LSPColorInformation,
  type ColorPresentation as LSPColorPresentation
} from 'vscode-languageserver-protocol';
import { EMPTY_ELEMENTS } from './htmlEmptyTagsShared';
import { activateTagClosing } from './tagClosing';

namespace TagCloseRequest {
  export const type: RequestType<TextDocumentPositionParams, string, any> = new RequestType('html/tag');
}

// hoisted to module scope since it's used in deactivate
let telemetryService: ReturnType<SalesforceVSCodeCoreApi['services']['TelemetryService']['getInstance']> | undefined;

export const activate = async (context: ExtensionContext) => {
  const salesforceCoreExtension = extensions.getExtension<SalesforceVSCodeCoreApi>(
    'salesforce.salesforcedx-vscode-core'
  );
  if (!salesforceCoreExtension?.isActive) {
    await salesforceCoreExtension?.activate();
  }
  telemetryService = salesforceCoreExtension?.exports?.services?.TelemetryService.getInstance();
  await telemetryService?.initializeService(context);
  const extensionStartTime = globalThis.performance.now();

  // The server is implemented in node
  const module = context.asAbsolutePath(path.join('dist', 'visualforceServer.js'));

  // If the extension is launch in debug mode the debug server options are use
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6004'] }
    }
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        language: 'visualforce',
        scheme: 'file'
      }
    ],
    synchronize: {
      configurationSection: ['visualforce', 'css', 'javascript'] // the settings to synchronize
    },
    initializationOptions: {
      embeddedLanguages: { css: true, javascript: true }
    }
  };

  // Create the language client and start the client.
  const client = new LanguageClient('visualforce', 'Visualforce Language Server', serverOptions, clientOptions);
  client.registerFeature(new ConfigurationFeature(client));

  await client.start();
  context.subscriptions.push(client);
  let disposable: Disposable;
  try {
    disposable = languages.registerColorProvider(
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
    context.subscriptions.push(disposable);

    const tagRequestor = (document: TextDocument, position: Position) => {
      const param = client.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
      return client.sendRequest(TagCloseRequest.type, param);
    };
    disposable = activateTagClosing(tagRequestor, { visualforce: true }, 'visualforce.autoClosingTags');
    context.subscriptions.push(disposable);
  } catch {
    telemetryService?.sendExtensionActivationEvent(extensionStartTime);
  }
  languages.setLanguageConfiguration('visualforce', {
    indentationRules: {
      increaseIndentPattern:
        /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|link|meta|param)\b|[^>]*\/>)([-_.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
      decreaseIndentPattern: /^\s*(<\/(?!html)[-_.A-Za-z0-9]+\b[^>]*>|-->|\})/
    },
    wordPattern: /(-?\d*\.\d\w*)|([^`~!@$^&*()=+[{\]}\\|;:'",.<>/\s]+)/g,
    onEnterRules: [
      {
        beforeText: new RegExp(`<(?!(?:${EMPTY_ELEMENTS.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
        afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>$/i,
        action: { indentAction: IndentAction.IndentOutdent }
      },
      {
        beforeText: new RegExp(`<(?!(?:${EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
        action: { indentAction: IndentAction.Indent }
      }
    ]
  });

  languages.setLanguageConfiguration('handlebars', {
    wordPattern: /(-?\d*\.\d\w*)|([^`~!@$^&*()=+[{\]}\\|;:'",.<>/\s]+)/g,
    onEnterRules: [
      {
        beforeText: new RegExp(`<(?!(?:${EMPTY_ELEMENTS.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
        afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>$/i,
        action: { indentAction: IndentAction.IndentOutdent }
      },
      {
        beforeText: new RegExp(`<(?!(?:${EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
        action: { indentAction: IndentAction.Indent }
      }
    ]
  });

  languages.setLanguageConfiguration('razor', {
    wordPattern: /(-?\d*\.\d\w*)|([^`~!@$^&*()-=+[{\]}\\|;:'",.<>/\s]+)/g,
    onEnterRules: [
      {
        beforeText: new RegExp(`<(?!(?:${EMPTY_ELEMENTS.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
        afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>$/i,
        action: { indentAction: IndentAction.IndentOutdent }
      },
      {
        beforeText: new RegExp(`<(?!(?:${EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
        action: { indentAction: IndentAction.Indent }
      }
    ]
  });

  telemetryService?.sendExtensionActivationEvent(extensionStartTime);
};

export const deactivate = () => {
  console.log('Visualforce Extension Deactivated');
  telemetryService?.sendExtensionDeactivationEvent();
};
