/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TextDocument } from 'vscode-languageserver';

export type LanguageModelCache<T> = {
  get(document: TextDocument): T;
  onDocumentRemoved(document: TextDocument): void;
  dispose(): void;
};

export const getLanguageModelCache = <T>(
  maxEntries: number,
  cleanupIntervalTimeInSec: number,
  parse: (document: TextDocument) => T
): LanguageModelCache<T> => {
  let languageModels: {
    [uri: string]: {
      version: number;
      languageId: string;
      cTime: number;
      languageModel: T;
    };
  } = {};
  let nModels = 0;

  let cleanupInterval = void 0;
  if (cleanupIntervalTimeInSec > 0) {
    cleanupInterval = setInterval(() => {
      const cutoffTime = Date.now() - cleanupIntervalTimeInSec * 1000;
      const uris = Object.keys(languageModels);
      for (const uri of uris) {
        const languageModelInfo = languageModels[uri];
        if (languageModelInfo.cTime < cutoffTime) {
          delete languageModels[uri];
          nModels--;
        }
      }
    }, cleanupIntervalTimeInSec * 1000);
  }

  return {
    get: (document: TextDocument): T => {
      const version = document.version;
      const languageId = document.languageId;
      const languageModelInfo = languageModels[document.uri];
      if (languageModelInfo && languageModelInfo.version === version && languageModelInfo.languageId === languageId) {
        languageModelInfo.cTime = Date.now();
        return languageModelInfo.languageModel;
      }
      const languageModel = parse(document);
      languageModels[document.uri] = {
        languageModel,
        version,
        languageId,
        cTime: Date.now()
      };
      if (!languageModelInfo) {
        nModels++;
      }

      if (nModels === maxEntries) {
        let oldestTime = Number.MAX_VALUE;
        let oldestUri = null;
        for (const uri in languageModels) {
          const localLanguageModelInfo = languageModels[uri];
          if (localLanguageModelInfo.cTime < oldestTime) {
            oldestUri = uri;
            oldestTime = localLanguageModelInfo.cTime;
          }
        }
        if (oldestUri) {
          delete languageModels[oldestUri];
          nModels--;
        }
      }
      return languageModel;
    },
    onDocumentRemoved: (document: TextDocument) => {
      const uri = document.uri;
      if (languageModels[uri]) {
        delete languageModels[uri];
        nModels--;
      }
    },
    dispose: () => {
      if (cleanupInterval !== undefined) {
        clearInterval(cleanupInterval);
        cleanupInterval = void 0;
        languageModels = {};
        nModels = 0;
      }
    }
  };
};
