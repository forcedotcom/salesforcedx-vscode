/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { getVscode } from '../globals';
import { MessageService, IMessageService } from './iMessageService';
import { MessageType, SoqlEditorEventSchema, type SoqlEditorEvent } from './soqlEditorEvent';

export type VscodeMessageService = IMessageService & {
  readonly dispose: () => void;
};

const isSoqlEditorEvent = Schema.is(SoqlEditorEventSchema);

export const makeVscodeMessageService = (): VscodeMessageService => {
  const vscode = getVscode();
  const listeners: ((event: SoqlEditorEvent) => void)[] = [];

  const handleWindowMessage = (e: MessageEvent): void => {
    const data: unknown = e.data;
    if (isSoqlEditorEvent(data)) {
      listeners.forEach(listener => listener(data));
    }
  };
  window.addEventListener('message', handleWindowMessage);

  vscode.postMessage({ type: MessageType.UI_ACTIVATED });

  const onMessage = (listener: (event: SoqlEditorEvent) => void): (() => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  };

  const sendMessage = (event: SoqlEditorEvent): void => {
    vscode.postMessage(event);
  };

  const setState = (state: unknown): void => {
    vscode.setState(state);
  };

  const getState = (): unknown => vscode.getState();

  const dispose = (): void => {
    window.removeEventListener('message', handleWindowMessage);
    listeners.length = 0;
  };

  return { onMessage, sendMessage, setState, getState, dispose };
};

export const VscodeMessageServiceLive: Layer.Layer<MessageService> = Layer.scoped(
  MessageService,
  Effect.acquireRelease(
    Effect.sync(() => makeVscodeMessageService()),
    service => Effect.sync(() => service.dispose())
  )
);
