/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  InsertTextFormat,
  Position,
  Range,
  TextDocument,
  TextEdit
} from 'vscode-languageserver-types';
import { CompletionConfiguration } from '../htmlLanguageService';
import { HTMLDocument } from '../parser/htmlParser';
import { createScanner, ScannerState, TokenType } from '../parser/htmlScanner';
import { isEmptyElement } from '../parser/htmlTags';
import { allTagProviders } from './tagProviders';

export function doComplete(
  document: TextDocument,
  position: Position,
  htmlDocument: HTMLDocument,
  settings?: CompletionConfiguration
): CompletionList {
  const result: CompletionList = {
    isIncomplete: false,
    items: []
  };
  const tagProviders = allTagProviders.filter(
    p =>
      p.isApplicable(document.languageId) &&
      (!settings || settings[p.getId()] !== false)
  );

  const offset = document.offsetAt(position);
  const node = htmlDocument.findNodeBefore(offset);
  if (!node) {
    return result;
  }
  const text = document.getText();
  const scanner = createScanner(text, node.start);
  let currentTag: string;
  let currentAttributeName: string;

  function getReplaceRange(
    replaceStart: number,
    replaceEnd: number = offset
  ): Range {
    if (replaceStart > offset) {
      replaceStart = offset;
    }
    return {
      start: document.positionAt(replaceStart),
      end: document.positionAt(replaceEnd)
    };
  }

  function collectOpenTagSuggestions(
    afterOpenBracket: number,
    tagNameEnd?: number
  ): CompletionList {
    const range = getReplaceRange(afterOpenBracket, tagNameEnd);
    tagProviders.forEach(provider => {
      provider.collectTags((tag, label) => {
        result.items.push({
          label: tag,
          kind: CompletionItemKind.Property,
          documentation: label,
          textEdit: TextEdit.replace(range, tag),
          insertTextFormat: InsertTextFormat.PlainText
        });
      });
    });
    return result;
  }

  // tslint:disable-next-line:no-shadowed-variable
  function getLineIndent(offset: number) {
    let start = offset;
    while (start > 0) {
      const ch = text.charAt(start - 1);
      if ('\n\r'.indexOf(ch) >= 0) {
        return text.substring(start, offset);
      }
      if (!isWhiteSpace(ch)) {
        return null;
      }
      start--;
    }
    return text.substring(0, offset);
  }

  function collectCloseTagSuggestions(
    afterOpenBracket: number,
    inOpenTag: boolean,
    tagNameEnd: number = offset
  ): CompletionList {
    const range = getReplaceRange(afterOpenBracket, tagNameEnd);
    const closeTag = isFollowedBy(
      text,
      tagNameEnd,
      ScannerState.WithinEndTag,
      TokenType.EndTagClose
    )
      ? ''
      : '>';
    let curr = node;
    if (inOpenTag) {
      curr = curr.parent; // don't suggest the own tag, it's not yet open
    }
    while (curr) {
      const tag = curr.tag;
      if (tag && (!curr.closed || curr.endTagStart > offset)) {
        const item: CompletionItem = {
          label: '/' + tag,
          kind: CompletionItemKind.Property,
          filterText: '/' + tag + closeTag,
          textEdit: TextEdit.replace(range, '/' + tag + closeTag),
          insertTextFormat: InsertTextFormat.PlainText
        };
        const startIndent = getLineIndent(curr.start);
        const endIndent = getLineIndent(afterOpenBracket - 1);
        if (
          startIndent !== null &&
          endIndent !== null &&
          startIndent !== endIndent
        ) {
          const insertText = startIndent + '</' + tag + closeTag;
          item.textEdit = TextEdit.replace(
            getReplaceRange(afterOpenBracket - 1 - endIndent.length),
            insertText
          );
          item.filterText = endIndent + '</' + tag + closeTag;
        }
        result.items.push(item);
        return result;
      }
      curr = curr.parent;
    }
    if (inOpenTag) {
      return result;
    }

    tagProviders.forEach(provider => {
      provider.collectTags((tag, label) => {
        result.items.push({
          label: '/' + tag,
          kind: CompletionItemKind.Property,
          documentation: label,
          filterText: '/' + tag + closeTag,
          textEdit: TextEdit.replace(range, '/' + tag + closeTag),
          insertTextFormat: InsertTextFormat.PlainText
        });
      });
    });
    return result;
  }

  function collectAutoCloseTagSuggestion(
    tagCloseEnd: number,
    tag: string
  ): CompletionList {
    if (settings && settings.hideAutoCompleteProposals) {
      return result;
    }
    if (!isEmptyElement(tag)) {
      const pos = document.positionAt(tagCloseEnd);
      result.items.push({
        label: '</' + tag + '>',
        kind: CompletionItemKind.Property,
        filterText: '</' + tag + '>',
        textEdit: TextEdit.insert(pos, '$0</' + tag + '>'),
        insertTextFormat: InsertTextFormat.Snippet
      });
    }
    return result;
  }

  function collectTagSuggestions(
    tagStart: number,
    tagEnd: number
  ): CompletionList {
    collectOpenTagSuggestions(tagStart, tagEnd);
    collectCloseTagSuggestions(tagStart, true, tagEnd);
    return result;
  }

  function collectAttributeNameSuggestions(
    nameStart: number,
    nameEnd: number = offset
  ): CompletionList {
    let replaceEnd = offset;
    while (replaceEnd < nameEnd && text[replaceEnd] !== '<') {
      // < is a valid attribute name character, but we rather assume the attribute name ends. See #23236.
      replaceEnd++;
    }
    const range = getReplaceRange(nameStart, replaceEnd);
    const value = isFollowedBy(
      text,
      nameEnd,
      ScannerState.AfterAttributeName,
      TokenType.DelimiterAssign
    )
      ? ''
      : '="$1"';
    const tag = currentTag.toLowerCase();
    tagProviders.forEach(provider => {
      provider.collectAttributes(tag, (attribute, type) => {
        let codeSnippet = attribute;
        if (type !== 'v' && value.length) {
          codeSnippet = codeSnippet + value;
        }
        result.items.push({
          label: attribute,
          kind:
            type === 'handler'
              ? CompletionItemKind.Function
              : CompletionItemKind.Value,
          textEdit: TextEdit.replace(range, codeSnippet),
          insertTextFormat: InsertTextFormat.Snippet
        });
      });
    });
    return result;
  }

  function collectAttributeValueSuggestions(
    valueStart: number,
    valueEnd?: number
  ): CompletionList {
    let range: Range;
    let addQuotes: boolean;
    if (offset > valueStart && offset <= valueEnd && text[valueStart] === '"') {
      // inside attribute
      if (valueEnd > offset && text[valueEnd - 1] === '"') {
        valueEnd--;
      }
      const wsBefore = getWordStart(text, offset, valueStart + 1);
      const wsAfter = getWordEnd(text, offset, valueEnd);
      range = getReplaceRange(wsBefore, wsAfter);
      addQuotes = false;
    } else {
      range = getReplaceRange(valueStart, valueEnd);
      addQuotes = true;
    }
    const tag = currentTag.toLowerCase();
    const attribute = currentAttributeName.toLowerCase();
    tagProviders.forEach(provider => {
      provider.collectValues(tag, attribute, value => {
        const insertText = addQuotes ? '"' + value + '"' : value;
        result.items.push({
          label: value,
          filterText: insertText,
          kind: CompletionItemKind.Unit,
          textEdit: TextEdit.replace(range, insertText),
          insertTextFormat: InsertTextFormat.PlainText
        });
      });
    });
    return result;
  }

  function scanNextForEndPos(nextToken: TokenType): number {
    if (offset === scanner.getTokenEnd()) {
      token = scanner.scan();
      if (token === nextToken && scanner.getTokenOffset() === offset) {
        return scanner.getTokenEnd();
      }
    }
    return offset;
  }

  let token = scanner.scan();

  while (token !== TokenType.EOS && scanner.getTokenOffset() <= offset) {
    switch (token) {
      case TokenType.StartTagOpen:
        if (scanner.getTokenEnd() === offset) {
          const endPos = scanNextForEndPos(TokenType.StartTag);
          return collectTagSuggestions(offset, endPos);
        }
        break;
      case TokenType.StartTag:
        if (
          scanner.getTokenOffset() <= offset &&
          offset <= scanner.getTokenEnd()
        ) {
          return collectOpenTagSuggestions(
            scanner.getTokenOffset(),
            scanner.getTokenEnd()
          );
        }
        currentTag = scanner.getTokenText();
        break;
      case TokenType.AttributeName:
        if (
          scanner.getTokenOffset() <= offset &&
          offset <= scanner.getTokenEnd()
        ) {
          return collectAttributeNameSuggestions(
            scanner.getTokenOffset(),
            scanner.getTokenEnd()
          );
        }
        currentAttributeName = scanner.getTokenText();
        break;
      case TokenType.DelimiterAssign:
        if (scanner.getTokenEnd() === offset) {
          return collectAttributeValueSuggestions(scanner.getTokenEnd());
        }
        break;
      case TokenType.AttributeValue:
        if (
          scanner.getTokenOffset() <= offset &&
          offset <= scanner.getTokenEnd()
        ) {
          return collectAttributeValueSuggestions(
            scanner.getTokenOffset(),
            scanner.getTokenEnd()
          );
        }
        break;
      case TokenType.Whitespace:
        if (offset <= scanner.getTokenEnd()) {
          switch (scanner.getScannerState()) {
            case ScannerState.AfterOpeningStartTag:
              const startPos = scanner.getTokenOffset();
              const endTagPos = scanNextForEndPos(TokenType.StartTag);
              return collectTagSuggestions(startPos, endTagPos);
            case ScannerState.WithinTag:
            case ScannerState.AfterAttributeName:
              return collectAttributeNameSuggestions(scanner.getTokenEnd());
            case ScannerState.BeforeAttributeValue:
              return collectAttributeValueSuggestions(scanner.getTokenEnd());
            case ScannerState.AfterOpeningEndTag:
              return collectCloseTagSuggestions(
                scanner.getTokenOffset() - 1,
                false
              );
          }
        }
        break;
      case TokenType.EndTagOpen:
        if (offset <= scanner.getTokenEnd()) {
          const afterOpenBracket = scanner.getTokenOffset() + 1;
          const endOffset = scanNextForEndPos(TokenType.EndTag);
          return collectCloseTagSuggestions(afterOpenBracket, false, endOffset);
        }
        break;
      case TokenType.EndTag:
        if (offset <= scanner.getTokenEnd()) {
          let start = scanner.getTokenOffset() - 1;
          while (start >= 0) {
            const ch = text.charAt(start);
            if (ch === '/') {
              return collectCloseTagSuggestions(
                start,
                false,
                scanner.getTokenEnd()
              );
            } else if (!isWhiteSpace(ch)) {
              break;
            }
            start--;
          }
        }
        break;
      case TokenType.StartTagClose:
        if (offset <= scanner.getTokenEnd()) {
          if (currentTag) {
            return collectAutoCloseTagSuggestion(
              scanner.getTokenEnd(),
              currentTag
            );
          }
        }
        break;
      default:
        if (offset <= scanner.getTokenEnd()) {
          return result;
        }
        break;
    }
    token = scanner.scan();
  }
  return result;
}

export function doTagComplete(
  document: TextDocument,
  position: Position,
  htmlDocument: HTMLDocument
): string {
  const offset = document.offsetAt(position);
  if (offset <= 0) {
    return;
  }
  const char = document.getText().charAt(offset - 1);
  if (char === '>') {
    const node = htmlDocument.findNodeBefore(offset);
    if (
      node &&
      node.tag &&
      !isEmptyElement(node.tag) &&
      node.start < offset &&
      (!node.endTagStart || node.endTagStart > offset)
    ) {
      const scanner = createScanner(document.getText(), node.start);
      let token = scanner.scan();
      while (token !== TokenType.EOS && scanner.getTokenEnd() <= offset) {
        if (
          token === TokenType.StartTagClose &&
          scanner.getTokenEnd() === offset
        ) {
          return `$0</${node.tag}>`;
        }
        token = scanner.scan();
      }
    }
  } else if (char === '/') {
    let node = htmlDocument.findNodeBefore(offset);
    while (node && node.closed) {
      node = node.parent;
    }
    if (node && node.tag) {
      const scanner = createScanner(document.getText(), node.start);
      let token = scanner.scan();
      while (token !== TokenType.EOS && scanner.getTokenEnd() <= offset) {
        if (
          token === TokenType.EndTagOpen &&
          scanner.getTokenEnd() === offset
        ) {
          return `${node.tag}>`;
        }
        token = scanner.scan();
      }
    }
  }
  return null;
}

function isWhiteSpace(s: string): boolean {
  return /^\s*$/.test(s);
}

function isFollowedBy(
  s: string,
  offset: number,
  intialState: ScannerState,
  expectedToken: TokenType
) {
  const scanner = createScanner(s, offset, intialState);
  let token = scanner.scan();
  while (token === TokenType.Whitespace) {
    token = scanner.scan();
  }
  return token === expectedToken;
}

function getWordStart(s: string, offset: number, limit: number): number {
  while (offset > limit && !isWhiteSpace(s[offset - 1])) {
    offset--;
  }
  return offset;
}

function getWordEnd(s: string, offset: number, limit: number): number {
  while (offset < limit && !isWhiteSpace(s[offset])) {
    offset++;
  }
  return offset;
}
