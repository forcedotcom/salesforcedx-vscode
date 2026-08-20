/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import { SoqlEditorEvent } from './soqlEditorEvent';

export type IMessageService = {
  onMessage(listener: (event: SoqlEditorEvent) => void): () => void;
  sendMessage(message: SoqlEditorEvent): void;
  setState(state: unknown): void;
  getState(): unknown;
};

export class MessageService extends Context.Tag('MessageService')<
  MessageService,
  IMessageService
>() {}
