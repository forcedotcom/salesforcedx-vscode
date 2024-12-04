/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  DocumentContext,
  FormattingOptions,
  HTMLDocument,
  HTMLFormatConfiguration,
  LanguageService as HTMLLanguageService
} from '@salesforce/salesforcedx-visualforce-markup-language-server';
import { Position, Range, TextDocument } from 'vscode-languageserver-types';
import { getLanguageModelCache } from '../languageModelCache';
import { LanguageMode, Settings } from './languageModes';

export const getHTMLMode = (htmlLanguageService: HTMLLanguageService): LanguageMode => {
  let globalSettings: Settings = {};
  const htmlDocuments = getLanguageModelCache<HTMLDocument>(10, 60, document =>
    htmlLanguageService.parseHTMLDocument(document)
  );
  return {
    getId: () => {
      return 'html';
    },
    configure: (options: any) => {
      globalSettings = options;
    },
    doComplete: (document: TextDocument, position: Position, settings: Settings = globalSettings) => {
      const options = settings && settings.visualforce && settings.visualforce.suggest;
      const doAutoComplete = settings && settings.visualforce && settings.visualforce.autoClosingTags;
      if (doAutoComplete) {
        options.hideAutoCompleteProposals = true;
      }
      return htmlLanguageService.doComplete(document, position, htmlDocuments.get(document), options);
    },
    doHover: (document: TextDocument, position: Position) => {
      return htmlLanguageService.doHover(document, position, htmlDocuments.get(document));
    },
    findDocumentHighlight: (document: TextDocument, position: Position) => {
      return htmlLanguageService.findDocumentHighlights(document, position, htmlDocuments.get(document));
    },
    findDocumentLinks: (document: TextDocument, documentContext: DocumentContext) => {
      return htmlLanguageService.findDocumentLinks(document, documentContext);
    },
    findDocumentSymbols: (document: TextDocument) => {
      return htmlLanguageService.findDocumentSymbols(document, htmlDocuments.get(document));
    },
    format: (
      document: TextDocument,
      range: Range,
      formatParams: FormattingOptions,
      settings: Settings = globalSettings
    ) => {
      let formatSettings: HTMLFormatConfiguration = settings && settings.visualforce && settings.visualforce.format;
      if (formatSettings) {
        formatSettings = merge(formatSettings, {});
      } else {
        formatSettings = {};
      }
      if (formatSettings.contentUnformatted) {
        formatSettings.contentUnformatted = formatSettings.contentUnformatted + ',script';
      } else {
        formatSettings.contentUnformatted = 'script';
      }
      formatSettings = merge(formatParams, formatSettings);
      return htmlLanguageService.format(document, range, formatSettings);
    },
    doAutoClose: (document: TextDocument, position: Position) => {
      const offset = document.offsetAt(position);
      const text = document.getText();
      if (offset > 0 && text.charAt(offset - 1).match(/[>\/]/g)) {
        return htmlLanguageService.doTagComplete(document, position, htmlDocuments.get(document));
      }
      return null;
    },
    onDocumentRemoved: (document: TextDocument) => {
      htmlDocuments.onDocumentRemoved(document);
    },
    dispose: () => {
      htmlDocuments.dispose();
    }
  };
};

const merge = (src: any, dst: any): any => {
  for (const key in src) {
    if (src.hasOwnProperty(key)) {
      dst[key] = src[key];
    }
  }
  return dst;
};
