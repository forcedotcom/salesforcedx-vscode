/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { BehaviorSubject, Observable } from 'rxjs';
import { IMessageService } from './message/iMessageService';
import { MessageType, SoqlEditorEvent } from './message/soqlEditorEvent';

export class ToolingSDK {
  public sobjects: Observable = new BehaviorSubject<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public sobjectMetadata: Observable = new BehaviorSubject<any>({ fields: [] });
  public queryRunState: Observable<boolean> = new BehaviorSubject<boolean>(
    false
  );
  private messageService: IMessageService;
  private latestSObjectName?: string;

  public constructor(messageService: IMessageService) {
    this.messageService = messageService;
    this.messageService.messagesToUI.subscribe(this.onMessage.bind(this));
  }

  public loadSObjectDefinitions(): void {
    this.messageService.sendMessage({ type: MessageType.SOBJECTS_REQUEST });
  }

  public loadSObjectMetatada(sobjectName: string): void {
    this.latestSObjectName = sobjectName;
    this.messageService.sendMessage({
      type: MessageType.SOBJECT_METADATA_REQUEST,
      payload: sobjectName
    });
  }

  private onMessage(event: SoqlEditorEvent): void {
    if (event && event.type) {
      switch (event.type) {
        case MessageType.SOBJECTS_RESPONSE: {
          this.sobjects.next(event.payload as string[]);
          break;
        }
        case MessageType.SOBJECT_METADATA_RESPONSE: {
          this.sobjectMetadata.next(event.payload);
          break;
        }
        case MessageType.CONNECTION_CHANGED: {
          this.loadSObjectDefinitions();
          if (this.latestSObjectName) {
            this.loadSObjectMetatada(this.latestSObjectName);
          }
          break;
        }
        case MessageType.RUN_SOQL_QUERY_DONE: {
          this.queryRunState.next(false);
          break;
        }
        default:
          break;
      }
    }
  }
}
