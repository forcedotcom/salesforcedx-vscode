/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingModelJson } from '../modules/querybuilder/services/model';
import {
  createInitialSoqlBuilderState,
  type SoqlBuilderHost,
  type SoqlBuilderState,
  type SoqlBuilderStateListener
} from '@salesforce/soql-builder-ui';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Stream from 'effect/Stream';
import { MessageService } from '../modules/querybuilder/services/message/iMessageService';
import { VscodeMessageServiceLive } from '../modules/querybuilder/services/message/vscodeMessageService';
import { ToolingModelService } from '../modules/querybuilder/services/toolingModelService';
import { ToolingSDK } from '../modules/querybuilder/services/toolingSDK';

/** Adapts the existing VS Code/Effect service graph to the UI package contract. */
export class VscodeSoqlBuilderHost implements SoqlBuilderHost {
  public readonly kind = 'vscode';
  private listener: SoqlBuilderStateListener | undefined;
  private modelService: ToolingModelService | undefined;
  private requestedSObject: string | undefined;
  private runtime:
    | ManagedRuntime.ManagedRuntime<MessageService | ToolingSDK | ToolingModelService, never>
    | undefined;
  private state: SoqlBuilderState = createInitialSoqlBuilderState();
  private toolingSDK: ToolingSDK | undefined;

  public async dispose(): Promise<void> {
    await this.runtime?.dispose();
    this.listener = undefined;
    this.modelService = undefined;
    this.runtime = undefined;
    this.toolingSDK = undefined;
  }

  public async initialize(listener: SoqlBuilderStateListener): Promise<void> {
    this.listener = listener;
    const appLayer: Layer.Layer<MessageService> = VscodeMessageServiceLive;
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        appLayer,
        Layer.provide(ToolingSDK.Default, appLayer),
        Layer.provide(ToolingModelService.Default, appLayer)
      )
    );
    this.runtime = runtime;

    await runtime.runPromise(
      Effect.gen(this, function* () {
        this.toolingSDK = yield* ToolingSDK;
        this.modelService = yield* ToolingModelService;

        yield* Effect.forkDaemon(
          Stream.runForEach(this.modelService.UIModel, query =>
            Effect.sync(() => this.applyQuery(query))
          )
        );
        yield* Effect.forkDaemon(
          Stream.runForEach(this.toolingSDK.sobjects.changes, sObjects =>
            Effect.sync(() => {
              this.state = { ...this.state, isObjectsLoading: false, sObjects };
              this.publish();
            })
          )
        );
        yield* Effect.forkDaemon(
          Stream.runForEach(this.toolingSDK.sobjectMetadata.changes, metadata =>
            Effect.sync(() => {
              this.state = {
                ...this.state,
                availableFields: metadata.fields.map(field => field.name).toSorted(),
                isFieldsLoading: false
              };
              this.publish();
            })
          )
        );
        yield* Effect.forkDaemon(
          Stream.runForEach(this.toolingSDK.noDefaultOrg.changes, hasNoDefaultOrg =>
            Effect.sync(() => {
              this.state = { ...this.state, hasNoDefaultOrg };
              this.publish();
            })
          )
        );

        this.state = { ...this.state, isObjectsLoading: true };
        this.publish();
        this.toolingSDK.loadSObjectDefinitions();
        this.modelService.restoreViewState();
      })
    );
  }

  public selectFields(fields: string[]): void {
    this.modelService?.setFields(fields);
  }

  public selectSObject(sObject: string): void {
    this.state = { ...this.state, availableFields: [], isFieldsLoading: true };
    this.requestedSObject = sObject;
    this.publish();
    this.toolingSDK?.loadSObjectMetadata(sObject);
    this.modelService?.setSObject(sObject);
  }

  private applyQuery(query: ToolingModelJson): void {
    this.state = {
      ...this.state,
      query: {
        fields: [...query.fields],
        originalSoqlStatement: query.originalSoqlStatement,
        sObject: query.sObject
      }
    };
    this.publish();
    if (
      query.sObject.length > 0 &&
      query.sObject !== this.requestedSObject &&
      (this.state.availableFields.length === 0 || this.requestedSObject !== query.sObject)
    ) {
      this.state = { ...this.state, availableFields: [], isFieldsLoading: true };
      this.requestedSObject = query.sObject;
      this.publish();
      this.toolingSDK?.loadSObjectMetadata(query.sObject);
    }
  }

  private publish(): void {
    this.listener?.(this.state);
  }
}
