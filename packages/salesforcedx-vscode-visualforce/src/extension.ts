/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';

import {
  ExtensionContext,
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

namespace TagCloseRequest {
  export const type: RequestType<
    TextDocumentPositionParams,
    string,
    any,
    any
  > = new RequestType('html/tag');
}

export function activate(context: ExtensionContext) {
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

  const documentSelector = ['visualforce'];
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
