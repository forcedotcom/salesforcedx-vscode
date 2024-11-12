/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { getCSSLanguageService, Stylesheet } from 'vscode-css-languageservice';
import { Position, TextDocument } from 'vscode-languageserver-types';
import { getLanguageModelCache, LanguageModelCache } from '../languageModelCache';
import { CSS_STYLE_RULE, HTMLDocumentRegions } from './embeddedSupport';
import { ColorInformation, LanguageMode, Settings } from './languageModes';

export const getCSSMode = (documentRegions: LanguageModelCache<HTMLDocumentRegions>): LanguageMode => {
  const cssLanguageService = getCSSLanguageService();
  const embeddedCSSDocuments = getLanguageModelCache<TextDocument>(10, 60, document =>
    documentRegions.get(document).getEmbeddedDocument('css')
  );
  const cssStylesheets = getLanguageModelCache<Stylesheet>(10, 60, document =>
    cssLanguageService.parseStylesheet(document)
  );

  return {
    getId: () => {
      return 'css';
    },
    configure: (options: any) => {
      cssLanguageService.configure(options && options.css);
    },
    doValidation: (document: TextDocument, settings: Settings) => {
      const embedded = embeddedCSSDocuments.get(document);
      return cssLanguageService.doValidation(embedded, cssStylesheets.get(embedded), settings && settings.css);
    },
    doComplete: (document: TextDocument, position: Position) => {
      const embedded = embeddedCSSDocuments.get(document);
      return cssLanguageService.doComplete(embedded, position, cssStylesheets.get(embedded));
    },
    doHover: (document: TextDocument, position: Position) => {
      const embedded = embeddedCSSDocuments.get(document);
      return cssLanguageService.doHover(embedded, position, cssStylesheets.get(embedded));
    },
    findDocumentHighlight: (document: TextDocument, position: Position) => {
      const embedded = embeddedCSSDocuments.get(document);
      return cssLanguageService.findDocumentHighlights(embedded, position, cssStylesheets.get(embedded));
    },
    findDocumentSymbols: (document: TextDocument) => {
      const embedded = embeddedCSSDocuments.get(document);
      return cssLanguageService
        .findDocumentSymbols(embedded, cssStylesheets.get(embedded))
        .filter(s => s.name !== CSS_STYLE_RULE);
    },
    findDefinition: (document: TextDocument, position: Position) => {
      const embedded = embeddedCSSDocuments.get(document);
      return cssLanguageService.findDefinition(embedded, position, cssStylesheets.get(embedded));
    },
    findReferences: (document: TextDocument, position: Position) => {
      const embedded = embeddedCSSDocuments.get(document);
      return cssLanguageService.findReferences(embedded, position, cssStylesheets.get(embedded));
    },
    findDocumentColors: (document: TextDocument) => {
      const embedded = embeddedCSSDocuments.get(document);
      return cssLanguageService.findDocumentColors(embedded, cssStylesheets.get(embedded));
    },
    getColorPresentations: (document: TextDocument, colorInfo: ColorInformation) => {
      const embedded = embeddedCSSDocuments.get(document);
      return cssLanguageService.getColorPresentations(embedded, cssStylesheets.get(embedded), colorInfo);
    },
    onDocumentRemoved: (document: TextDocument) => {
      embeddedCSSDocuments.onDocumentRemoved(document);
      cssStylesheets.onDocumentRemoved(document);
    },
    dispose: () => {
      embeddedCSSDocuments.dispose();
      cssStylesheets.dispose();
    }
  };
};
