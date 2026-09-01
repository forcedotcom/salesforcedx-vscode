/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  SoqlBuilderServiceError,
  SoqlBuilderStateSchema,
  type SoqlBuilderAction,
  type SoqlBuilderState
} from '@salesforce/soql-builder-ui/domain';
import { SoqlBuilderService } from '@salesforce/soql-builder-ui/service';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import {
  parseSoqlBuilderQuery,
  serializeSoqlBuilderQuery
} from '../../../../src/soql-builder-ui/lit/soqlBuilderModelAdapter';
import { VscodeSoqlBuilderServiceLive } from '../../../../src/soql-builder-ui/lit/vscodeSoqlBuilderService';
import {
  MessageService,
  type IMessageService
} from '../../../../src/soql-builder-ui/modules/querybuilder/services/message/iMessageService';
import {
  MessageType,
  type SoqlEditorEvent
} from '../../../../src/soql-builder-ui/modules/querybuilder/services/message/soqlEditorEvent';

const accountMetadata = {
  childRelationships: [],
  custom: false,
  fields: [
    {
      aggregatable: false,
      custom: false,
      defaultValue: null,
      extraTypeInfo: null,
      filterable: true,
      groupable: true,
      inlineHelpText: null,
      label: 'Account ID',
      name: 'Id',
      nillable: false,
      picklistValues: [],
      referenceTo: [],
      relationshipName: null,
      sortable: true,
      type: 'id'
    }
  ],
  label: 'Account',
  name: 'Account',
  queryable: true
} as const;

const makeMessageHarness = (savedState?: unknown) => {
  const messages: SoqlEditorEvent[] = [];
  const states: unknown[] = [];
  let listener: ((event: SoqlEditorEvent) => void) | undefined;
  let finalized = false;
  const service: IMessageService = {
    getState: () => savedState,
    onMessage: callback => {
      listener = callback;
      return () => {
        finalized = true;
        listener = undefined;
      };
    },
    sendMessage: message => messages.push(message),
    setState: state => states.push(state)
  };

  return {
    emit: (event: SoqlEditorEvent) => listener?.(event),
    isFinalized: () => finalized,
    layer: Layer.succeed(MessageService, service),
    messages,
    states
  };
};

const runWithService = <A>(
  messageLayer: Layer.Layer<MessageService>,
  body: (service: SoqlBuilderService) => Effect.Effect<A, SoqlBuilderServiceError>
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* SoqlBuilderService;
      return yield* body(service);
    }).pipe(Effect.provide(VscodeSoqlBuilderServiceLive.pipe(Layer.provide(messageLayer))), Effect.scoped)
  );

const lastSavedState = (states: readonly unknown[]): SoqlBuilderState =>
  Schema.decodeUnknownSync(SoqlBuilderStateSchema)(states.at(-1));

describe('VscodeSoqlBuilderService', () => {
  it('round-trips every supported query clause through the typed model adapter', () => {
    const statement =
      "// retained comment\nSELECT Name, Id FROM Account WHERE Name = 'Acme' AND Id != NULL ORDER BY Name DESC NULLS LAST LIMIT 10 ALL ROWS";
    const parsed = parseSoqlBuilderQuery(statement);
    const restored = parseSoqlBuilderQuery(serializeSoqlBuilderQuery(parsed));

    expect(restored.headerComments).toContain('retained comment');
    expect(restored.fields).toEqual(['Name', 'Id']);
    expect(restored.where.andOr).toBe('AND');
    expect(restored.where.conditions).toHaveLength(2);
    expect(restored.orderBy).toEqual([{ field: 'Name', order: 'DESC', nulls: 'NULLS LAST' }]);
    expect(restored.limit).toEqual({ _tag: 'Valid', value: 10 });
    expect(restored.allRows).toBe(true);
  });

  it('maps every public action to immutable state and the existing host messages', async () => {
    const harness = makeMessageHarness();

    await runWithService(harness.layer, service =>
      Effect.gen(function* () {
        const actions: SoqlBuilderAction[] = [
          { _tag: 'ObjectSelected', objectName: 'Account' },
          { _tag: 'FieldsSelected', fieldNames: ['Id', 'Name'] },
          { _tag: 'AllFieldsSelected' },
          { _tag: 'AllFieldsCleared' },
          {
            _tag: 'WhereConditionUpserted',
            andOr: 'AND',
            condition: {
              condition: {
                compareValue: { type: 'STRING', value: "'Acme'" },
                field: { fieldName: 'Name' },
                operator: '='
              },
              index: 0
            }
          },
          { _tag: 'WhereConjunctionChanged', andOr: 'OR' },
          { _tag: 'WhereConditionRemoved', index: 0 },
          {
            _tag: 'OrderByUpserted',
            orderBy: { field: 'Name', nulls: 'NULLS LAST', order: 'ASC' }
          },
          { _tag: 'OrderByRemoved', fieldName: 'Name' },
          { _tag: 'LimitChanged', limit: { _tag: 'Valid', value: 25 } },
          { _tag: 'AllRowsChanged', allRows: true },
          { _tag: 'NotificationsDismissed' },
          { _tag: 'SetDefaultOrgRequested' },
          { _tag: 'RunQueryRequested' },
          { _tag: 'QueryPlanRequested' }
        ];

        for (const action of actions) yield* service.dispatch(action);
      })
    );

    const messageTypes = harness.messages.map(message => message.type);
    expect(messageTypes[0]).toBe(MessageType.SOBJECTS_REQUEST);
    expect(messageTypes).toContain(MessageType.SOBJECT_METADATA_REQUEST);
    expect(messageTypes).toContain(MessageType.UI_SOQL_CHANGED);
    expect(messageTypes).toContain(MessageType.SET_DEFAULT_ORG);
    expect(messageTypes).toContain(MessageType.RUN_SOQL_QUERY);
    expect(messageTypes).toContain(MessageType.GET_QUERY_PLAN);

    const state = lastSavedState(harness.states);
    expect(state.query.sObject).toBe('Account');
    expect(state.query.limit).toEqual({ _tag: 'Valid', value: 25 });
    expect(state.query.allRows).toBe(true);
    expect(state.notificationsDismissed).toBe(true);
  });

  it('resets dependent clauses and requests metadata once when From changes', async () => {
    const harness = makeMessageHarness({
      originalSoqlStatement:
        "SELECT Id FROM Account WHERE Name = 'Acme' ORDER BY Name DESC NULLS LAST LIMIT 10 ALL ROWS"
    });

    const state = await runWithService(harness.layer, service =>
      Effect.gen(function* () {
        yield* service.dispatch({ _tag: 'ObjectSelected', objectName: 'Contact' });
        yield* service.dispatch({ _tag: 'ObjectSelected', objectName: 'Contact' });
        return yield* service.initialState;
      })
    );

    expect(state.query).toMatchObject({
      allRows: false,
      fields: [],
      limit: { _tag: 'Empty' },
      orderBy: [],
      sObject: 'Contact',
      where: { conditions: [] }
    });
    expect(
      harness.messages.filter(
        message => message.type === MessageType.SOBJECT_METADATA_REQUEST && message.payload === 'Contact'
      )
    ).toHaveLength(1);
    const publishedQuery = harness.messages.findLast(message => message.type === MessageType.UI_SOQL_CHANGED)?.payload;
    expect(publishedQuery).toContain('FROM Contact');
    expect(publishedQuery).not.toMatch(/WHERE|ORDER BY|LIMIT|ALL ROWS/u);
  });

  it('clears object metadata for a missing org and ignores a late object-list response', async () => {
    const harness = makeMessageHarness();

    const state = await runWithService(harness.layer, service =>
      Effect.gen(function* () {
        harness.emit({ type: MessageType.SOBJECTS_RESPONSE, payload: ['Account'] });
        yield* Effect.sleep(Duration.millis(10));
        harness.emit({ type: MessageType.NO_DEFAULT_ORG });
        harness.emit({ type: MessageType.SOBJECTS_RESPONSE, payload: ['PreviousOrgObject__c'] });
        yield* Effect.sleep(Duration.millis(10));
        return yield* service.initialState;
      })
    );

    expect(state.hasNoDefaultOrg).toBe(true);
    expect(state.metadata.objects).toEqual([]);
    expect(state.isObjectsLoading).toBe(false);
  });

  it('clears metadata and reloads a restored selection after the default org changes', async () => {
    const harness = makeMessageHarness({ originalSoqlStatement: 'SELECT Id FROM Account' });

    const state = await runWithService(harness.layer, service =>
      Effect.gen(function* () {
        harness.emit({ type: MessageType.SOBJECTS_RESPONSE, payload: ['Account', 'Contact'] });
        yield* Effect.sleep(Duration.millis(10));
        harness.emit({ type: MessageType.CONNECTION_CHANGED });
        yield* Effect.sleep(Duration.millis(10));
        return yield* service.initialState;
      })
    );

    expect(state.hasNoDefaultOrg).toBe(false);
    expect(state.metadata.objects).toEqual([]);
    expect(state.isObjectsLoading).toBe(true);
    expect(state.isFieldsLoading).toBe(true);
    expect(harness.messages.filter(message => message.type === MessageType.SOBJECTS_REQUEST)).toHaveLength(2);
    expect(
      harness.messages.filter(
        message => message.type === MessageType.SOBJECT_METADATA_REQUEST && message.payload === 'Account'
      )
    ).toHaveLength(2);
  });

  it('restores the complete query and does not echo external text changes', async () => {
    const harness = makeMessageHarness();
    const statement =
      "// retained comment\nSELECT Name FROM Account WHERE Name = 'Acme' ORDER BY Name DESC NULLS LAST LIMIT 10 ALL ROWS";

    const state = await runWithService(harness.layer, service =>
      Effect.gen(function* () {
        const stateFiber = yield* service.stateChanges.pipe(Stream.runHead, Effect.fork);
        yield* Effect.sleep(Duration.millis(10));
        harness.emit({ type: MessageType.TEXT_SOQL_CHANGED, payload: statement });
        return Option.getOrThrow(yield* Fiber.join(stateFiber));
      })
    );

    expect(state.query.headerComments).toContain('retained comment');
    expect(state.query.fields).toEqual(['Name']);
    expect(state.query.where.conditions).toHaveLength(1);
    expect(state.query.orderBy).toEqual([{ field: 'Name', order: 'DESC', nulls: 'NULLS LAST' }]);
    expect(state.query.limit).toEqual({ _tag: 'Valid', value: 10 });
    expect(state.query.allRows).toBe(true);
    expect(harness.messages.filter(message => message.type === MessageType.UI_SOQL_CHANGED)).toHaveLength(0);
  });

  it('restores a legacy string limit as a valid numeric limit', async () => {
    const harness = makeMessageHarness({
      limit: '10',
      originalSoqlStatement: 'SELECT Id FROM Account LIMIT 10'
    });

    const state = await runWithService(harness.layer, service => service.initialState);

    expect(state.query.limit).toEqual({ _tag: 'Valid', value: 10 });
  });

  it('retains invalid limit input without publishing malformed SOQL', async () => {
    const harness = makeMessageHarness();

    const state = await runWithService(harness.layer, service =>
      Effect.gen(function* () {
        yield* service.dispatch({ _tag: 'ObjectSelected', objectName: 'Account' });
        const publishedBeforeInvalid = harness.messages.filter(
          message => message.type === MessageType.UI_SOQL_CHANGED
        ).length;

        yield* service.dispatch({ _tag: 'LimitChanged', limit: { _tag: 'Invalid', input: '-1' } });
        const invalidState = yield* service.initialState;
        expect(invalidState.query.limit).toEqual({ _tag: 'Invalid', input: '-1' });
        expect(harness.messages.filter(message => message.type === MessageType.UI_SOQL_CHANGED)).toHaveLength(
          publishedBeforeInvalid
        );

        yield* service.dispatch({ _tag: 'LimitChanged', limit: { _tag: 'Empty' } });
        return yield* service.initialState;
      })
    );

    expect(state.query.limit).toEqual({ _tag: 'Empty' });
    const lastQueryMessage = harness.messages.findLast(message => message.type === MessageType.UI_SOQL_CHANGED);
    expect(lastQueryMessage?.payload).not.toContain('LIMIT');
  });

  it('ignores metadata responses for an object that is no longer selected', async () => {
    const harness = makeMessageHarness();

    const state = await runWithService(harness.layer, service =>
      Effect.gen(function* () {
        yield* service.dispatch({ _tag: 'ObjectSelected', objectName: 'Account' });
        yield* service.dispatch({ _tag: 'ObjectSelected', objectName: 'Contact' });

        const stateFiber = yield* service.stateChanges.pipe(Stream.runHead, Effect.fork);
        yield* Effect.sleep(Duration.millis(10));
        harness.emit({
          type: MessageType.SOBJECT_METADATA_RESPONSE,
          payload: accountMetadata
        });
        harness.emit({
          type: MessageType.SOBJECT_METADATA_RESPONSE,
          payload: { ...accountMetadata, label: 'Contact', name: 'Contact' }
        });
        return Option.getOrThrow(yield* Fiber.join(stateFiber));
      })
    );

    expect(state.metadata.selectedObjectName).toBe('Contact');
    expect(state.isFieldsLoading).toBe(false);
  });

  it('tracks query and query-plan progress until the host reports completion', async () => {
    const harness = makeMessageHarness();

    await runWithService(harness.layer, service =>
      Effect.gen(function* () {
        yield* service.dispatch({ _tag: 'RunQueryRequested' });
        yield* service.dispatch({ _tag: 'QueryPlanRequested' });

        const running = yield* service.initialState;
        expect(running.isQueryRunning).toBe(true);
        expect(running.isQueryPlanRunning).toBe(true);

        harness.emit({ type: MessageType.RUN_SOQL_QUERY_DONE });
        harness.emit({ type: MessageType.GET_QUERY_PLAN_DONE });
        yield* Effect.sleep(Duration.millis(10));

        const completed = yield* service.initialState;
        expect(completed.isQueryRunning).toBe(false);
        expect(completed.isQueryPlanRunning).toBe(false);
      })
    );
  });

  it('runs the message-listener finalizer when its scoped layer closes', async () => {
    const harness = makeMessageHarness();
    await runWithService(harness.layer, () => Effect.void);
    expect(harness.isFinalized()).toBe(true);
  });
});
