/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, track } from 'lwc';
import { JsonMap } from '@salesforce/ts-types';
import { ToolingSDK } from '../services/toolingSDK';
import { MessageServiceFactory } from '../services/message/messageServiceFactory';

import { ToolingModelService } from '../services/toolingModelService';
import { IMessageService } from '../services/message/iMessageService';
import {
  MessageType,
  SoqlEditorEvent
} from '../services/message/soqlEditorEvent';
import {
  recoverableErrors,
  recoverableFieldErrors,
  recoverableFromErrors,
  recoverableLimitErrors
} from '../error/errorModel';
import { getBodyClass } from '../services/globals';
import { ToolingModelJson } from '../services/model';
import { lwcIndexableArray } from '../services/lwcUtils';

export default class App extends LightningElement {
  @track
  public query: ToolingModelJson = ToolingModelService.toolingModelTemplate;

  @track
  public sObjects: string[] = [];
  @track
  public fields: string[] = [];
  public toolingSDK: ToolingSDK;
  public modelService: ToolingModelService;
  public messageService: IMessageService;
  public theme = 'light';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public sobjectMetadata: any;
  public notifications = [];

  public get shouldBlockQueryBuilder(): boolean {
    return (
      (this.hasUnrecoverableError || this.hasUnsupportedMessage) &&
      this.dismissNotifications === false
    );
  }
  public get showUnsupportedNotification(): boolean {
    return !this.hasUnrecoverableError && this.hasUnsupportedMessage;
  }
  public get showSyntaxErrorNotification(): boolean {
    return this.hasUnrecoverableError;
  }
  public hasUnsupportedMessage = false;
  public hasRecoverableFieldsError = false;
  public hasRecoverableFromError = false;
  public hasRecoverableLimitError = false;
  public hasRecoverableError = true;
  public hasUnrecoverableError = false;
  public isFromLoading = false;
  public isFieldsLoading = false;
  public isQueryRunning = false;
  public dismissNotifications = false;

  public constructor() {
    super();
    this.messageService = MessageServiceFactory.create();
    this.toolingSDK = new ToolingSDK(this.messageService);
    this.modelService = new ToolingModelService(this.messageService);
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return */
  public connectedCallback(): void {
    this.modelService.UIModel.subscribe(this.uiModelSubscriber.bind(this));

    this.toolingSDK.sobjects.subscribe((objs: string[]) => {
      this.isFromLoading = false;
      this.sObjects = objs;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.toolingSDK.sobjectMetadata.subscribe((sobjectMetadata: any) => {
      this.isFieldsLoading = false;
      this.fields =
        sobjectMetadata && sobjectMetadata.fields
          ? sobjectMetadata.fields.map((f) => f.name).sort()
          : [];
      this.sobjectMetadata = sobjectMetadata;
    });

    this.toolingSDK.queryRunState.subscribe(() => {
      this.isQueryRunning = false;
    });
    this.loadSObjectDefinitions();
    this.modelService.restoreViewState();
  }

  public renderedCallback(): void {
    const themeClass = getBodyClass();
    if (themeClass.indexOf('vscode-dark') > -1) {
      this.theme = 'dark';
    } else if (themeClass.indexOf('vscode-high-contrast') > -1) {
      this.theme = 'contrast';
    }
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment */
  public uiModelSubscriber(newQuery: ToolingModelJson): void {
    // only re-render if incoming soql statement is different
    if (this.query.originalSoqlStatement !== newQuery.originalSoqlStatement) {
      this.notifications = lwcIndexableArray<string>([
        ...this.inspectUnsupported(newQuery.unsupported),
        ...this.inspectErrors(newQuery.errors)
      ]);
      this.loadSObjectMetadata(newQuery);
      this.query = newQuery;
    }
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return */

  public loadSObjectDefinitions(): void {
    this.isFromLoading = true;
    this.toolingSDK.loadSObjectDefinitions();
  }

  public loadSObjectMetadata(newQuery: ToolingModelJson): void {
    const previousSObject = this.query ? this.query.sObject : '';
    const newSObject = newQuery.sObject;
    // if empty sobject, clear fields
    if (!newSObject.length) {
      this.fields = [];
      return;
    }
    // if empty previous sobject or else new sobject does not match previous
    if (previousSObject.length === 0 || previousSObject !== newSObject) {
      this.onSObjectChanged(newSObject);
    }
    // if no fields have been downloaded yet
    else if (
      previousSObject === newSObject &&
      this.fields.length === 0 &&
      this.isFieldsLoading === false
    ) {
      this.onSObjectChanged(newSObject);
    }
  }

  /* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any */
  public inspectErrors(errors: any[]): unknown[] {
    this.hasRecoverableFieldsError = false;
    this.hasRecoverableFromError = false;
    this.hasRecoverableLimitError = false;
    this.hasUnrecoverableError = false;
    const messages = [];
    errors.forEach((error) => {
      if (recoverableErrors[error.type]) {
        this.hasRecoverableError = true;
        if (recoverableFieldErrors[error.type]) {
          this.hasRecoverableFieldsError = true;
        }
        if (recoverableLimitErrors[error.type]) {
          this.hasRecoverableLimitError = true;
        }
        if (recoverableFromErrors[error.type]) {
          this.hasRecoverableFromError = true;
        }
      } else {
        this.hasUnrecoverableError = true;
      }
      messages.push(error.message);
    });
    return messages;
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return*/
  public inspectUnsupported(unsupported: JsonMap[]): any {
    const filteredUnsupported = unsupported
      // this reason is often associated with a parse error, so snuffing it out instead of double notifications
      .filter(
        (unsup) => unsup.reason.reasonCode !== 'unmodeled:empty-condition'
      )
      .map((unsup) => {
        return unsup.reason.message;
      });
    this.hasUnsupportedMessage = filteredUnsupported.length > 0;
    return filteredUnsupported;
  }
  /* ---- SOBJECT HANDLERS ---- */
  public handleObjectChange(e: CustomEvent): void {
    const selectedSObjectName = e.detail.selectedSobject;
    this.onSObjectChanged(selectedSObjectName);
    // when triggered by the ui, send message
    this.modelService.setSObject(selectedSObjectName);
  }

  public onSObjectChanged(sobjectName: string): void {
    if (sobjectName) {
      this.fields = [];
      this.isFieldsLoading = true;
      this.toolingSDK.loadSObjectMetatada(sobjectName);
    }
  }
  /* ---- FIELD HANDLERS ---- */
  public handleFieldSelected(e: CustomEvent): void {
    this.modelService.setFields(e.detail.fields);
  }
  public handleFieldSelectAll(): void {
    this.modelService.setFields(this.fields);
  }
  public handleFieldClearAll(): void {
    this.modelService.setFields([]);
  }

  /* ---- ORDER BY HANDLERS ---- */
  public handleOrderBySelected(e: CustomEvent): void {
    this.modelService.addUpdateOrderByField(e.detail);
  }
  public handleOrderByRemoved(e: CustomEvent): void {
    this.modelService.removeOrderByField(e.detail.field);
  }
  /* ---- LIMIT HANDLERS ---- */
  public handleLimitChanged(e: CustomEvent): void {
    this.modelService.changeLimit(e.detail.limit);
  }
  /* ---- WHERE HANDLERS ---- */
  public handleWhereSelection(e: CustomEvent): void {
    this.modelService.upsertWhereFieldExpr(e.detail);
  }
  public handleAndOrSelection(e: CustomEvent): void {
    this.modelService.setAndOr(e.detail);
  }
  public handleRemoveWhereCondition(e: CustomEvent): void {
    this.modelService.removeWhereFieldCondition(e.detail);
  }

  /* ---- MISC HANDLERS ---- */
  public handleDismissNotifications(): void {
    this.dismissNotifications = true;
  }

  public handleRunQuery(): void {
    this.isQueryRunning = true;
    const runQueryEvent: SoqlEditorEvent = { type: MessageType.RUN_SOQL_QUERY };
    this.messageService.sendMessage(runQueryEvent);
  }
}
