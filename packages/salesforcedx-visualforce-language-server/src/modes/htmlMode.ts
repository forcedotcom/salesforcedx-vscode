/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  DocumentContext,
  FormattingOptions,
  HTMLDocument,
  HTMLFormatConfiguration,
  LanguageService as HTMLLanguageService
} from 'vscode-html-languageservice';
import {
  CompletionItem,
  FoldingRange,
  Position,
  Range,
  TextDocument
} from 'vscode-languageserver-types';
import { getLanguageModelCache } from '../languageModelCache';
import { LanguageMode, Workspace } from './languageModes';
import { getPathCompletionParticipant } from './pathCompletion';

export function getHTMLMode(
  htmlLanguageService: HTMLLanguageService,
  workspace: Workspace
): LanguageMode {
  const htmlDocuments = getLanguageModelCache<HTMLDocument>(10, 60, document =>
    htmlLanguageService.parseHTMLDocument(document)
  );
  return {
    getId() {
      return 'html';
    },
    doSelection(document: TextDocument, position: Position): Range[] {
      return htmlLanguageService.getSelectionRanges(document, position);
    },
    doComplete(
      document: TextDocument,
      position: Position,
      settings = workspace.settings
    ) {
      const options = settings && settings.html && settings.html.suggest;
      const doAutoComplete =
        settings && settings.html && settings.html.autoClosingTags;
      if (doAutoComplete) {
        options.hideAutoCompleteProposals = true;
      }
      const pathCompletionProposals: CompletionItem[] = [];
      const participants = [
        getPathCompletionParticipant(
          document,
          workspace.folders,
          pathCompletionProposals
        )
      ];
      htmlLanguageService.setCompletionParticipants(participants);

      const htmlDocument = htmlDocuments.get(document);
      const completionList = htmlLanguageService.doComplete(
        document,
        position,
        htmlDocument,
        options
      );
      completionList.items.push(...pathCompletionProposals);
      return completionList;
    },
    doHover(document: TextDocument, position: Position) {
      return htmlLanguageService.doHover(
        document,
        position,
        htmlDocuments.get(document)
      );
    },
    findDocumentHighlight(document: TextDocument, position: Position) {
      return htmlLanguageService.findDocumentHighlights(
        document,
        position,
        htmlDocuments.get(document)
      );
    },
    findDocumentLinks(
      document: TextDocument,
      documentContext: DocumentContext
    ) {
      return htmlLanguageService.findDocumentLinks(document, documentContext);
    },
    findDocumentSymbols(document: TextDocument) {
      return htmlLanguageService.findDocumentSymbols(
        document,
        htmlDocuments.get(document)
      );
    },
    format(
      document: TextDocument,
      range: Range,
      formatParams: FormattingOptions,
      settings = workspace.settings
    ) {
      let formatSettings: HTMLFormatConfiguration =
        settings && settings.html && settings.html.format;
      if (formatSettings) {
        formatSettings = merge(formatSettings, {});
      } else {
        formatSettings = {};
      }
      if (formatSettings.contentUnformatted) {
        formatSettings.contentUnformatted =
          formatSettings.contentUnformatted + ',script';
      } else {
        formatSettings.contentUnformatted = 'script';
      }
      formatSettings = merge(formatParams, formatSettings);
      return htmlLanguageService.format(document, range, formatSettings);
    },
    getFoldingRanges(document: TextDocument): FoldingRange[] {
      return htmlLanguageService.getFoldingRanges(document);
    },
    doAutoClose(document: TextDocument, position: Position) {
      const offset = document.offsetAt(position);
      const text = document.getText();
      if (offset > 0 && text.charAt(offset - 1).match(/[>\/]/g)) {
        return htmlLanguageService.doTagComplete(
          document,
          position,
          htmlDocuments.get(document)
        );
      }
      return null;
    },
    onDocumentRemoved(document: TextDocument) {
      htmlDocuments.onDocumentRemoved(document);
    },
    dispose() {
      htmlDocuments.dispose();
    }
  };
}

function merge(src: any, dst: any): any {
  for (const key in src) {
    if (src.hasOwnProperty(key)) {
      dst[key] = src[key];
    }
  }
  return dst;
}
