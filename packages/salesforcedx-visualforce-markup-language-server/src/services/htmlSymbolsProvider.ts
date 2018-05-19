/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  Location,
  Range,
  SymbolInformation,
  SymbolKind,
  TextDocument
} from 'vscode-languageserver-types';
import { HTMLDocument, Node } from '../parser/htmlParser';

export function findDocumentSymbols(
  document: TextDocument,
  htmlDocument: HTMLDocument
): SymbolInformation[] {
  const symbols = [] as SymbolInformation[];

  htmlDocument.roots.forEach(node => {
    provideFileSymbolsInternal(document, node, '', symbols);
  });

  return symbols;
}

function provideFileSymbolsInternal(
  document: TextDocument,
  node: Node,
  container: string,
  symbols: SymbolInformation[]
): void {
  const name = nodeToName(node);
  const location = Location.create(
    document.uri,
    Range.create(document.positionAt(node.start), document.positionAt(node.end))
  );
  const symbol = {
    name,
    location,
    containerName: container,
    kind: SymbolKind.Field as SymbolKind
  } as SymbolInformation;

  symbols.push(symbol);

  node.children.forEach(child => {
    provideFileSymbolsInternal(document, child, name, symbols);
  });
}

function nodeToName(node: Node): string {
  let name = node.tag;

  if (node.attributes) {
    const id = node.attributes['id'];
    const classes = node.attributes['class'];

    if (id) {
      name += `#${id.replace(/[\"\']/g, '')}`;
    }

    if (classes) {
      name += classes
        .replace(/[\"\']/g, '')
        .split(/\s+/)
        .map(className => `.${className}`)
        .join('');
    }
  }

  return name;
}
