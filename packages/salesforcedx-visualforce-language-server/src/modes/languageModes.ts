/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {
  DocumentContext,
  getLanguageService as getHTMLLanguageService
} from '@salesforce/salesforcedx-visualforce-markup-language-server';
import {
  CompletionItem,
  CompletionList,
  Definition,
  Diagnostic,
  DocumentHighlight,
  DocumentLink,
  FormattingOptions,
  Hover,
  Location,
  Position,
  Range,
  SignatureHelp,
  SymbolInformation,
  TextDocument,
  TextEdit
} from 'vscode-languageserver-types';

import {
  ColorInformation,
  ColorPresentation
} from 'vscode-languageserver-protocol/lib/protocol.colorProvider.proposed';

import {
  getLanguageModelCache,
  LanguageModelCache
} from '../languageModelCache';
import { getCSSMode } from './cssMode';
import { getDocumentRegions, HTMLDocumentRegions } from './embeddedSupport';
import { getHTMLMode } from './htmlMode';
import { getJavascriptMode } from './javascriptMode';

// tslint:disable:forin

export { ColorInformation, ColorPresentation };

export interface Settings {
  css?: any;
  visualforce?: any;
  javascript?: any;
}

export interface SettingProvider {
  getDocumentSettings(textDocument: TextDocument): Thenable<Settings>;
}

export interface LanguageMode {
  configure?: (options: Settings) => void;
  doValidation?: (document: TextDocument, settings?: Settings) => Diagnostic[];
  doComplete?: (
    document: TextDocument,
    position: Position,
    settings?: Settings
  ) => CompletionList;
  doResolve?: (document: TextDocument, item: CompletionItem) => CompletionItem;
  doHover?: (document: TextDocument, position: Position) => Hover;
  doSignatureHelp?: (
    document: TextDocument,
    position: Position
  ) => SignatureHelp;
  findDocumentHighlight?: (
    document: TextDocument,
    position: Position
  ) => DocumentHighlight[];
  findDocumentSymbols?: (document: TextDocument) => SymbolInformation[];
  findDocumentLinks?: (
    document: TextDocument,
    documentContext: DocumentContext
  ) => DocumentLink[];
  findDefinition?: (document: TextDocument, position: Position) => Definition;
  findReferences?: (document: TextDocument, position: Position) => Location[];
  format?: (
    document: TextDocument,
    range: Range,
    options: FormattingOptions,
    settings: Settings
  ) => TextEdit[];
  findDocumentColors?: (document: TextDocument) => ColorInformation[];
  getColorPresentations?: (
    document: TextDocument,
    colorInfo: ColorInformation
  ) => ColorPresentation[];
  doAutoClose?: (document: TextDocument, position: Position) => string;
  getId();
  dispose(): void;
  onDocumentRemoved(document: TextDocument): void;
}

export interface LanguageModes {
  getModeAtPosition(document: TextDocument, position: Position): LanguageMode;
  getModesInRange(document: TextDocument, range: Range): LanguageModeRange[];
  getAllModes(): LanguageMode[];
  getAllModesInDocument(document: TextDocument): LanguageMode[];
  getMode(languageId: string): LanguageMode;
  onDocumentRemoved(document: TextDocument): void;
  dispose(): void;
}

export interface LanguageModeRange extends Range {
  mode: LanguageMode;
  attributeValue?: boolean;
}

export function getLanguageModes(supportedLanguages: {
  [languageId: string]: boolean;
}): LanguageModes {
  const htmlLanguageService = getHTMLLanguageService();
  const documentRegions = getLanguageModelCache<
    HTMLDocumentRegions
  >(10, 60, document => getDocumentRegions(htmlLanguageService, document));

  let modelCaches: Array<LanguageModelCache<any>> = [];
  modelCaches.push(documentRegions);

  let modes = {};
  modes['html'] = getHTMLMode(htmlLanguageService);
  if (supportedLanguages['css']) {
    modes['css'] = getCSSMode(documentRegions);
  }
  if (supportedLanguages['javascript']) {
    modes['javascript'] = getJavascriptMode(documentRegions);
  }
  return {
    getModeAtPosition(
      document: TextDocument,
      position: Position
    ): LanguageMode {
      const languageId = documentRegions
        .get(document)
        .getLanguageAtPosition(position);
      if (languageId) {
        return modes[languageId];
      }
      return null;
    },
    getModesInRange(document: TextDocument, range: Range): LanguageModeRange[] {
      return documentRegions
        .get(document)
        .getLanguageRanges(range)
        .map(r => {
          return {
            start: r.start,
            end: r.end,
            mode: modes[r.languageId],
            attributeValue: r.attributeValue
          };
        });
    },
    getAllModesInDocument(document: TextDocument): LanguageMode[] {
      const result = [];
      for (const languageId of documentRegions
        .get(document)
        .getLanguagesInDocument()) {
        const mode = modes[languageId];
        if (mode) {
          result.push(mode);
        }
      }
      return result;
    },
    getAllModes(): LanguageMode[] {
      const result = [];
      for (const languageId in modes) {
        const mode = modes[languageId];
        if (mode) {
          result.push(mode);
        }
      }
      return result;
    },
    getMode(languageId: string): LanguageMode {
      return modes[languageId];
    },
    onDocumentRemoved(document: TextDocument) {
      modelCaches.forEach(mc => mc.onDocumentRemoved(document));
      for (const mode in modes) {
        modes[mode].onDocumentRemoved(document);
      }
    },
    dispose(): void {
      modelCaches.forEach(mc => mc.dispose());
      modelCaches = [];
      for (const mode in modes) {
        modes[mode].dispose();
      }
      modes = {};
    }
  };
}
