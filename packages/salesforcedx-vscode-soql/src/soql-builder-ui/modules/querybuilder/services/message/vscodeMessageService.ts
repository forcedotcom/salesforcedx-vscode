/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { JsonMap } from '@salesforce/ts-types';
import { fromEvent, Observable } from 'rxjs';
import { filter, pluck } from 'rxjs/operators';
import { getWindow, getVscode } from '../globals';
import { IMessageService } from './iMessageService';
import { SoqlEditorEvent, MessageType } from './soqlEditorEvent';

export class VscodeMessageService implements IMessageService {
  public messagesToUI: Observable<SoqlEditorEvent>;

  protected vscode;

  public constructor() {
    this.vscode = getVscode();
    const source = fromEvent(getWindow(), 'message');
    this.messagesToUI = source.pipe(
      this.onlyDataProperty(),
      this.onlyIfValidEditorEvent()
    );
    this.sendActivatedMessage();
  }

  public sendActivatedMessage(): void {
    this.vscode.postMessage({ type: MessageType.UI_ACTIVATED });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async sendMessage(event: SoqlEditorEvent): Promise<void> {
    this.vscode.postMessage(event);
  }

  public sendTelemetry(telemetry: JSON): void {
    this.vscode.postMessage({
      type: MessageType.UI_TELEMETRY,
      payload: telemetry
    });
  }

  public getState(): unknown {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const state = this.vscode.getState();
    return state;
  }

  public setState(state: JsonMap): void {
    this.vscode.setState(state);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private onlyDataProperty() {
    return pluck('data');
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private onlyIfValidEditorEvent() {
    return filter((event: SoqlEditorEvent) => {
      return event.type !== undefined;
    });
  }
}
