/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { Context } from 'effect';
import { JsonMap } from '@salesforce/ts-types';
import { SoqlEditorEvent } from './soqlEditorEvent';

export type IMessageService = {
  onMessage(listener: (event: SoqlEditorEvent) => void): void;
  sendMessage(message: SoqlEditorEvent): void;
  setState(state: JsonMap): void;
  getState(): JsonMap;
};

export class MessageService extends Context.Tag('MessageService')<
  MessageService,
  IMessageService
>() {}
