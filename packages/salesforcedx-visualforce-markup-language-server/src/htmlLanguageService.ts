/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  CompletionItem,
  CompletionList,
  Diagnostic,
  DocumentHighlight,
  DocumentLink,
  FormattingOptions,
  Hover,
  MarkedString,
  Position,
  Range,
  SymbolInformation,
  TextDocument,
  TextEdit
} from 'vscode-languageserver-types';
import { parse } from './parser/htmlParser';
import { createScanner } from './parser/htmlScanner';
import { doComplete, doTagComplete } from './services/htmlCompletion';
import { format } from './services/htmlFormatter';
import { findDocumentHighlights } from './services/htmlHighlighting';
import { doHover } from './services/htmlHover';
import { findDocumentLinks } from './services/htmlLinks';
import { findDocumentSymbols } from './services/htmlSymbolsProvider';

export {
  TextDocument,
  Position,
  CompletionItem,
  CompletionList,
  Hover,
  Range,
  SymbolInformation,
  Diagnostic,
  TextEdit,
  DocumentHighlight,
  FormattingOptions,
  MarkedString,
  DocumentLink
};

export interface HTMLFormatConfiguration {
  tabSize?: number;
  insertSpaces?: boolean;
  wrapLineLength?: number;
  unformatted?: string;
  contentUnformatted?: string;
  indentInnerHtml?: boolean;
  wrapAttributes?:
    | 'auto'
    | 'force'
    | 'force-aligned'
    | 'force-expand-multiline';
  preserveNewLines?: boolean;
  maxPreserveNewLines?: number;
  indentHandlebars?: boolean;
  endWithNewline?: boolean;
  extraLiners?: string;
}

export interface CompletionConfiguration {
  [provider: string]: boolean;
  hideAutoCompleteProposals?: boolean;
}

export interface Node {
  tag: string;
  start: number;
  end: number;
  endTagStart: number;
  children: Node[];
  parent: Node;
  attributes?: { [name: string]: string };
}

export enum TokenType {
  StartCommentTag,
  Comment,
  EndCommentTag,
  StartTagOpen,
  StartTagClose,
  StartTagSelfClose,
  StartTag,
  EndTagOpen,
  EndTagClose,
  EndTag,
  DelimiterAssign,
  AttributeName,
  AttributeValue,
  StartDoctypeTag,
  Doctype,
  EndDoctypeTag,
  Content,
  Whitespace,
  Unknown,
  Script,
  Styles,
  EOS
}

export enum ScannerState {
  WithinContent,
  AfterOpeningStartTag,
  AfterOpeningEndTag,
  WithinDoctype,
  WithinTag,
  WithinEndTag,
  WithinComment,
  WithinScriptContent,
  WithinStyleContent,
  AfterAttributeName,
  BeforeAttributeValue
}

export interface Scanner {
  scan(): TokenType;
  getTokenType(): TokenType;
  getTokenOffset(): number;
  getTokenLength(): number;
  getTokenEnd(): number;
  getTokenText(): string;
  getTokenError(): string;
  getScannerState(): ScannerState;
}

export declare type HTMLDocument = {
  roots: Node[];
  findNodeBefore(offset: number): Node;
  findNodeAt(offset: number): Node;
};

export interface DocumentContext {
  resolveReference(ref: string, base?: string): string;
}

export interface LanguageService {
  createScanner(input: string): Scanner;
  parseHTMLDocument(document: TextDocument): HTMLDocument;
  findDocumentHighlights(
    document: TextDocument,
    position: Position,
    htmlDocument: HTMLDocument
  ): DocumentHighlight[];
  doComplete(
    document: TextDocument,
    position: Position,
    htmlDocument: HTMLDocument,
    options?: CompletionConfiguration
  ): CompletionList;
  doHover(
    document: TextDocument,
    position: Position,
    htmlDocument: HTMLDocument
  ): Hover;
  format(
    document: TextDocument,
    range: Range,
    options: HTMLFormatConfiguration
  ): TextEdit[];
  findDocumentLinks(
    document: TextDocument,
    documentContext: DocumentContext
  ): DocumentLink[];
  findDocumentSymbols(
    document: TextDocument,
    htmlDocument: HTMLDocument
  ): SymbolInformation[];
  doTagComplete(
    document: TextDocument,
    position: Position,
    htmlDocument: HTMLDocument
  ): string;
}

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
