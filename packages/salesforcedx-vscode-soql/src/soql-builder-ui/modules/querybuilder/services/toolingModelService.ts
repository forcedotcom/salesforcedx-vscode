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
import { AndOr } from '@salesforce/soql-model/model/model';
import { convertUiModelToSoql, convertSoqlToUiModel } from '../services/soqlUtils';
import { IMessageService } from './message/iMessageService';
import { SoqlEditorEvent, MessageType } from './message/soqlEditorEvent';
import { IMap, ToolingModel, ToolingModelJson, ModelProps, SubqueryJson } from './model';
import { createQueryTelemetry } from './telemetryUtils';
export class ToolingModelService {
  public static toolingModelTemplate: ToolingModelJson = {
    sObject: '',
    fields: [],
    relationships: [],
    subqueries: [],
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
    this.immutableModel = new BehaviorSubject(fromJS(ToolingModelService.toolingModelTemplate));
    this.immutableModel.subscribe(this.saveViewState.bind(this));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.UIModel = this.immutableModel.pipe(
      map(soqlQueryModel => {
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

    this.messageService.messagesToUI.subscribe(this.onIncommingMessage.bind(this));
  }

  public getModel(): IMap {
    return this.immutableModel.getValue();
  }

  /* ---- OBJECTS ---- */

  // This method is destructive, will clear any selections except sObject.
  public setSObject(sObject: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const newModelJS = Object.assign(this.getModel().toJS(), ToolingModelService.toolingModelTemplate, {
      sObject
    });
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
    const newModel = currentModel.set(ModelProps.ORDER_BY, updatedOrderBy) as ToolingModel;
    this.changeModel(newModel);
  }

  public removeOrderByField(field: string): void {
    const currentModel = this.getModel();
    const orderBy = this.getOrderBy();
    const filteredOrderBy = orderBy.filter(item => {
      return item.get('field') !== field;
    }) as List<JsonMap>;
    const newModelWithFieldRemoved = currentModel.set(ModelProps.ORDER_BY, filteredOrderBy) as ToolingModel;

    this.changeModel(newModelWithFieldRemoved);
  }

  private getFields(): List<string> {
    return this.getModel().get(ModelProps.FIELDS) as List<string>;
  }

  /* ---- RELATIONSHIPS ---- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getRelationships(): List<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.getModel().get(ModelProps.RELATIONSHIPS) as List<any>) || List();
  }

  public setRelationshipFields(relationshipName: string, fields: string[]): void {
    let rels = this.getRelationships();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const index = rels.findIndex(r => r.get('relationshipName') === relationshipName);
    if (index >= 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      rels = rels.update(index, r => r.set('fields', fromJS(fields)));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      rels = rels.push(fromJS({ relationshipName, fields }));
    }
    this.changeModel(this.getModel().set(ModelProps.RELATIONSHIPS, rels));
  }

  public removeRelationship(relationshipName: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const filtered = this.getRelationships().filter(r => r.get('relationshipName') !== relationshipName);
    this.changeModel(this.getModel().set(ModelProps.RELATIONSHIPS, filtered));
  }

  /* ---- SUBQUERIES ---- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getSubqueries(): List<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.getModel().get(ModelProps.SUBQUERIES) as List<any>) || List();
  }

  public addSubquery(relationshipName: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const alreadyExists = this.getSubqueries().some(sq => sq.get('relationshipName') === relationshipName);
    if (alreadyExists) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const newSubqueries = this.getSubqueries().push(fromJS({ relationshipName, fields: [], subqueries: [] }));
    this.changeModel(this.getModel().set(ModelProps.SUBQUERIES, newSubqueries));
  }

  public removeSubquery(relationshipName: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const filtered = this.getSubqueries().filter(sq => sq.get('relationshipName') !== relationshipName);
    this.changeModel(this.getModel().set(ModelProps.SUBQUERIES, filtered));
  }

  public setSubqueryFields(relationshipName: string, fields: string[]): void {
    let subqueries = this.getSubqueries();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const index = subqueries.findIndex(sq => sq.get('relationshipName') === relationshipName);
    if (index >= 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      subqueries = subqueries.update(index, sq => sq.set('fields', fromJS(fields)));
    } else {
      // Create and populate in one shot so we never emit an empty (SELECT  FROM X) to the backend.
      // Always include subqueries:[] so the Immutable model shape matches what convertSoqlToUiModel produces.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      subqueries = subqueries.push(fromJS({ relationshipName, fields, subqueries: [] }));
    }
    this.changeModel(this.getModel().set(ModelProps.SUBQUERIES, subqueries));
  }

  // Add a single field to a nested subquery identified by a path of relationship names.
  // path[0] is the top-level subquery; path[1..] are nested subqueries.
  public addSubqueryFieldAtPath(path: string[], field: string): void {
    let subqueries = this.getSubqueries();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    let topIndex = subqueries.findIndex(sq => sq.get('relationshipName') === path[0]);
    if (topIndex < 0) {
      // Create the top-level entry so nested fields have somewhere to live
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      subqueries = subqueries.push(fromJS({ relationshipName: path[0], fields: [], subqueries: [] }));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      topIndex = subqueries.findIndex(sq => sq.get('relationshipName') === path[0]);
    }

    if (path.length === 1) {
      // Top-level subquery
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const current: string[] = subqueries.getIn([topIndex, 'fields'])?.toJS() ?? [];
      if (current.includes(field)) return;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const updated = subqueries.update(topIndex, sq => sq.set('fields', fromJS([...current, field])));
      this.changeModel(this.getModel().set(ModelProps.SUBQUERIES, updated));
    } else {
      // Navigate and update the nested subquery, then write back
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const topSq = subqueries.get(topIndex).toJS() as { relationshipName: string; fields: string[]; subqueries: any[] };
      const updatedTopSq = this._addFieldAtPath(topSq, path.slice(1), field);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const updatedSubqueries = subqueries.update(topIndex, () => fromJS(updatedTopSq));
      this.changeModel(this.getModel().set(ModelProps.SUBQUERIES, updatedSubqueries));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _addFieldAtPath(sq: { relationshipName: string; fields: string[]; subqueries: any[] }, path: string[], field: string): any {
    if (path.length === 0) return sq;
    if (path.length === 1) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const nested = (sq.subqueries || []).find((s: any) => s.relationshipName === path[0]);
      if (!nested) {
        // Create new nested subquery
        return { ...sq, subqueries: [...(sq.subqueries || []), { relationshipName: path[0], fields: [field], subqueries: [] }] };
      }
      if (nested.fields.includes(field)) return sq;
      return {
        ...sq,
        subqueries: (sq.subqueries || []).map((s: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
          s.relationshipName === path[0] ? { ...s, fields: [...s.fields, field] } : s
        )
      };
    }
    // Recurse deeper
    return {
      ...sq,
      subqueries: (sq.subqueries || []).map((s: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
        s.relationshipName === path[0] ? this._addFieldAtPath(s, path.slice(1), field) : s
      )
    };
  }

  /* ---- ORDER BY ---- */

  private getOrderBy(): List<JsonMap> {
    return this.getModel().get(ModelProps.ORDER_BY) as List<JsonMap>;
  }

  private hasOrderByField(field: string): number {
    return this.getOrderBy().findIndex(item => item.get('field') === field);
  }

  /* ---- WHERE ---- */

  private getWhereConditions(): List<JsonMap> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return this.getModel().get(ModelProps.WHERE).get(ModelProps.WHERE_CONDITIONS) as List<JsonMap>;
  }

  private hasWhereConditionBy(index: string): boolean {
    if (this.getWhereConditions().count() > 0) {
      return this.getWhereConditions().find(item => item.get('index') === index);
    }
    return false;
  }

  public setAndOr(andOr: AndOr): void {
    const currentModel = this.getModel();
    const newModel = currentModel.setIn([ModelProps.WHERE, ModelProps.WHERE_AND_OR], andOr);

    this.changeModel(newModel);
  }

  public upsertWhereFieldExpr(whereObj: JsonMap): void {
    const currentModel = this.getModel();
    let updatedWhereCondition;
    const { fieldCompareExpr, andOr } = whereObj;
    const existingExpr = this.hasWhereConditionBy(fieldCompareExpr.index);
    if (existingExpr) {
      updatedWhereCondition = this.getWhereConditions().update(fieldCompareExpr.index, () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return fromJS(fieldCompareExpr);
      });
    } else {
      updatedWhereCondition = this.getWhereConditions().push(fromJS(fieldCompareExpr));
    }

    let newModel = currentModel.setIn([ModelProps.WHERE, ModelProps.WHERE_CONDITIONS], updatedWhereCondition);
    /*
    The UI model should always be aware
    of andOr UI state when expr is updated.
    */
    newModel = newModel.setIn([ModelProps.WHERE, ModelProps.WHERE_AND_OR], andOr);

    this.changeModel(newModel);
  }

  public removeWhereFieldCondition(fieldCompareExpr: JsonMap): void {
    const currentModel = this.getModel();
    const whereConditions = this.getWhereConditions();
    const filteredConditions = whereConditions.filter(item => {
      return item.get('index') !== fieldCompareExpr.index;
    });

    const newModel = currentModel.setIn([ModelProps.WHERE, ModelProps.WHERE_CONDITIONS], filteredConditions);

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
            if (originalSoqlStatement.length && (soqlJSModel.errors.length || soqlJSModel.unsupported.length)) {
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
    const newModelWithSoqlQuery = newModel.set('originalSoqlStatement', newSoqlQuery);
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

export type { ToolingModelJson };
