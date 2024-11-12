/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { commands, CompletionItem, CompletionList, EndOfLine, Position, TextDocument, Uri, workspace } from 'vscode';
import ProtocolCompletionItem from 'vscode-languageclient/lib/common/protocolCompletionItem';

import { Middleware } from 'vscode-languageclient/node';

const SOQL_SPECIAL_COMPLETION_ITEM_LABEL = '_SOQL_';

const virtualDocumentContents = new Map<string, string>();

workspace.registerTextDocumentContentProvider('embedded-soql', {
  provideTextDocumentContent: uri => {
    const originalUri = uri.path.replace(/^\//, '').replace(/.soql$/, '');
    return virtualDocumentContents.get(originalUri);
  }
});

const insideSOQLBlock = (apexItems: ProtocolCompletionItem[]): { queryText: string; location: any } | undefined => {
  const soqlItem = apexItems.find(i => i.label === SOQL_SPECIAL_COMPLETION_ITEM_LABEL);
  return soqlItem ? { queryText: soqlItem.detail as string, location: soqlItem.data } : undefined;
};

const insideApexBindingExpression = (document: TextDocument, soqlQuery: string, position: Position): boolean => {
  // Simple heuristic to detect when cursor is on a binding expression
  // (which might have been missed by Apex LSP)
  const rangeAtCursor = document.getWordRangeAtPosition(position, /[:(_.\w)]+/);
  const wordAtCursor = rangeAtCursor ? document.getText(rangeAtCursor) : undefined;

  return !!wordAtCursor && wordAtCursor.startsWith(':');
};

const getSOQLVirtualContent = (
  document: TextDocument,
  position: Position,
  soqlBlock: { queryText: string; location: any }
): string => {
  const eol = eolForDocument(document);
  const blankedContent = document
    .getText()
    .split(eol)
    .map(line => {
      return ' '.repeat(line.length);
    })
    .join(eol);

  const content =
    blankedContent.slice(0, soqlBlock.location.startIndex) +
    ' ' +
    soqlBlock.queryText +
    ' ' +
    blankedContent.slice(soqlBlock.location.startIndex + soqlBlock.queryText.length + 2);

  return content;
};

export const soqlMiddleware: Middleware = {
  // @ts-ignore
  provideCompletionItem: async (document, position, context, token, next) => {
    const apexCompletionItems = await next(document, position, context, token);
    if (!apexCompletionItems) {
      return;
    }

    const items: ProtocolCompletionItem[] = Array.isArray(apexCompletionItems)
      ? (apexCompletionItems as ProtocolCompletionItem[])
      : (apexCompletionItems.items as ProtocolCompletionItem[]);

    const soqlBlock = insideSOQLBlock(items);
    if (soqlBlock) {
      if (!insideApexBindingExpression(document, soqlBlock.queryText, position)) {
        return await doSOQLCompletion(document, position.with({ character: position.character }), context, soqlBlock);
      } else {
        return items.filter(i => i.label !== SOQL_SPECIAL_COMPLETION_ITEM_LABEL);
      }
    } else return apexCompletionItems;
  }
};

const doSOQLCompletion = async (
  document: TextDocument,
  position: Position,
  context: any,
  soqlBlock: any
): Promise<CompletionItem[] | CompletionList<CompletionItem>> => {
  const originalUri = document.uri.path;
  virtualDocumentContents.set(originalUri, getSOQLVirtualContent(document, position, soqlBlock));

  const vdocUriString = `embedded-soql://soql/${originalUri}.soql`;
  const vdocUri = Uri.parse(vdocUriString);
  const soqlCompletions = await commands.executeCommand<CompletionList>(
    'vscode.executeCompletionItemProvider',
    vdocUri,
    position,
    context.triggerCharacter
  );
  return soqlCompletions || [];
};

const eolForDocument = (doc: TextDocument) => {
  switch (doc.eol) {
    case EndOfLine.LF:
      return '\n';
    case EndOfLine.CRLF:
      return '\r\n';
  }
};
