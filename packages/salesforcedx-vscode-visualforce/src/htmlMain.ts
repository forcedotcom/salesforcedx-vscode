/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import {
  CompletionItem,
  CompletionItemKind,
  ExtensionContext,
  IndentAction,
  languages,
  Position,
  Range,
  SelectionRange,
  SelectionRangeKind,
  SnippetString,
  TextDocument,
  workspace
} from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import {
  LanguageClient,
  LanguageClientOptions,
  RequestType,
  ServerOptions,
  TextDocumentPositionParams,
  TransportKind
} from 'vscode-languageclient';
import {
  getCustomDataPathsFromAllExtensions,
  getCustomDataPathsInAllWorkspaces
} from './customData';
import { EMPTY_ELEMENTS } from './htmlEmptyTagsShared';
import { activateTagClosing } from './tagClosing';

namespace TagCloseRequest {
  export const type: RequestType<
    TextDocumentPositionParams,
    string,
    any,
    any
  > = new RequestType('html/tag');
}

interface IPackageInfo {
  name: string;
  version: string;
  aiKey: string;
}

export function activate(
  context: ExtensionContext,
  telemetryReporter: TelemetryReporter | undefined
) {
  const toDispose = context.subscriptions;

  const serverModule = context.asAbsolutePath(
    path.join(
      'node_modules',
      '@salesforce',
      'salesforcedx-visualforce-language-server',
      'out',
      'src',
      'visualforceServerMain.js'
    )
  );

  // The debug options for the server
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6045'] };

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

  const documentSelector = ['html', 'handlebars', 'razor'];
  const embeddedLanguages = { css: true, javascript: true };

  const dataPaths = [
    ...getCustomDataPathsInAllWorkspaces(workspace.workspaceFolders),
    ...getCustomDataPathsFromAllExtensions()
  ];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      configurationSection: ['html', 'css', 'javascript'] // the settings to synchronize
    },
    initializationOptions: {
      embeddedLanguages,
      dataPaths
    }
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    'html',
    localize('visualforce.languageserver', 'Visualforce Language Server'),
    serverOptions,
    clientOptions
  );
  client.registerProposedFeatures();

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
      { html: true, handlebars: true, razor: true },
      'html.autoClosingTags'
    );
    toDispose.push(disposable);

    disposable = client.onTelemetry(e => {
      if (telemetryReporter) {
        telemetryReporter.sendTelemetryEvent(e.key, e.data);
      }
    });
    toDispose.push(disposable);

    documentSelector.forEach(selector => {
      context.subscriptions.push(
        languages.registerSelectionRangeProvider(selector, {
          async provideSelectionRanges(
            document: TextDocument,
            position: Position
          ): Promise<SelectionRange[]> {
            const textDocument = client.code2ProtocolConverter.asTextDocumentIdentifier(
              document
            );
            const rawRanges = await client.sendRequest<Range[]>(
              '$/textDocument/selectionRange',
              { textDocument, position }
            );
            if (Array.isArray(rawRanges)) {
              return rawRanges.map(r => {
                return {
                  range: client.protocol2CodeConverter.asRange(r),
                  kind: SelectionRangeKind.Declaration
                };
              });
            }
            return [];
          }
        })
      );
    });
  });

  languages.setLanguageConfiguration('html', {
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
        afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>/i,
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
        afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>/i,
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
        afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>/i,
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

  const regionCompletionRegExpr = /^(\s*)(<(!(-(-\s*(#\w*)?)?)?)?)?$/;
  languages.registerCompletionItemProvider(documentSelector, {
    provideCompletionItems(doc, pos) {
      const lineUntilPos = doc.getText(
        new Range(new Position(pos.line, 0), pos)
      );
      const match = lineUntilPos.match(regionCompletionRegExpr);
      if (match) {
        const range = new Range(new Position(pos.line, match[1].length), pos);
        const beginProposal = new CompletionItem(
          '#region',
          CompletionItemKind.Snippet
        );
        beginProposal.range = range;
        beginProposal.insertText = new SnippetString('<!-- #region $1-->');
        beginProposal.documentation = localize(
          'folding.start',
          'Folding Region Start'
        );
        beginProposal.filterText = match[2];
        beginProposal.sortText = 'za';
        const endProposal = new CompletionItem(
          '#endregion',
          CompletionItemKind.Snippet
        );
        endProposal.range = range;
        endProposal.insertText = new SnippetString('<!-- #endregion -->');
        endProposal.documentation = localize(
          'folding.end',
          'Folding Region End'
        );
        endProposal.filterText = match[2];
        endProposal.sortText = 'zb';
        return [beginProposal, endProposal];
      }
      return null;
    }
  });
}

function readJSONFile(location: string) {
  try {
    return JSON.parse(fs.readFileSync(location).toString());
  } catch (e) {
    console.log(`Problems reading ${location}: ${e}`);
    return {};
  }
}
