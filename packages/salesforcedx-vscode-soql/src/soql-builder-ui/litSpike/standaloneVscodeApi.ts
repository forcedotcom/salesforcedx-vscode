/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlEditorEvent } from '../modules/querybuilder/services/message/soqlEditorEvent';
import type { JsonMap } from '@salesforce/ts-types';

type VscodeApi = {
  getState(): JsonMap | undefined;
  postMessage(message: SoqlEditorEvent): void;
  setState(state: JsonMap): void;
};

declare global {
  var acquireVsCodeApi: (() => VscodeApi) | undefined;
}

const standaloneObjects = ['Account', 'Contact', 'Opportunity'];
const standaloneFields: Record<string, string[]> = {
  Account: ['Id', 'Name', 'Industry', 'Type'],
  Contact: ['Id', 'Name', 'Email', 'AccountId'],
  Opportunity: ['Id', 'Name', 'Amount', 'StageName']
};

const dispatchToWebview = (event: SoqlEditorEvent): void => {
  window.setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: event })), 0);
};

/**
 * Makes the spike directly previewable in a browser while leaving the real
 * acquireVsCodeApi implementation untouched inside a VS Code webview.
 */
export const installStandaloneVscodeApi = (): void => {
  if (typeof globalThis.acquireVsCodeApi === 'function') {
    return;
  }

  let state: JsonMap | undefined;
  const api: VscodeApi = {
    getState: () => state,
    setState: newState => {
      state = newState;
    },
    postMessage: message => {
      switch (message.type) {
        case 'ui_activated':
          dispatchToWebview({ type: 'text_soql_changed', payload: '' });
          break;
        case 'sobjects_request':
          dispatchToWebview({ type: 'sobjects_response', payload: standaloneObjects });
          break;
        case 'sobject_metadata_request': {
          const fieldNames = standaloneFields[message.payload] ?? [];
          dispatchToWebview({
            type: 'sobject_metadata_response',
            payload: { fields: fieldNames.map(name => ({ name, type: 'string', nillable: true, picklistValues: [] })) }
          });
          break;
        }
        default:
          break;
      }
    }
  };

  globalThis.acquireVsCodeApi = () => api;
};
