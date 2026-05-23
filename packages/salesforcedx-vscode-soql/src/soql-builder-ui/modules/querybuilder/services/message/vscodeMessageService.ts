/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { Layer } from 'effect';
import { JsonMap } from '@salesforce/ts-types';
import { getVscode } from '../globals';
import { MessageService, IMessageService } from './iMessageService';
import { SoqlEditorEvent, MessageType } from './soqlEditorEvent';

export const makeVscodeMessageService = (): IMessageService => {
  const vscode = getVscode() as { postMessage(msg: unknown): void; getState(): unknown; setState(s: unknown): void };
  const listeners: Array<(event: SoqlEditorEvent) => void> = [];

  window.addEventListener('message', (e: MessageEvent) => {
    const data = e.data as SoqlEditorEvent;
    if (data?.type !== undefined) {
      listeners.map(l => l(data));
    }
  });

  vscode.postMessage({ type: MessageType.UI_ACTIVATED });

  const onMessage = (listener: (event: SoqlEditorEvent) => void): void => {
    listeners.push(listener);
  };

  const sendMessage = (event: SoqlEditorEvent): void => {
    vscode.postMessage(event);
  };

  const setState = (state: JsonMap): void => {
    vscode.setState(state);
  };

  const getState = (): JsonMap => {
    return vscode.getState() as JsonMap;
  };

  return { onMessage, sendMessage, setState, getState };
};

export const VscodeMessageServiceLive: Layer.Layer<MessageService> = Layer.sync(
  MessageService,
  () => makeVscodeMessageService()
);
