/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { Effect, Stream, SubscriptionRef } from 'effect';
import { AndOr } from '@salesforce/soql-model/model/model';
import { JsonMap } from '@salesforce/ts-types';
import { convertUiModelToSoql, convertSoqlToUiModel } from '../services/soqlUtils';
import { MessageService } from './message/iMessageService';
import { SoqlEditorEvent, MessageType } from './message/soqlEditorEvent';
import { ToolingModelJson, ModelProps } from './model';
import { createQueryTelemetry } from './telemetryUtils';

export const toolingModelTemplate: ToolingModelJson = {
  sObject: '',
  fields: [],
  orderBy: [],
  limit: '',
  where: { conditions: [], andOr: undefined },
  errors: [],
  unsupported: [],
  originalSoqlStatement: ''
};

export class ToolingModelService extends Effect.Service<ToolingModelService>()('ToolingModelService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const messageService = yield* MessageService;

    const model = yield* SubscriptionRef.make<ToolingModelJson>(toolingModelTemplate);

    const UIModel: Stream.Stream<ToolingModelJson> = model.changes;

    const getModel = (): ToolingModelJson => Effect.runSync(SubscriptionRef.get(model));

    const saveViewState = (m: ToolingModelJson): void => {
      try {
        messageService.setState(m);
      } catch (e) {
        console.error(e);
      }
    };

    const setModel = (newModel: ToolingModelJson): void => {
      Effect.runSync(SubscriptionRef.set(model, newModel));
      saveViewState(newModel);
    };

    const sendMessageToBackend = (newSoqlQuery: string): void => {
      try {
        messageService.sendMessage({ type: MessageType.UI_SOQL_CHANGED, payload: newSoqlQuery });
      } catch (e) {
        console.error(e);
      }
    };

    const sendTelemetryToBackend = (query: ToolingModelJson): void => {
      try {
        const telemetryMetrics = createQueryTelemetry(query);
        messageService.sendMessage({ type: MessageType.UI_TELEMETRY, payload: telemetryMetrics });
      } catch (e) {
        console.error(e);
      }
    };

    const changeModel = (newModel: ToolingModelJson): void => {
      const newSoqlQuery = convertUiModelToSoql(newModel);
      setModel({ ...newModel, originalSoqlStatement: newSoqlQuery });
      sendMessageToBackend(newSoqlQuery);
    };

    messageService.onMessage((event: SoqlEditorEvent): void => {
      if (event && event.type === MessageType.TEXT_SOQL_CHANGED) {
        const originalSoqlStatement = event.payload as string;
        const soqlJSModel = convertSoqlToUiModel(originalSoqlStatement);
        soqlJSModel.originalSoqlStatement = originalSoqlStatement;
        if (soqlJSModel.originalSoqlStatement !== getModel().originalSoqlStatement) {
          if (originalSoqlStatement.length && (soqlJSModel.errors.length || soqlJSModel.unsupported.length)) {
            sendTelemetryToBackend(soqlJSModel);
          }
          setModel(soqlJSModel);
        }
      }
    });

    /* ---- OBJECTS ---- */

    const setSObject = (sObject: string): void => {
      changeModel({ ...toolingModelTemplate, headerComments: getModel().headerComments, sObject });
    };

    /* ---- FIELDS ---- */

    const setFields = (fields: string[]): void => {
      changeModel({ ...getModel(), [ModelProps.FIELDS]: fields });
    };

    /* ---- ORDER BY ---- */

    const hasOrderByField = (field: string): number =>
      getModel().orderBy.findIndex(item => (item as JsonMap).field === field);

    const addUpdateOrderByField = (orderByObj: JsonMap): void => {
      const current = getModel().orderBy;
      const existingIndex = hasOrderByField(orderByObj.field as string);
      const updatedOrderBy = existingIndex > -1
        ? current.map((item, i) => i === existingIndex ? orderByObj : item)
        : [...current, orderByObj];
      changeModel({ ...getModel(), [ModelProps.ORDER_BY]: updatedOrderBy });
    };

    const removeOrderByField = (field: string): void => {
      const filteredOrderBy = getModel().orderBy.filter(item => (item as JsonMap).field !== field);
      changeModel({ ...getModel(), [ModelProps.ORDER_BY]: filteredOrderBy });
    };

    /* ---- WHERE ---- */

    const getWhereConditions = (): JsonMap[] => getModel().where.conditions as JsonMap[];

    const setAndOr = (andOr: AndOr): void => {
      changeModel({ ...getModel(), where: { ...getModel().where, [ModelProps.WHERE_AND_OR]: andOr } });
    };

    const upsertWhereFieldExpr = (whereObj: JsonMap): void => {
      const { fieldCompareExpr, andOr } = whereObj;
      const conditions = getWhereConditions();
      const existingIndex = conditions.findIndex(item => item.index === (fieldCompareExpr as JsonMap).index);
      const updatedConditions = existingIndex > -1
        ? conditions.map((item, i) => i === existingIndex ? fieldCompareExpr as JsonMap : item)
        : [...conditions, fieldCompareExpr as JsonMap];
      changeModel({
        ...getModel(),
        where: {
          conditions: updatedConditions,
          [ModelProps.WHERE_AND_OR]: andOr as AndOr
        }
      });
    };

    const removeWhereFieldCondition = (fieldCompareExpr: JsonMap): void => {
      const filteredConditions = getWhereConditions().filter(
        item => item.index !== fieldCompareExpr.index
      );
      changeModel({ ...getModel(), where: { ...getModel().where, [ModelProps.WHERE_CONDITIONS]: filteredConditions } });
    };

    /* ---- LIMIT ---- */

    const changeLimit = (limit: string): void => {
      changeModel({ ...getModel(), [ModelProps.LIMIT]: limit || '' });
    };

    /* ---- STATE ---- */

    const restoreViewState = (): void => {
      const savedState = messageService.getState() as ToolingModelJson | undefined;
      setModel(savedState || toolingModelTemplate);
    };

    return {
      UIModel,
      getModel,
      setSObject,
      setFields,
      addUpdateOrderByField,
      removeOrderByField,
      setAndOr,
      upsertWhereFieldExpr,
      removeWhereFieldCondition,
      changeLimit,
      sendMessageToBackend,
      sendTelemetryToBackend,
      restoreViewState
    };
  })
}) {}

export type { ToolingModelJson };
