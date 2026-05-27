/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @lwc/lwc/prefer-custom-event */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-empty-function */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { api, createElement } from 'lwc';
import { Layer } from 'effect';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import App from 'querybuilder/app';
import {
  toolingModelTemplate,
  ToolingModelJson
} from '../../../../../../src/soql-builder-ui/modules/querybuilder/services/toolingModelService';
import {
  MessageType,
  SoqlEditorEvent
} from '../../../../../../src/soql-builder-ui/modules/querybuilder/services/message/soqlEditorEvent';
import {
  MessageService,
  IMessageService
} from '../../../../../../src/soql-builder-ui/modules/querybuilder/services/message/iMessageService';

const makeTestMessageLayer = () => {
  const listeners: Array<(e: SoqlEditorEvent) => void> = [];
  const sendMessage = jest.fn();
  const service: IMessageService = {
    onMessage: cb => {
      listeners.push(cb);
    },
    sendMessage,
    setState: jest.fn(),
    getState: jest.fn()
  };
  const emit = (event: SoqlEditorEvent) => listeners.forEach(l => l(event));
  const layer = Layer.succeed(MessageService, service);
  return { layer, emit, sendMessage };
};

class TestApp extends App {
  @api
  public query: ToolingModelJson = toolingModelTemplate;
  @api
  public fields: string[] = [];
  @api
  public isFromLoading = false;
  @api
  public isFieldsLoading = false;
  @api
  public isQueryRunning = false;
}

describe('App should', () => {
  let app: TestApp;
  let emitMessage: (e: SoqlEditorEvent) => void;
  let sendMessage: jest.Mock;
  const accountQuery = 'SELECT Id FROM Account';
  const soqlEditorEvent: SoqlEditorEvent = { type: MessageType.TEXT_SOQL_CHANGED, payload: accountQuery };
  const querybuilderFromSelector = 'querybuilder-from';

  const createSoqlEditorEvent = (
    queryOverride = accountQuery,
    eventOverride?: Partial<SoqlEditorEvent>
  ): SoqlEditorEvent => ({
    ...soqlEditorEvent,
    ...eventOverride,
    payload: queryOverride
  });

  beforeEach(async () => {
    const { layer, emit, sendMessage: sm } = makeTestMessageLayer();
    emitMessage = emit;
    sendMessage = sm;
    document.body.setAttribute('class', 'vscode-dark');
    app = createElement('querybuilder-app', { is: TestApp });
    app.appLayer = layer;
    document.body.appendChild(app);
    await app._ready;
  });

  afterEach(() => {
    jest.clearAllMocks();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  describe('GENERAL', () => {
    it('display the app', () => {
      expect(app.shadowRoot.querySelectorAll(querybuilderFromSelector).length).toEqual(1);
      expect(app.shadowRoot.querySelectorAll('querybuilder-fields').length).toEqual(1);
      expect(app.shadowRoot.querySelectorAll('querybuilder-query-preview').length).toEqual(1);
      expect(app.shadowRoot.querySelectorAll('querybuilder-where').length).toEqual(1);
      expect(app.shadowRoot.querySelectorAll('querybuilder-order-by').length).toEqual(1);
      expect(app.shadowRoot.querySelectorAll('querybuilder-limit').length).toEqual(1);
    });

    it('set the body class on the sub components', () => {
      expect(app.shadowRoot.querySelectorAll('.dark').length).toBeGreaterThan(1);
    });

    it('should clear fields when sobject is same but fields are empty', async () => {
      expect(sendMessage).not.toHaveBeenCalledWith({ type: MessageType.SOBJECT_METADATA_REQUEST, payload: 'Account' });
      app.fields = [];
      emitMessage(createSoqlEditorEvent(accountQuery));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalledWith({ type: MessageType.SOBJECT_METADATA_REQUEST, payload: 'Account' });
      expect(app.fields.length).toEqual(0);
    });

    it('should send a runquery message to vs code with runquery event', async () => {
      const header = app.shadowRoot.querySelector('querybuilder-header');
      header.dispatchEvent(new Event('header__run_query'));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalledWith({ type: MessageType.RUN_SOQL_QUERY });
    });

    it('should clear isQueryRunning flag when run query returns', async () => {
      app.isQueryRunning = true;
      emitMessage({ type: MessageType.RUN_SOQL_QUERY_DONE });
      await Promise.resolve();
      expect(app.isQueryRunning).toEqual(false);
    });

    it('not process an incoming message if the soql statement has not changed', async () => {
      let soqlStatement = accountQuery;
      emitMessage(createSoqlEditorEvent(soqlStatement));
      await Promise.resolve();
      expect(app.query.originalSoqlStatement).toEqual(soqlStatement);
      expect(app.query.fields.length).toEqual(1);

      soqlStatement = 'Select Id, Name from Account';
      emitMessage(createSoqlEditorEvent(soqlStatement));
      await Promise.resolve();
      expect(app.query.originalSoqlStatement).toEqual(soqlStatement);
      expect(app.query.fields.length).toEqual(2);
    });
  });

  describe('FIELD SELECTION', () => {
    it('should send message to vs code with Field Selection event', async () => {
      emitMessage(createSoqlEditorEvent(accountQuery));
      await Promise.resolve();
      const fields = app.shadowRoot.querySelector('querybuilder-fields');
      sendMessage.mockClear();
      const eventPayload = { detail: { fields: ['Id', 'Name'] } };
      fields.dispatchEvent(new CustomEvent('fields__selected', eventPayload));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalled();
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(MessageType.UI_SOQL_CHANGED);
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).payload).toContain(
        'SELECT ' + eventPayload.detail.fields.join(', ')
      );
    });

    it('should send message to vs code with Clear All Fields event', async () => {
      emitMessage(createSoqlEditorEvent(accountQuery));
      await Promise.resolve();
      const fields = app.shadowRoot.querySelector('querybuilder-fields');
      sendMessage.mockClear();
      fields.dispatchEvent(new CustomEvent('fields__clearall', {}));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalled();
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(MessageType.UI_SOQL_CHANGED);
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).payload).not.toContain('SELECT Id');
    });

    it('should send message to vs code with Select All Fields event', async () => {
      const accountFields = ['Id', 'Name', 'Blah'];
      emitMessage(createSoqlEditorEvent(accountQuery));
      emitMessage({
        type: MessageType.SOBJECT_METADATA_RESPONSE,
        payload: { fields: accountFields.map(f => ({ name: f })) } as any
      });
      await Promise.resolve();
      const fields = app.shadowRoot.querySelector('querybuilder-fields');
      sendMessage.mockClear();
      fields.dispatchEvent(new CustomEvent('fields__selectall', {}));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalled();
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(MessageType.UI_SOQL_CHANGED);
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).payload).toContain(
        'SELECT ' + accountFields.sort().join(', ')
      );
    });
  });

  describe('HANDLE METADATA', () => {
    it('load sobjects immediately but not fields', () => {
      expect(app.isFromLoading).toEqual(true);
      expect(app.isFieldsLoading).toEqual(false);
    });

    it('should load sobject definitions at creation', () => {
      expect(sendMessage).toHaveBeenCalledWith({ type: MessageType.SOBJECTS_REQUEST });
    });

    it('should load sobject metadata with valid query and stop loading when returned', async () => {
      expect(app.isFieldsLoading).toEqual(false);
      expect(sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: MessageType.SOBJECT_METADATA_REQUEST })
      );
      emitMessage(createSoqlEditorEvent());
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalledWith({ type: MessageType.SOBJECT_METADATA_REQUEST, payload: 'Account' });
      expect(app.isFieldsLoading).toEqual(true);
      emitMessage({ type: MessageType.SOBJECT_METADATA_RESPONSE, payload: { fields: [] } as any });
      await Promise.resolve();
      expect(app.isFieldsLoading).toEqual(false);
    });

    it('should request sobject metadata when sobject is changed', async () => {
      emitMessage(createSoqlEditorEvent());
      await Promise.resolve();
      const metaCalls = sendMessage.mock.calls.filter((c: any[]) => c[0].type === MessageType.SOBJECT_METADATA_REQUEST);
      expect(metaCalls.length).toEqual(1);

      emitMessage(createSoqlEditorEvent('SELECT Id FROM Contact'));
      await Promise.resolve();
      const metaCalls2 = sendMessage.mock.calls.filter(
        (c: any[]) => c[0].type === MessageType.SOBJECT_METADATA_REQUEST
      );
      expect(metaCalls2.length).toEqual(2);
      expect(metaCalls2[1][0].payload).toEqual('Contact');
    });

    it('should stop the loading flag when sobjects return', async () => {
      expect(app.isFromLoading).toEqual(true);
      emitMessage({ type: MessageType.SOBJECTS_RESPONSE, payload: ['Hey', 'Joe'] });
      await Promise.resolve();
      expect(app.isFromLoading).toEqual(false);
    });
  });

  describe('HANDLE ERRORS', () => {
    const warningNotificationSelector = '.warning-notification';

    const flushLwc = () => new Promise(r => setTimeout(r, 0));

    it('block the query builder ui on unrecoverable error', async () => {
      let warningElement = app.shadowRoot.querySelectorAll(warningNotificationSelector);
      let queryBuilder = app.shadowRoot.querySelectorAll(querybuilderFromSelector);
      expect(queryBuilder.length).toBeTruthy();
      expect(warningElement.length).toBeFalsy();
      emitMessage(createSoqlEditorEvent('SELECT Id FROM Account GROUP BY'));
      await flushLwc();
      warningElement = app.shadowRoot.querySelectorAll(warningNotificationSelector);
      queryBuilder = app.shadowRoot.querySelectorAll(querybuilderFromSelector);
      expect(warningElement.length).toBeTruthy();
      expect(queryBuilder.length).toBeFalsy();
    });

    it('not block the query builder ui on recoverable error', async () => {
      let blockingElement = app.shadowRoot.querySelectorAll(warningNotificationSelector);
      expect(blockingElement.length).toBeFalsy();
      emitMessage(createSoqlEditorEvent('SELECT FROM Account'));
      await flushLwc();
      blockingElement = app.shadowRoot.querySelectorAll(warningNotificationSelector);
      expect(blockingElement.length).toBeFalsy();
    });

    it('block the query builder on unsupported syntax', async () => {
      let blockingElement = app.shadowRoot.querySelectorAll(warningNotificationSelector);
      let queryBuilder = app.shadowRoot.querySelectorAll(querybuilderFromSelector);
      expect(queryBuilder.length).toBeTruthy();
      expect(blockingElement.length).toBeFalsy();
      emitMessage(createSoqlEditorEvent('SELECT Id FROM Account GROUP BY'));
      await flushLwc();
      blockingElement = app.shadowRoot.querySelectorAll(warningNotificationSelector);
      queryBuilder = app.shadowRoot.querySelectorAll(querybuilderFromSelector);
      expect(queryBuilder.length).not.toBeTruthy();
      expect(blockingElement.length).toBeTruthy();
    });

    it('allows the user to dismiss blocking message', async () => {
      emitMessage(createSoqlEditorEvent('SELECT Id FROM Account GROUP BY'));
      await flushLwc();
      app.shadowRoot.querySelector('.warning-notification__dismiss button').click();
      await flushLwc();
      expect(app.shadowRoot.querySelectorAll('.unsupported-syntax-overlay').length).toBeFalsy();
    });
  });

  describe('WHERE', () => {
    it('should send message to vs code with SELECTION event', async () => {
      const where = app.shadowRoot.querySelector('querybuilder-where');
      sendMessage.mockClear();
      const eventPayload = {
        detail: {
          fieldCompareExpr: {
            condition: {
              field: { fieldName: 'test' },
              operator: '=',
              compareValue: { type: 'STRING', value: "'pass'" }
            },
            index: 0
          },
          andOr: 'AND'
        }
      };
      where.dispatchEvent(new CustomEvent('where__group_selection', eventPayload));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalled();
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(MessageType.UI_SOQL_CHANGED);
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).payload).toContain(
        eventPayload.detail.fieldCompareExpr.condition.field.fieldName
      );
    });

    it('should send message to vs code with REMOVE CONDITION event', async () => {
      const where = app.shadowRoot.querySelector('querybuilder-where');
      sendMessage.mockClear();
      const eventPayload = { detail: { fieldCompareExpr: { field: 'test', index: 0 } } };
      where.dispatchEvent(new CustomEvent('where__condition_removed', eventPayload));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalled();
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(MessageType.UI_SOQL_CHANGED);
    });

    it('should send message to vs code with AND OR selection event', async () => {
      const where = app.shadowRoot.querySelector('querybuilder-where');
      sendMessage.mockClear();
      where.dispatchEvent(new CustomEvent('where__andor_selection', { detail: { andOr: 'AND' } }));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalled();
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(MessageType.UI_SOQL_CHANGED);
    });
  });

  describe('ORDER BY', () => {
    it('send orderby message to vs code when orderby added', async () => {
      const orderBy = app.shadowRoot.querySelector('querybuilder-order-by');
      sendMessage.mockClear();
      const eventPayload = { detail: { field: 'People are Strange' } };
      orderBy.dispatchEvent(new CustomEvent('orderby__selected', eventPayload));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalled();
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(MessageType.UI_SOQL_CHANGED);
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).payload).toContain(eventPayload.detail.field);
    });

    it('send orderby message to vs code when orderby removed', async () => {
      const orderBy = app.shadowRoot.querySelector('querybuilder-order-by');
      sendMessage.mockClear();
      const eventPayload = { detail: { field: 'People are Strange' } };
      orderBy.dispatchEvent(new CustomEvent('orderby__removed', eventPayload));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalled();
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(MessageType.UI_SOQL_CHANGED);
    });
  });

  describe('LIMIT', () => {
    it('send limit in message to vs code when limit changed', async () => {
      const limit = app.shadowRoot.querySelector('querybuilder-limit');
      sendMessage.mockClear();
      const eventPayload = { detail: { limit: '11' } };
      limit.dispatchEvent(new CustomEvent('limit__changed', eventPayload));
      await Promise.resolve();
      expect(sendMessage).toHaveBeenCalled();
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).type).toEqual(MessageType.UI_SOQL_CHANGED);
      expect((sendMessage.mock.calls[0][0] as SoqlEditorEvent).payload).toContain(eventPayload.detail.limit);
    });
  });
});
