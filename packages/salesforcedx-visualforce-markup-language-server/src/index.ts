/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  CompletionList,
  DocumentHighlight,
  DocumentLink,
  Hover,
  Position,
  Range,
  SymbolInformation,
  TextDocument,
  TextEdit
} from 'vscode-languageserver-types';
import { parse } from './parser/htmlParser';
import { createScanner, Scanner, TokenType } from './parser/htmlScanner';
import { CompletionConfiguration, doComplete, doTagComplete } from './services/htmlCompletion';
import { format, HTMLFormatConfiguration } from './services/htmlFormatter';
import { findDocumentHighlights } from './services/htmlHighlighting';
import { doHover } from './services/htmlHover';
import { findDocumentLinks } from './services/htmlLinks';
import { findDocumentSymbols } from './services/htmlSymbolsProvider';

export { HTMLFormatConfiguration, TokenType };

type Node = {
  tag: string;
  start: number;
  end: number;
  endTagStart: number;
  children: Node[];
  parent: Node;
  attributes?: { [name: string]: string };
};

export declare type HTMLDocument = {
  roots: Node[];
  findNodeBefore(offset: number): Node;
  findNodeAt(offset: number): Node;
};

export type DocumentContext = {
  resolveReference(ref: string, base?: string): string;
};

export type LanguageService = {
  createScanner(input: string): Scanner;
  parseHTMLDocument(document: TextDocument): HTMLDocument;
  findDocumentHighlights(document: TextDocument, position: Position, htmlDocument: HTMLDocument): DocumentHighlight[];
  doComplete(
    document: TextDocument,
    position: Position,
    htmlDocument: HTMLDocument,
    options?: CompletionConfiguration
  ): CompletionList;
  doHover(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Hover;
  format(document: TextDocument, range: Range, options: HTMLFormatConfiguration): TextEdit[];
  findDocumentLinks(document: TextDocument, documentContext: DocumentContext): DocumentLink[];
  findDocumentSymbols(document: TextDocument, htmlDocument: HTMLDocument): SymbolInformation[];
  doTagComplete(document: TextDocument, position: Position, htmlDocument: HTMLDocument): string;
};

export function getLanguageService(): LanguageService {
  return {
    createScanner,
    parseHTMLDocument: document => parse(document.getText()),
    doComplete,
    doHover,
    format,
    findDocumentHighlights,
    findDocumentLinks,
    findDocumentSymbols,
    doTagComplete
  };
}
