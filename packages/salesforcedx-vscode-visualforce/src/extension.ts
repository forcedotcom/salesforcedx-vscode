/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';

import {
  Color,
  ColorInformation,
  ColorPresentation,
  ExtensionContext,
  extensions,
  IndentAction,
  languages,
  Position,
  TextDocument
} from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  RequestType,
  ServerOptions,
  TextDocumentPositionParams,
  TransportKind
} from 'vscode-languageclient';
import { EMPTY_ELEMENTS } from './htmlEmptyTagsShared';
import { activateTagClosing } from './tagClosing';

import { ConfigurationFeature } from 'vscode-languageclient/lib/configuration.proposed';
import {
  ColorPresentationParams,
  ColorPresentationRequest,
  DocumentColorParams,
  DocumentColorRequest
} from 'vscode-languageserver-protocol/lib/protocol.colorProvider.proposed';
import { telemetryService } from './telemetry';

// tslint:disable-next-line:no-namespace
namespace TagCloseRequest {
  export const type: RequestType<
    TextDocumentPositionParams,
    string,
    any,
    any
  > = new RequestType('html/tag');
}

export async function activate(context: ExtensionContext) {
  // Telemetry
  const sfdxCoreExtension = extensions.getExtension(
    'salesforce.salesforcedx-vscode-core'
  );

  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    sfdxCoreExtension.exports.telemetryService.showTelemetryMessage();

    telemetryService.initializeService(
      sfdxCoreExtension.exports.telemetryService.getReporter(),
      sfdxCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  telemetryService.sendExtensionActivationEvent();

  const toDispose = context.subscriptions;

  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join(
      'node_modules',
      '@salesforce',
      'salesforcedx-visualforce-language-server',
      'out',
      'src',
      'visualforceServer.js'
    )
  );
  // The debug options for the server
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6004'] };

  // If the extension is launch in debug mode the debug server options are use
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  const documentSelector = [
    {
      language: 'visualforce',
      scheme: 'file'
    }
  ];
  const embeddedLanguages = { css: true, javascript: true };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      configurationSection: ['visualforce', 'css', 'javascript'] // the settings to synchronize
    },
    initializationOptions: {
      embeddedLanguages
    }
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    'visualforce',
    'Visualforce Language Server',
    serverOptions,
    clientOptions
  );
  client.registerFeature(new ConfigurationFeature(client));

  let disposable = client.start();
  toDispose.push(disposable);
  client.onReady().then(() => {
    disposable = languages.registerColorProvider(documentSelector, {
      provideDocumentColors(
        document: TextDocument
      ): Thenable<ColorInformation[]> {
        const params: DocumentColorParams = {
          textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(
            document
          )
        };
        return client
          .sendRequest(DocumentColorRequest.type, params)
          .then(symbols => {
            return symbols.map(symbol => {
              const range = client.protocol2CodeConverter.asRange(symbol.range);
              const color = new Color(
                symbol.color.red,
                symbol.color.green,
                symbol.color.blue,
                symbol.color.alpha
              );
              return new ColorInformation(range, color);
            });
          });
      },
      provideColorPresentations(
        document: TextDocument,
        colorInfo: ColorInformation
      ): Thenable<ColorPresentation[]> {
        const params: ColorPresentationParams = {
          textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(
            document
          ),
          colorInfo: {
            range: client.code2ProtocolConverter.asRange(colorInfo.range),
            color: colorInfo.color
          }
        };
        return client
          .sendRequest(ColorPresentationRequest.type, params)
          .then(presentations => {
            return presentations.map(p => {
              const presentation = new ColorPresentation(p.label);
              presentation.textEdit =
                p.textEdit &&
                client.protocol2CodeConverter.asTextEdit(p.textEdit);
              presentation.additionalTextEdits =
                p.additionalTextEdits &&
                client.protocol2CodeConverter.asTextEdits(
                  p.additionalTextEdits
                );
              return presentation;
            });
          });
      }
    });
    toDispose.push(disposable);

    const tagRequestor = (document: TextDocument, position: Position) => {
      const param = client.code2ProtocolConverter.asTextDocumentPositionParams(
        document,
        position
      );
      return client.sendRequest(TagCloseRequest.type, param);
    };
    disposable = activateTagClosing(
      tagRequestor,
      { visualforce: true },
      'visualforce.autoClosingTags'
    );
    toDispose.push(disposable);
  });

  languages.setLanguageConfiguration('visualforce', {
    indentationRules: {
      increaseIndentPattern: /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|link|meta|param)\b|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
      decreaseIndentPattern: /^\s*(<\/(?!html)[-_\.A-Za-z0-9]+\b[^>]*>|-->|\})/
    },
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
    onEnterRules: [
      {
        beforeText: new RegExp(
          `<(?!(?:${EMPTY_ELEMENTS.join(
            '|'
          )}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`,
          'i'
        ),
        afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>$/i,
        action: { indentAction: IndentAction.IndentOutdent }
      },
      {
        beforeText: new RegExp(
          `<(?!(?:${EMPTY_ELEMENTS.join(
            '|'
          )}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`,
          'i'
        ),
        action: { indentAction: IndentAction.Indent }
      }
    ]
  });

  languages.setLanguageConfiguration('handlebars', {
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
    onEnterRules: [
      {
        beforeText: new RegExp(
          `<(?!(?:${EMPTY_ELEMENTS.join(
            '|'
          )}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`,
          'i'
        ),
        afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>$/i,
        action: { indentAction: IndentAction.IndentOutdent }
      },
      {
        beforeText: new RegExp(
          `<(?!(?:${EMPTY_ELEMENTS.join(
            '|'
          )}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`,
          'i'
        ),
        action: { indentAction: IndentAction.Indent }
      }
    ]
  });

  languages.setLanguageConfiguration('razor', {
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
    onEnterRules: [
      {
        beforeText: new RegExp(
          `<(?!(?:${EMPTY_ELEMENTS.join(
            '|'
          )}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`,
          'i'
        ),
        afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>$/i,
        action: { indentAction: IndentAction.IndentOutdent }
      },
      {
        beforeText: new RegExp(
          `<(?!(?:${EMPTY_ELEMENTS.join(
            '|'
          )}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`,
          'i'
        ),
        action: { indentAction: IndentAction.Indent }
      }
    ]
  });
}

export function deactivate() {
  console.log('SFDX Visualforce Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent();
}
