/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  DocumentContext,
  getDefaultHTMLDataProvider,
  getLanguageService,
  HTMLDocument,
  LanguageService,
  Position,
  Range,
  TextDocument,
  TokenType
} from 'vscode-html-languageservice';
import { DocumentLink, Hover, MarkedString } from 'vscode-languageserver-types';
import { URI } from 'vscode-uri';
import { visualforceDataProvider } from './visualforceTags';

const dataProviders = [getDefaultHTMLDataProvider(), visualforceDataProvider];

const normalizeReference = (reference: string): string => {
  const first = reference.at(0);
  const last = reference.at(-1);
  return first === last && (first === "'" || first === '"') ? reference.slice(1, -1) : reference;
};

const getBaseLink = (
  languageService: LanguageService,
  document: TextDocument,
  documentContext: DocumentContext
): DocumentLink | undefined => {
  const scanner = languageService.createScanner(document.getText());
  let inBaseTag = false;
  let isHref = false;
  let token = scanner.scan();

  while (token !== TokenType.EOS) {
    if (token === TokenType.StartTag) {
      inBaseTag = scanner.getTokenText().toLowerCase() === 'base';
    } else if (inBaseTag && token === TokenType.AttributeName) {
      isHref = scanner.getTokenText().toLowerCase() === 'href';
    } else if (inBaseTag && isHref && token === TokenType.AttributeValue) {
      const reference = normalizeReference(scanner.getTokenText());
      if (!reference || /^\s*(?:javascript:|#)/i.test(reference) || /[\n\r]/.test(reference)) {
        return undefined;
      }
      const target = documentContext.resolveReference(reference, document.uri);
      try {
        URI.parse(target, true);
      } catch {
        return undefined;
      }
      const quoteOffset = reference.length < scanner.getTokenLength() ? 1 : 0;
      return {
        range: Range.create(
          document.positionAt(scanner.getTokenOffset() + quoteOffset),
          document.positionAt(scanner.getTokenEnd() - quoteOffset)
        ),
        target
      };
    }
    token = scanner.scan();
  }
  return undefined;
};

const preserveTagLabel = (
  languageService: LanguageService,
  document: TextDocument,
  position: Position,
  htmlDocument: HTMLDocument
): Hover | undefined => {
  const hover = languageService.doHover(document, position, htmlDocument);
  if (!hover) {
    return undefined;
  }

  const offset = document.offsetAt(position);
  const node = htmlDocument.findNodeAt(offset);
  const canonicalTag = dataProviders
    .flatMap(provider => (provider.isApplicable(document.languageId) ? provider.provideTags() : []))
    .find(tag => tag.name.toLowerCase() === node?.tag?.toLowerCase())?.name;
  if (!canonicalTag) {
    return hover;
  }

  const closingTag = node?.endTagStart !== undefined && offset >= node.endTagStart;
  const tagLabel = closingTag ? `</${canonicalTag}>` : `<${canonicalTag}>`;
  const documentation = Array.isArray(hover.contents)
    ? hover.contents.map(content => (typeof content === 'string' ? content : content.value)).join('\n\n')
    : typeof hover.contents === 'string'
      ? hover.contents
      : hover.contents.value;
  return {
    contents: [{ language: 'html', value: tagLabel }, MarkedString.fromPlainText(documentation)],
    range: hover.range
  };
};

/** HTML language service configured for Visualforce while preserving the prior user-visible behavior. */
export const getVisualforceHtmlLanguageService = (): LanguageService => {
  const languageService = getLanguageService({ customDataProviders: [visualforceDataProvider] });
  return {
    ...languageService,
    doHover: (document, position, htmlDocument) => preserveTagLabel(languageService, document, position, htmlDocument),
    findDocumentLinks: (document, documentContext) => {
      const links = languageService
        .findDocumentLinks(document, documentContext)
        .filter(link => !/^\s*['"]?#/.test(document.getText(link.range)));
      const baseLink = getBaseLink(languageService, document, documentContext);
      return (baseLink ? [...links, baseLink] : links).toSorted(
        (left, right) => document.offsetAt(left.range.start) - document.offsetAt(right.range.start)
      );
    }
  };
};
