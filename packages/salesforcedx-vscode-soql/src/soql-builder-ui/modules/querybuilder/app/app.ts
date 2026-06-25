/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api, track } from 'lwc';
import { JsonMap } from '@salesforce/ts-types';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { messages } from 'querybuilder/messages';
import { Effect, Layer, ManagedRuntime, Stream } from 'effect';
import { ToolingSDK } from '../services/toolingSDK';
import { ToolingModelService, toolingModelTemplate } from '../services/toolingModelService';
import { MessageService, IMessageService } from '../services/message/iMessageService';
import { VscodeMessageServiceLive } from '../services/message/vscodeMessageService';
import {
  MessageType,
  SoqlEditorEvent
} from '../services/message/soqlEditorEvent';
import { IndexableArray } from '../services/lwcUtils';
import {
  recoverableErrors,
  recoverableFieldErrors,
  recoverableFromErrors,
  recoverableLimitErrors
} from '../error/errorModel';
import { ToolingModelJson } from '../services/model';
import { lwcIndexableArray } from '../services/lwcUtils';

export default class App extends LightningElement {
  @track
  public query: ToolingModelJson = toolingModelTemplate;

  @track
  public sObjects: string[] = [];
  @track
  public fields: string[] = [];
  public theme = 'light';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public sobjectMetadata: any;
  public notifications: IndexableArray<string> = [];

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
  public get showNoDefaultOrgNotification(): boolean {
    return this.hasNoDefaultOrg;
  }
  public get showBlockedQueryBuilder(): boolean {
    return !this.hasNoDefaultOrg && this.shouldBlockQueryBuilder;
  }
  public get showQueryBuilderForm(): boolean {
    return !this.hasNoDefaultOrg && !this.shouldBlockQueryBuilder;
  }
  public hasNoDefaultOrg = false;
  public hasUnsupportedMessage = false;
  public hasRecoverableFieldsError = false;
  public hasRecoverableFromError = false;
  public hasRecoverableLimitError = false;
  public hasRecoverableError = true;
  public hasUnrecoverableError = false;
  public isFromLoading = false;
  public isFieldsLoading = false;
  public isQueryRunning = false;
  public isQueryPlanRunning = false;
  public dismissNotifications = false;

  // Override in tests to inject a different MessageService layer
  @api
  public appLayer: Layer.Layer<MessageService> = VscodeMessageServiceLive;

  @api
  public _ready: Promise<void> | undefined;

  private _messageService: IMessageService | undefined;
  private _toolingSDK: ToolingSDK | undefined;
  private _modelService: ToolingModelService | undefined;
  private _runtime: { dispose: () => Promise<void> } | undefined;

  public async connectedCallback(): Promise<void> {
    this._ready = this._init();
    await this._ready;
  }

  public disconnectedCallback(): void {
    void this._runtime?.dispose();
  }

  private async _init(): Promise<void> {
    const self = this;
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        self.appLayer,
        Layer.provide(ToolingSDK.Default, self.appLayer),
        Layer.provide(ToolingModelService.Default, self.appLayer)
      )
    );
    self._runtime = runtime;

    await runtime.runPromise(
      Effect.gen(function* () {
        self._messageService = yield* MessageService;
        self._toolingSDK = yield* ToolingSDK;
        self._modelService = yield* ToolingModelService;

        const sdk = self._toolingSDK;
        const model = self._modelService;

        yield* Effect.forkDaemon(
          Stream.runForEach(model.UIModel, (newQuery: ToolingModelJson) =>
            Effect.sync(() => self.uiModelSubscriber(newQuery))
          )
        );

        yield* Effect.forkDaemon(
          Stream.runForEach(sdk.sobjects.changes.pipe(Stream.drop(1)), (objs: string[]) =>
            Effect.sync(() => {
              self.isFromLoading = false;
              self.sObjects = objs;
            })
          )
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yield* Effect.forkDaemon(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Stream.runForEach(sdk.sobjectMetadata.changes.pipe(Stream.drop(1)), (meta: any) =>
            Effect.sync(() => {
              self.isFieldsLoading = false;
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-explicit-any
              self.fields = meta && meta.fields ? meta.fields.map((f: any) => f.name).sort() : [];
              self.sobjectMetadata = meta;
            })
          )
        );

        yield* Effect.forkDaemon(
          Stream.runForEach(sdk.queryRunState.changes.pipe(Stream.drop(1)), () =>
            Effect.sync(() => { self.isQueryRunning = false; })
          )
        );

        yield* Effect.forkDaemon(
          Stream.runForEach(sdk.queryPlanRunState.changes.pipe(Stream.drop(1)), () =>
            Effect.sync(() => { self.isQueryPlanRunning = false; })
          )
        );

        yield* Effect.forkDaemon(
          Stream.runForEach(sdk.noDefaultOrg.changes.pipe(Stream.drop(1)), (hasNoDefaultOrg: boolean) =>
            Effect.sync(() => { self.hasNoDefaultOrg = hasNoDefaultOrg; })
          )
        );

        self.isFromLoading = true;
        sdk.loadSObjectDefinitions();
        model.restoreViewState();
      })
    );
  }

  public renderedCallback(): void {
    const themeClass = window.document.body.getAttribute('class') ?? '';
    if (themeClass.indexOf('vscode-dark') > -1) {
      this.theme = 'dark';
    } else if (themeClass.indexOf('vscode-high-contrast') > -1) {
      this.theme = 'contrast';
    }
  }

  public uiModelSubscriber(newQuery: ToolingModelJson): void {
    // only re-render if incoming soql statement is different
    if (this.query.originalSoqlStatement !== newQuery.originalSoqlStatement) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.notifications = lwcIndexableArray<string>([
        ...this.inspectUnsupported(newQuery.unsupported),
        ...this.inspectErrors(newQuery.errors)
      ]);
      this.loadSObjectMetadata(newQuery);
      this.query = newQuery;
    }
  }

  public loadSObjectMetadata(newQuery: ToolingModelJson): void {
    const previousSObject = this.query ? this.query.sObject : '';
    const newSObject = newQuery.sObject;
    if (!newSObject.length) {
      this.fields = [];
      return;
    }
    if (previousSObject.length === 0 || previousSObject !== newSObject) {
      this.onSObjectChanged(newSObject);
    } else if (
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
    const messages: unknown[] = [];
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

  /* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access*/
  public inspectUnsupported(unsupported: JsonMap[]): any {
    const filteredUnsupported = unsupported
      // this reason is often associated with a parse error, so snuffing it out instead of double notifications
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((unsup: any) => unsup?.reason?.reasonCode !== 'unmodeled:empty-condition')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((unsup: any) => unsup?.reason?.message);
    this.hasUnsupportedMessage = filteredUnsupported.length > 0;
    return filteredUnsupported;
  }

  /* ---- SOBJECT HANDLERS ---- */
  public handleObjectChange(e: CustomEvent): void {
    const selectedSObjectName = e.detail.selectedSobject;
    this.onSObjectChanged(selectedSObjectName);
    this._modelService?.setSObject(selectedSObjectName);
  }

  public onSObjectChanged(sobjectName: string): void {
    if (sobjectName) {
      this.fields = [];
      this.isFieldsLoading = true;
      this._toolingSDK?.loadSObjectMetadata(sobjectName);
    }
  }

  /* ---- FIELD HANDLERS ---- */
  public handleFieldSelected(e: CustomEvent): void {
    this._modelService?.setFields(e.detail.fields);
  }
  public handleFieldSelectAll(): void {
    this._modelService?.setFields(this.fields);
  }
  public handleFieldClearAll(): void {
    this._modelService?.setFields([]);
  }

  /* ---- ORDER BY HANDLERS ---- */
  public handleOrderBySelected(e: CustomEvent): void {
    this._modelService?.addUpdateOrderByField(e.detail);
  }
  public handleOrderByRemoved(e: CustomEvent): void {
    this._modelService?.removeOrderByField(e.detail.field);
  }

  /* ---- LIMIT HANDLERS ---- */
  public handleLimitChanged(e: CustomEvent): void {
    this._modelService?.changeLimit(e.detail.limit);
  }

  /* ---- ALL ROWS HANDLERS ---- */
  public handleAllRowsChanged(e: Event): void {
    this._modelService?.setAllRows((e.target as HTMLInputElement).checked);
  }

  /* ---- WHERE HANDLERS ---- */
  public handleWhereSelection(e: CustomEvent): void {
    this._modelService?.upsertWhereFieldExpr(e.detail);
  }
  public handleAndOrSelection(e: CustomEvent): void {
    this._modelService?.setAndOr(e.detail);
  }
  public handleRemoveWhereCondition(e: CustomEvent): void {
    this._modelService?.removeWhereFieldCondition(e.detail);
  }

  /* ---- MISC HANDLERS ---- */
  public handleDismissNotifications(): void {
    this.dismissNotifications = true;
  }

  public handleSetDefaultOrg(): void {
    const setDefaultOrgEvent: SoqlEditorEvent = { type: MessageType.SET_DEFAULT_ORG };
    this._messageService?.sendMessage(setDefaultOrgEvent);
  }

  public get i18n() {
    return messages;
  }

  public get isQueryValid(): boolean {
    return Boolean(this.query.sObject) && this.query.fields.length > 0;
  }

  public handleRunQuery(): void {
    this.isQueryRunning = true;
    const runQueryEvent: SoqlEditorEvent = { type: MessageType.RUN_SOQL_QUERY };
    this._messageService?.sendMessage(runQueryEvent);
  }

  public handleGetQueryPlan(): void {
    this.isQueryPlanRunning = true;
    const planEvent: SoqlEditorEvent = { type: MessageType.GET_QUERY_PLAN };
    this._messageService?.sendMessage(planEvent);
  }
}
