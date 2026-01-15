/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { JsonMap } from '@salesforce/ts-types';
import { BehaviorSubject } from 'rxjs';
import { getLocalStorage, getWindow } from '../globals';
import { IMessageService } from './iMessageService';
import { MessageType, SoqlEditorEvent } from './soqlEditorEvent';
import { VscodeMessageService } from './vscodeMessageService';

class MockVscode {
  private window = getWindow();
  private localStorage = getLocalStorage();
  public postMessage(messageObj): void {
    this.window.parent.postMessage(messageObj, '*');
  }
  public getState(): JsonMap {
    const state = this.localStorage.getItem('query');
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(state);
    } catch (e) {
      this.localStorage.clear();
      // eslint-disable-next-line no-console
      console.warn('state can not be parsed');
    }
    return state;
  }

  public setState(state: JsonMap): void {
    this.localStorage.setItem('query', JSON.stringify(state));
  }
}

export class StandaloneMessageService
  extends VscodeMessageService
  implements IMessageService
{
  public messagesToUI: BehaviorSubject<SoqlEditorEvent>;
  public localStorage;
  protected vscode;
  public constructor() {
    super();
    this.localStorage = getLocalStorage();
  }

  public sendActivatedMessage(): void {
    this.vscode = new MockVscode();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
    this.vscode.postMessage({ type: MessageType.UI_ACTIVATED });
  }
}
