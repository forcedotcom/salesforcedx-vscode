/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { Effect, Layer } from 'effect';
import { AndOr } from '@salesforce/soql-model/model';
import {
  ToolingModelService,
  toolingModelTemplate
} from '../../../../../../src/soql-builder-ui/modules/querybuilder/services/toolingModelService';
import {
  MessageService,
  IMessageService
} from '../../../../../../src/soql-builder-ui/modules/querybuilder/services/message/iMessageService';
import {
  MessageType,
  SoqlEditorEvent
} from '../../../../../../src/soql-builder-ui/modules/querybuilder/services/message/soqlEditorEvent';

const makeTestMessageLayer = () => {
  const listeners: Array<(e: SoqlEditorEvent) => void> = [];
  const sendMessage = jest.fn();
  const setState = jest.fn();
  const getState = jest.fn();
  const service: IMessageService = {
    onMessage: cb => {
      listeners.push(cb);
    },
    sendMessage,
    setState,
    getState
  };
  const emit = (event: SoqlEditorEvent) => listeners.forEach(l => l(event));
  const layer = Layer.succeed(MessageService, service);
  return { layer, emit, sendMessage, setState, getState };
};

const runWithModelService = <A>(
  layer: Layer.Layer<MessageService>,
  body: (svc: ToolingModelService) => Effect.Effect<A>
): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const svc = yield* ToolingModelService;
      return yield* body(svc);
    }).pipe(Effect.provide(Layer.provide(ToolingModelService.Default, layer)))
  );

describe('Tooling Model Service', () => {
  const mockField1 = 'field1';
  const mockField2 = 'field2';
  const mockSobject = 'sObject1';
  const mockOrderBy = { field: 'orderBy1', order: 'ASC', nulls: 'NULLS LAST' };
  const getMockWhereObj = () => ({
    fieldCompareExpr: {
      condition: {
        field: { fieldName: 'Name' },
        operator: '=',
        compareValue: { type: 'STRING', value: "'pwt'" }
      },
      index: 0
    },
    andOr: AndOr.And
  });
  const jimmyQuery = 'SELECT Hey, Joe from JimmyHendrixCatalog';
  const accountQuery = 'SELECT Id from Account';
  const soqlEditorEvent: SoqlEditorEvent = {
    type: MessageType.TEXT_SOQL_CHANGED,
    payload: accountQuery
  };

  describe('SOBJECTS', () => {
    it('can set an SObject selection', async () => {
      const { layer } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          svc.setSObject(mockSobject);
          expect(svc.getModel().sObject).toBe(mockSobject);
        })
      );
    });

    it('should include originalSoqlStatement property in model', async () => {
      const { layer } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          svc.setSObject('Account');
          svc.setFields(['Id']);
          expect(svc.getModel().originalSoqlStatement).toContain('SELECT Id');
          expect(svc.getModel().originalSoqlStatement).toContain('FROM Account');
        })
      );
    });
  });

  describe('FIELDS', () => {
    it('can set fields and changes are reflected', async () => {
      const { layer, setState } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          setState.mockClear();
          svc.setFields([mockField1, mockField2]);
          expect(svc.getModel().fields.length).toBe(2);
          expect(svc.getModel().fields).toContain(mockField1);
          expect(svc.getModel().fields).toContain(mockField2);

          svc.setFields([mockField2]);
          expect(svc.getModel().fields.length).toBe(1);
          expect(svc.getModel().fields).toContain(mockField2);

          expect(setState).toHaveBeenCalledTimes(2);
        })
      );
    });
  });

  describe('EVENTS', () => {
    it('should handle SOQL_TEXT_CHANGED event but not others', async () => {
      const { layer, emit } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          emit({ ...soqlEditorEvent, payload: jimmyQuery });
          expect(svc.getModel().fields.length).toBe(2);
          expect(svc.getModel().originalSoqlStatement).toEqual(jimmyQuery);

          emit({ type: MessageType.SOBJECTS_RESPONSE, payload: jimmyQuery.replace('Hey, Joe', 'What') });
          expect(svc.getModel().fields.length).toBe(2);
          expect(svc.getModel().originalSoqlStatement).toEqual(jimmyQuery);
        })
      );
    });

    it('should send message when ui changes the query', async () => {
      const { layer, sendMessage } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          expect(sendMessage).not.toHaveBeenCalled();
          svc.setFields([mockField1]);
          expect(sendMessage).toHaveBeenCalled();
        })
      );
    });

    it('should restore state', async () => {
      const { layer, getState } = makeTestMessageLayer();
      const accountJson = { ...toolingModelTemplate, sObject: 'Account' };
      getState.mockReturnValue(accountJson);
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          svc.restoreViewState();
          expect(svc.getModel().sObject).toEqual(accountJson.sObject);
        })
      );
    });

    it('Receive SOQL Text from editor', async () => {
      const { layer, emit } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          emit({ ...soqlEditorEvent, payload: 'Select Name1, Id1 from Account1' });
          expect(svc.getModel().sObject).toEqual('Account1');
          expect(svc.getModel().fields[0]).toEqual('Name1');
          expect(svc.getModel().fields[1]).toEqual('Id1');
          expect(svc.getModel().errors.length).toEqual(0);
          expect(svc.getModel().unsupported.length).toEqual(0);
        })
      );
    });

    it('Ignore messages that have the exact same soql statement', async () => {
      const { layer, emit, setState } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          setState.mockClear();
          emit(soqlEditorEvent);
          expect(setState).toHaveBeenCalledTimes(1);

          emit(soqlEditorEvent);
          expect(setState).toHaveBeenCalledTimes(1);

          emit({ ...soqlEditorEvent, payload: 'SELECT Name FROM Contact' });
          expect(setState).toHaveBeenCalledTimes(2);
        })
      );
    });
  });

  describe('WHERE', () => {
    it('should ADD condition by index in the model', async () => {
      const { layer } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          const mockWhereObj = getMockWhereObj();
          expect(svc.getModel().where.conditions.length).toEqual(0);

          svc.upsertWhereFieldExpr(mockWhereObj);
          expect(svc.getModel().where.conditions.length).toBe(1);

          svc.upsertWhereFieldExpr(mockWhereObj);
          expect(svc.getModel().where.conditions.length).toBe(1);

          const newMock = getMockWhereObj();
          newMock.fieldCompareExpr.index = 1;
          svc.upsertWhereFieldExpr(newMock);
          expect(svc.getModel().where.conditions.length).toBe(2);
        })
      );
    });

    it('should UPDATE the same condition by index', async () => {
      const { layer } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          const mockWhereObj = getMockWhereObj();
          svc.upsertWhereFieldExpr(mockWhereObj);
          expect(svc.getModel().where.conditions.length).toBe(1);

          const newField = 'marcs_bank_account';
          const newMock = getMockWhereObj();
          newMock.fieldCompareExpr.condition.field.fieldName = newField;
          svc.upsertWhereFieldExpr(newMock);
          expect(svc.getModel().where.conditions.length).toBe(1);
          expect((svc.getModel().where.conditions[0] as any).condition.field.fieldName).toContain(newField);
        })
      );
    });

    it('should DELETE condition by index', async () => {
      const { layer } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          svc.upsertWhereFieldExpr(getMockWhereObj());
          expect(svc.getModel().where.conditions.length).toBe(1);
          svc.removeWhereFieldCondition(getMockWhereObj().fieldCompareExpr);
          expect(svc.getModel().where.conditions.length).toBe(0);
        })
      );
    });

    it('should UPDATE AND | OR in the model', async () => {
      const { layer } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          expect(svc.getModel().where.andOr).toBeUndefined();
          svc.setAndOr(AndOr.And);
          expect(svc.getModel().where.andOr).toContain(AndOr.And);
          svc.setAndOr(AndOr.Or);
          expect(svc.getModel().where.andOr).toContain(AndOr.Or);
        })
      );
    });
  });

  describe('ORDER BY', () => {
    it('should add, update, remove order by fields in model', async () => {
      const { layer, setState } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          setState.mockClear();
          expect(svc.getModel().orderBy.length).toEqual(0);

          svc.addUpdateOrderByField(mockOrderBy);
          expect(svc.getModel().orderBy.length).toBe(1);
          expect(svc.getModel().orderBy[0].field).toContain(mockOrderBy.field);
          expect(svc.getModel().orderBy[0].order).toContain(mockOrderBy.order);
          expect(svc.getModel().orderBy[0].nulls).toContain(mockOrderBy.nulls);

          svc.addUpdateOrderByField(mockOrderBy);
          expect(svc.getModel().orderBy.length).toBe(1);

          svc.addUpdateOrderByField({ field: 'orderBy1', order: undefined, nulls: 'NULLS LAST' });
          expect(svc.getModel().orderBy[0].order).not.toBeDefined();

          svc.removeOrderByField(mockOrderBy.field);
          expect(svc.getModel().orderBy.length).toBe(0);
          expect(setState).toHaveBeenCalledTimes(4);
        })
      );
    });

    it('should update limit in model', async () => {
      const { layer, setState } = makeTestMessageLayer();
      await runWithModelService(layer, svc =>
        Effect.sync(() => {
          setState.mockClear();
          expect(svc.getModel().limit).toEqual('');

          svc.changeLimit('11');
          expect(svc.getModel().limit).toBe('11');

          svc.changeLimit(undefined);
          expect(svc.getModel().limit).toBe('');

          expect(setState).toHaveBeenCalledTimes(2);
        })
      );
    });
  });

  it('Receive SOQL Text from editor (with comments)', async () => {
    const { layer, emit } = makeTestMessageLayer();
    await runWithModelService(layer, svc =>
      Effect.sync(() => {
        const soqlText = '// This is a comment\n\n\n// Another comment\n\nSELECT Id FROM Foo';
        emit({ ...soqlEditorEvent, payload: soqlText });

        expect(svc.getModel().sObject).toEqual('Foo');
        expect(svc.getModel().fields[0]).toEqual('Id');
        expect(svc.getModel().errors.length).toEqual(0);
        expect(svc.getModel().unsupported.length).toEqual(0);
        expect(svc.getModel().headerComments).toEqual('// This is a comment\n\n\n// Another comment\n\n');

        svc.setSObject('Bar');
        svc.setFields(['Name']);

        expect(svc.getModel().sObject).toEqual('Bar');
        expect(svc.getModel().fields[0]).toEqual('Name');
        expect(svc.getModel().originalSoqlStatement).toContain('// This is a comment\n\n\n// Another comment\n\n');
        expect(svc.getModel().originalSoqlStatement).toContain('SELECT Name');
        expect(svc.getModel().originalSoqlStatement).toContain('FROM Bar');
        expect(svc.getModel().headerComments).toEqual('// This is a comment\n\n\n// Another comment\n\n');
      })
    );
  });
});
