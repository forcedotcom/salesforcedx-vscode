/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/member-ordering */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { fromJS, List } from 'immutable';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { JsonMap } from '@salesforce/ts-types';
import {
  convertUiModelToSoql,
  convertSoqlToUiModel
} from '../services/soqlUtils';
import { IMessageService } from './message/iMessageService';
import { SoqlEditorEvent, MessageType } from './message/soqlEditorEvent';
import { IMap, ToolingModel, ToolingModelJson, ModelProps } from './model';
import { createQueryTelemetry } from './telemetryUtils';
export class ToolingModelService {
  public static toolingModelTemplate: ToolingModelJson = {
    sObject: '',
    fields: [],
    orderBy: [],
    limit: '',
    where: { conditions: [], andOr: undefined },
    errors: [],
    unsupported: [],
    originalSoqlStatement: ''
  } as ToolingModelJson;
  public UIModel: Observable<ToolingModelJson>;
  private messageService: IMessageService;
  private immutableModel: BehaviorSubject<ToolingModel>;

  public constructor(messageService: IMessageService) {
    this.messageService = messageService;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.immutableModel = new BehaviorSubject(
      fromJS(ToolingModelService.toolingModelTemplate)
    );
    this.immutableModel.subscribe(this.saveViewState.bind(this));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.UIModel = this.immutableModel.pipe(
      map((soqlQueryModel) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return (soqlQueryModel as IMap).toJS();
        } catch (e) {
          // eslint-disable-next-line no-console,@typescript-eslint/restrict-plus-operands
          console.error('Unexpected Error in SOQL model: ' + e);
          return ToolingModelService.toolingModelTemplate;
        }
      })
    );

    this.messageService.messagesToUI.subscribe(
      this.onIncommingMessage.bind(this)
    );
  }

  public getModel(): IMap {
    return this.immutableModel.getValue();
  }

  /* ---- OBJECTS ---- */

  // This method is destructive, will clear any selections except sObject.
  public setSObject(sObject: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const newModelJS = Object.assign(
      this.getModel().toJS(),
      ToolingModelService.toolingModelTemplate,
      {
        sObject
      }
    );
    this.changeModel(fromJS(newModelJS));
  }

  /* ---- FIELDS ---- */
  public setFields(fields: string[]): void {
    const currentModel = this.getModel();
    const newModel = currentModel.set(ModelProps.FIELDS, fields);
    this.changeModel(newModel);
  }

  public addUpdateOrderByField(orderByObj: JsonMap): void {
    const currentModel = this.getModel();
    let updatedOrderBy;
    const existingIndex = this.hasOrderByField(orderByObj.field);
    if (existingIndex > -1) {
      updatedOrderBy = this.getOrderBy().update(existingIndex, () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return fromJS(orderByObj);
      });
    } else {
      updatedOrderBy = this.getOrderBy().push(fromJS(orderByObj));
    }
    const newModel = currentModel.set(
      ModelProps.ORDER_BY,
      updatedOrderBy
    ) as ToolingModel;
    this.changeModel(newModel);
  }

  public removeOrderByField(field: string): void {
    const currentModel = this.getModel();
    const orderBy = this.getOrderBy();
    const filteredOrderBy = orderBy.filter((item) => {
      return item.get('field') !== field;
    }) as List<JsonMap>;
    const newModelWithFieldRemoved = currentModel.set(
      ModelProps.ORDER_BY,
      filteredOrderBy
    ) as ToolingModel;

    this.changeModel(newModelWithFieldRemoved);
  }

  private getFields(): List<string> {
    return this.getModel().get(ModelProps.FIELDS) as List<string>;
  }

  /* ---- ORDER BY ---- */

  private getOrderBy(): List<JsonMap> {
    return this.getModel().get(ModelProps.ORDER_BY) as List<JsonMap>;
  }

  private hasOrderByField(field: string): number {
    return this.getOrderBy().findIndex((item) => item.get('field') === field);
  }

  /* ---- WHERE ---- */

  private getWhereConditions(): List<JsonMap> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return this.getModel()
      .get(ModelProps.WHERE)
      .get(ModelProps.WHERE_CONDITIONS) as List<JsonMap>;
  }

  private hasWhereConditionBy(index: string): boolean {
    if (this.getWhereConditions().count() > 0) {
      return this.getWhereConditions().find(
        (item) => item.get('index') === index
      );
    }
    return false;
  }

  public setAndOr(andOr: string): void {
    const currentModel = this.getModel();
    const newModel = currentModel.setIn(
      [ModelProps.WHERE, ModelProps.WHERE_AND_OR],
      andOr
    );

    this.changeModel(newModel);
  }

  public upsertWhereFieldExpr(whereObj: JsonMap): void {
    const currentModel = this.getModel();
    let updatedWhereCondition;
    const { fieldCompareExpr, andOr } = whereObj;
    const existingExpr = this.hasWhereConditionBy(fieldCompareExpr.index);
    if (existingExpr) {
      updatedWhereCondition = this.getWhereConditions().update(
        fieldCompareExpr.index,
        () => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return fromJS(fieldCompareExpr);
        }
      );
    } else {
      updatedWhereCondition = this.getWhereConditions().push(
        fromJS(fieldCompareExpr)
      );
    }

    let newModel = currentModel.setIn(
      [ModelProps.WHERE, ModelProps.WHERE_CONDITIONS],
      updatedWhereCondition
    );
    /*
    The UI model should always be aware
    of andOr UI state when expr is updated.
    */
    newModel = newModel.setIn(
      [ModelProps.WHERE, ModelProps.WHERE_AND_OR],
      andOr
    );

    this.changeModel(newModel);
  }

  public removeWhereFieldCondition(fieldCompareExpr: JsonMap): void {
    const currentModel = this.getModel();
    const whereConditions = this.getWhereConditions();
    const filteredConditions = whereConditions.filter((item) => {
      return item.get('index') !== fieldCompareExpr.index;
    });

    const newModel = currentModel.setIn(
      [ModelProps.WHERE, ModelProps.WHERE_CONDITIONS],
      filteredConditions
    );

    this.changeModel(newModel);
  }

  /* ---- LIMIT ---- */

  public changeLimit(limit: string): void {
    const newLimitModel = this.getModel().set(ModelProps.LIMIT, limit || '');
    this.changeModel(newLimitModel);
  }

  /* ---- MESSAGING ---- */

  private onIncommingMessage(event: SoqlEditorEvent): void {
    if (event && event.type) {
      switch (event.type) {
        case MessageType.TEXT_SOQL_CHANGED: {
          const originalSoqlStatement = event.payload as string;
          const soqlJSModel = convertSoqlToUiModel(originalSoqlStatement);
          soqlJSModel.originalSoqlStatement = originalSoqlStatement;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const updatedModel = fromJS(soqlJSModel);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
          if (!updatedModel.equals(this.immutableModel.getValue())) {
            if (
              originalSoqlStatement.length &&
              (soqlJSModel.errors.length || soqlJSModel.unsupported.length)
            ) {
              this.sendTelemetryToBackend(soqlJSModel);
            }
            this.immutableModel.next(updatedModel);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  /* ---- STATE & MODEL ---- */

  public saveViewState(model: ToolingModel): void {
    try {
      this.messageService.setState((model as IMap).toJS());
    } catch (e) {
      console.error(e);
    }
  }

  private changeModel(newModel): void {
    const newSoqlQuery = convertUiModelToSoql((newModel as IMap).toJS());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
    const newModelWithSoqlQuery = newModel.set(
      'originalSoqlStatement',
      newSoqlQuery
    );
    this.immutableModel.next(newModelWithSoqlQuery);
    this.sendMessageToBackend(newSoqlQuery);
  }

  public sendMessageToBackend(newSoqlQuery: string): void {
    try {
      this.messageService.sendMessage({
        type: MessageType.UI_SOQL_CHANGED,
        payload: newSoqlQuery
      });
    } catch (e) {
      console.error(e);
    }
  }

  public sendTelemetryToBackend(query: ToolingModelJson): void {
    try {
      const telemetryMetrics = createQueryTelemetry(query);
      this.messageService.sendMessage({
        type: MessageType.UI_TELEMETRY,
        payload: telemetryMetrics
      });
    } catch (e) {
      console.error(e);
    }
  }

  public restoreViewState(): void {
    this.immutableModel.next(this.getSavedState());
  }

  private getSavedState(): ToolingModel {
    const savedState = this.messageService.getState();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return fromJS(savedState || ToolingModelService.toolingModelTemplate);
  }
}
