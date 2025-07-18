/* eslint-disable no-param-reassign */

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { LanguageService, TokenType } from '@salesforce/salesforcedx-visualforce-markup-language-server';
import { Position, Range, TextDocument } from 'vscode-languageserver-types';

type LanguageRange = Range & {
  languageId: string;
  attributeValue?: boolean;
};

export type HTMLDocumentRegions = {
  getEmbeddedDocument(languageId: string, ignoreAttributeValues?: boolean): TextDocument;
  getLanguageRanges(range: Range): LanguageRange[];
  getLanguageAtPosition(position: Position): string;
  getLanguagesInDocument(): string[];
  getImportedScripts(): string[];
};

export const CSS_STYLE_RULE = '__';

type EmbeddedRegion = {
  languageId: string;
  start: number;
  end: number;
  attributeValue?: boolean;
};

export const getDocumentRegions = (languageService: LanguageService, document: TextDocument): HTMLDocumentRegions => {
  const regions: EmbeddedRegion[] = [];
  const scanner = languageService.createScanner(document.getText());
  let lastTagName: string;
  let lastAttributeName: string;
  let languageIdFromType: string;
  const importedScripts: string[] = [];

  let token = scanner.scan();
  while (token !== TokenType.EOS) {
    switch (token) {
      case TokenType.StartTag:
        lastTagName = scanner.getTokenText();
        lastAttributeName = null;
        languageIdFromType = 'javascript';
        break;
      case TokenType.Styles:
        regions.push({
          languageId: 'css',
          start: scanner.getTokenOffset(),
          end: scanner.getTokenEnd()
        });
        break;
      case TokenType.Script:
        regions.push({
          languageId: languageIdFromType,
          start: scanner.getTokenOffset(),
          end: scanner.getTokenEnd()
        });
        break;
      case TokenType.AttributeName:
        lastAttributeName = scanner.getTokenText();
        break;
      case TokenType.AttributeValue:
        if (lastAttributeName === 'src' && lastTagName.toLowerCase() === 'script') {
          let value = scanner.getTokenText();
          if (value[0] === "'" || value[0] === '"') {
            value = value.substr(1, value.length - 1);
          }
          importedScripts.push(value);
        } else if (lastAttributeName === 'type' && lastTagName.toLowerCase() === 'script') {
          if (/["'](module|(text|application)\/(java|ecma)script)["']/.test(scanner.getTokenText())) {
            languageIdFromType = 'javascript';
          } else {
            languageIdFromType = void 0;
          }
        } else {
          const attributeLanguageId = getAttributeLanguage(lastAttributeName);
          if (attributeLanguageId) {
            let start = scanner.getTokenOffset();
            let end = scanner.getTokenEnd();
            const firstChar = document.getText()[start];
            if (firstChar === "'" || firstChar === '"') {
              start++;
              end--;
            }
            regions.push({
              languageId: attributeLanguageId,
              start,
              end,
              attributeValue: true
            });
          }
        }
        lastAttributeName = null;
        break;
    }
    token = scanner.scan();
  }
  return {
    getLanguageRanges: (range: Range) => getLanguageRanges(document, regions, range),
    getEmbeddedDocument: (languageId: string, ignoreAttributeValues: boolean) =>
      getEmbeddedDocument(document, regions, languageId, ignoreAttributeValues),
    getLanguageAtPosition: (position: Position) => getLanguageAtPosition(document, regions, position),
    getLanguagesInDocument: () => getLanguagesInDocument(document, regions),
    getImportedScripts: () => importedScripts
  };
};
const getLanguageRanges = (document: TextDocument, regions: EmbeddedRegion[], range: Range): LanguageRange[] => {
  const result: LanguageRange[] = [];
  let currentPos = range ? range.start : Position.create(0, 0);
  let currentOffset = range ? document.offsetAt(range.start) : 0;
  const endOffset = range ? document.offsetAt(range.end) : document.getText().length;
  for (const region of regions) {
    if (region.end > currentOffset && region.start < endOffset) {
      const start = Math.max(region.start, currentOffset);
      const startPos = document.positionAt(start);
      if (currentOffset < region.start) {
        result.push({
          start: currentPos,
          end: startPos,
          languageId: 'html'
        });
      }
      const end = Math.min(region.end, endOffset);
      const endPos = document.positionAt(end);
      if (end > region.start) {
        result.push({
          start: startPos,
          end: endPos,
          languageId: region.languageId,
          attributeValue: region.attributeValue
        });
      }
      currentOffset = end;
      currentPos = endPos;
    }
  }
  if (currentOffset < endOffset) {
    const endPos = range ? range.end : document.positionAt(endOffset);
    result.push({
      start: currentPos,
      end: endPos,
      languageId: 'html'
    });
  }
  return result;
};

const getLanguagesInDocument = (document: TextDocument, regions: EmbeddedRegion[]): string[] => {
  const result: string[] = [];
  for (const region of regions) {
    if (region.languageId && !result.includes(region.languageId)) {
      result.push(region.languageId);
      if (result.length === 3) {
        return result;
      }
    }
  }
  result.push('html');
  return result;
};

const getLanguageAtPosition = (document: TextDocument, regions: EmbeddedRegion[], position: Position): string => {
  const offset = document.offsetAt(position);
  for (const region of regions) {
    if (region.start <= offset) {
      if (offset <= region.end) {
        return region.languageId;
      }
    } else {
      break;
    }
  }
  return 'html';
};

const getEmbeddedDocument = (
  document: TextDocument,
  contents: EmbeddedRegion[],
  languageId: string,
  ignoreAttributeValues: boolean
): TextDocument => {
  let currentPos = 0;
  const oldContent = document.getText();
  let result = '';
  let lastSuffix = '';
  for (const c of contents) {
    if (c.languageId === languageId && (!ignoreAttributeValues || !c.attributeValue)) {
      result = substituteWithWhitespace(result, currentPos, c.start, oldContent, lastSuffix, getPrefix(c));
      result += oldContent.substring(c.start, c.end);
      currentPos = c.end;
      lastSuffix = getSuffix(c);
    }
  }
  result = substituteWithWhitespace(result, currentPos, oldContent.length, oldContent, lastSuffix, '');
  return TextDocument.create(document.uri, languageId, document.version, result);
};

const getPrefix = (c: EmbeddedRegion) => {
  if (c.attributeValue) {
    switch (c.languageId) {
      case 'css':
        return `${CSS_STYLE_RULE}{`;
    }
  }
  return '';
};

const getSuffix = (c: EmbeddedRegion) => {
  if (c.attributeValue) {
    switch (c.languageId) {
      case 'css':
        return '}';
      case 'javascript':
        return ';';
    }
  }
  return '';
};

const substituteWithWhitespace = (
  result: string,
  start: number,
  end: number,
  oldContent: string,
  before: string,
  after: string
) => {
  let accumulatedWS = 0;
  result += before;
  for (let i = start + before.length; i < end; i++) {
    const ch = oldContent[i];
    if (ch === '\n' || ch === '\r') {
      // only write new lines, skip the whitespace
      accumulatedWS = 0;
      result += ch;
    } else {
      accumulatedWS++;
    }
  }
  result = append(result, ' ', accumulatedWS - after.length);
  result += after;
  return result;
};

const append = (result: string, str: string, n: number): string => {
  while (n > 0) {
    if (n & 1) {
      result += str;
    }
    n >>= 1;
    str += str;
  }
  return result;
};

const getAttributeLanguage = (attributeName: string): string => {
  const match = attributeName.match(/^(style)$|^(on\w+)$/i);
  if (!match) {
    return null;
  }
  return match[1] ? 'css' : 'javascript';
};
