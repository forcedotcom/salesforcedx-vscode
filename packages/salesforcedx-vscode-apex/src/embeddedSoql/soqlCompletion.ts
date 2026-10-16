/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  commands,
  type CompletionContext,
  type CompletionItem,
  type CompletionList,
  EndOfLine,
  type Position,
  type TextDocument,
  workspace
} from 'vscode';
import ProtocolCompletionItem from 'vscode-languageclient/lib/common/protocolCompletionItem';
import { type Middleware } from 'vscode-languageclient/node';
import { URI } from 'vscode-uri';

const SOQL_SPECIAL_COMPLETION_ITEM_LABEL = '_SOQL_';

type SoqlBlock = { queryText: string; location: { startIndex: number } };

const isSoqlLocation = (data: unknown): data is SoqlBlock['location'] =>
  typeof data === 'object' && data !== null && 'startIndex' in data && typeof data.startIndex === 'number';

const virtualDocumentContents = new Map<string, string>();

workspace.registerTextDocumentContentProvider('embedded-soql', {
  provideTextDocumentContent: uri => {
    const originalUri = uri.path.replace(/^\//, '').replace(/.soql$/, '');
    return virtualDocumentContents.get(originalUri);
  }
});

const provideCompletionItem: Middleware['provideCompletionItem'] = async (document, position, context, token, next) => {
  const apexCompletionItems = await next(document, position, context, token);
  if (!apexCompletionItems) {
    return;
  }

  const items = Array.isArray(apexCompletionItems) ? apexCompletionItems : apexCompletionItems.items;
  const soqlBlock = insideSOQLBlock(items);
  if (!soqlBlock) {
    return apexCompletionItems;
  }
  return insideApexBindingExpression(document, soqlBlock.queryText, position)
    ? items.filter(item => item.label !== SOQL_SPECIAL_COMPLETION_ITEM_LABEL)
    : doSOQLCompletion(document, position.with({ character: position.character }), context, soqlBlock);
};

export const soqlMiddleware: Middleware = {
  provideCompletionItem
};

const insideSOQLBlock = (apexItems: CompletionItem[]): SoqlBlock | undefined => {
  const soqlItem = apexItems.find(item => item.label === SOQL_SPECIAL_COMPLETION_ITEM_LABEL);
  return soqlItem instanceof ProtocolCompletionItem &&
    typeof soqlItem.detail === 'string' &&
    isSoqlLocation(soqlItem.data)
    ? { queryText: soqlItem.detail, location: soqlItem.data }
    : undefined;
};

const insideApexBindingExpression = (document: TextDocument, soqlQuery: string, position: Position): boolean => {
  // Simple heuristic to detect when cursor is on a binding expression
  // (which might have been missed by Apex LSP)
  const rangeAtCursor = document.getWordRangeAtPosition(position, /[:(_.\w)]+/);
  const wordAtCursor = rangeAtCursor ? document.getText(rangeAtCursor) : undefined;

  return !!wordAtCursor && wordAtCursor.startsWith(':');
};

const getSOQLVirtualContent = (document: TextDocument, position: Position, soqlBlock: SoqlBlock): string => {
  const eol = eolForDocument(document);
  const blankedContent = document
    .getText()
    .split(eol)
    .map(line => ' '.repeat(line.length))
    .join(eol);

  const content = `${blankedContent.slice(0, soqlBlock.location.startIndex)} ${
    soqlBlock.queryText
  } ${blankedContent.slice(soqlBlock.location.startIndex + soqlBlock.queryText.length + 2)}`;

  return content;
};

const doSOQLCompletion = async (
  document: TextDocument,
  position: Position,
  context: CompletionContext,
  soqlBlock: SoqlBlock
): Promise<CompletionItem[] | CompletionList<CompletionItem>> => {
  const originalUri = document.uri.path;
  virtualDocumentContents.set(originalUri, getSOQLVirtualContent(document, position, soqlBlock));

  const vdocUri = URI.parse(`embedded-soql://soql/${originalUri}.soql`);
  const soqlCompletions = await commands.executeCommand<CompletionList>(
    'vscode.executeCompletionItemProvider',
    vdocUri,
    position,
    context.triggerCharacter
  );
  return soqlCompletions ?? [];
};

const eolForDocument = (doc: TextDocument) => (doc.eol === EndOfLine.LF ? '\n' : '\r\n');
