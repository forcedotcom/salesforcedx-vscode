/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { Observable } from 'rxjs';
import { JsonMap } from '@salesforce/ts-types';
import { SoqlEditorEvent } from './soqlEditorEvent';

export interface IMessageService {
  messagesToUI: Observable<SoqlEditorEvent>;
  sendMessage(message: SoqlEditorEvent): void;
  setState(state: JsonMap): void;
  getState(): JsonMap;
}
