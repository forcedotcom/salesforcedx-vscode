/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  commands,
  CompletionItem,
  CompletionList,
  EndOfLine,
  Position,
  TextDocument,
  Uri,
  workspace
} from 'vscode';

import { Middleware } from 'vscode-languageclient/lib/main';
import ProtocolCompletionItem from 'vscode-languageclient/lib/protocolCompletionItem';

const SOQL_SPECIAL_COMPLETION_ITEM_LABEL = '_SOQL_';

const virtualDocumentContents = new Map<string, string>();

workspace.registerTextDocumentContentProvider('embedded-soql', {
  provideTextDocumentContent: uri => {
    const originalUri = uri.path.replace(/^\//, '').replace(/.soql$/, '');
    return virtualDocumentContents.get(originalUri);
  }
});

function insideSOQLBlock(
  apexItems: ProtocolCompletionItem[]
): { queryText: string; location: any } | undefined {
  const soqlItem = apexItems.find(
    i => i.label === SOQL_SPECIAL_COMPLETION_ITEM_LABEL
  );
  return soqlItem
    ? { queryText: soqlItem.detail as string, location: soqlItem.data }
    : undefined;
}
function insideApexBindingExpression(
  document: TextDocument,
  soqlQuery: string,
  position: Position
): boolean {
  // Simple heuristic to detect when cursor is on a binding expression
  // (which might have been missed by Apex LSP)
  const rangeAtCursor = document.getWordRangeAtPosition(
    position,
    /[:(_\.\w)]+/
  );
  const wordAtCursor = rangeAtCursor
    ? document.getText(rangeAtCursor)
    : undefined;

  return !!wordAtCursor && wordAtCursor.startsWith(':');
}

function getSOQLVirtualContent(
  document: TextDocument,
  position: Position,
  soqlBlock: { queryText: string; location: any }
): string {
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
    blankedContent.slice(
      soqlBlock.location.startIndex + soqlBlock.queryText.length + 2
    );

  return content;
}

export const soqlMiddleware: Middleware = {
  provideCompletionItem: async (document, position, context, token, next) => {
    const apexCompletionItems = await next(document, position, context, token);
    if (!apexCompletionItems) {
      return;
    }

    const items: ProtocolCompletionItem[] = Array.isArray(apexCompletionItems)
      ? (apexCompletionItems as ProtocolCompletionItem[])
      : ((apexCompletionItems as CompletionList)
          .items as ProtocolCompletionItem[]);

    const soqlBlock = insideSOQLBlock(items);
    if (soqlBlock) {
      if (
        !insideApexBindingExpression(document, soqlBlock.queryText, position)
      ) {
        return await doSOQLCompletion(
          document,
          position.with({ character: position.character }),
          context,
          soqlBlock
        );
      } else {
        return items.filter(
          i => i.label !== SOQL_SPECIAL_COMPLETION_ITEM_LABEL
        );
      }
    } else return apexCompletionItems;
  }
};

async function doSOQLCompletion(
  document: TextDocument,
  position: Position,
  context: any,
  soqlBlock: any
): Promise<CompletionItem[] | CompletionList<CompletionItem>> {
  const originalUri = document.uri.path;
  virtualDocumentContents.set(
    originalUri,
    getSOQLVirtualContent(document, position, soqlBlock)
  );

  const vdocUriString = `embedded-soql://soql/${originalUri}.soql`;
  const vdocUri = Uri.parse(vdocUriString);
  const soqlCompletions = await commands.executeCommand<CompletionList>(
    'vscode.executeCompletionItemProvider',
    vdocUri,
    position,
    context.triggerCharacter
  );
  return soqlCompletions || [];
}

function eolForDocument(doc: TextDocument) {
  switch (doc.eol) {
    case EndOfLine.LF:
      return '\n';
    case EndOfLine.CRLF:
      return '\r\n';
  }
  return '\n';
}
