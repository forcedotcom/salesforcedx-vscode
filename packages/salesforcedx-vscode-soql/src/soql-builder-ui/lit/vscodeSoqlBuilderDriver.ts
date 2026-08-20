/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  SoqlBuilderDriverError,
  SoqlBuilderStateSchema,
  createInitialSoqlBuilderState,
  decodeSoqlBuilderMetadata,
  type SoqlBuilderAction,
  type SoqlBuilderDriverError as DriverError,
  type SoqlBuilderQuery,
  type SoqlBuilderState
} from '@salesforce/soql-builder-ui/domain';
import {
  SoqlBuilderDriver,
  type SoqlBuilderDriver as SoqlBuilderDriverService
} from '@salesforce/soql-builder-ui/driver';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Queue from 'effect/Queue';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  MessageService,
  type IMessageService
} from '../modules/querybuilder/services/message/iMessageService';
import {
  MessageType,
  type SoqlEditorEvent
} from '../modules/querybuilder/services/message/soqlEditorEvent';

type DriverOperation = DriverError['operation'];

const toDriverError = (operation: DriverOperation, error: unknown): DriverError =>
  new SoqlBuilderDriverError({
    details: String(error),
    operation
  });

const tryDriverOperation = (operation: DriverOperation, evaluate: () => void) =>
  Effect.try({
    try: evaluate,
    catch: error => toDriverError(operation, error)
  });

const toObjectMetadata = (names: unknown): unknown =>
  Array.isArray(names) ? names.map(name => ({ label: name, name, queryable: true })) : names;

const toFieldMetadata = (metadata: unknown): unknown => {
  if (typeof metadata !== 'object' || metadata === null || !('fields' in metadata)) return metadata;
  if (!Array.isArray(metadata.fields)) return metadata.fields;

  return metadata.fields.map(field => {
    if (typeof field !== 'object' || field === null) return field;

    const name = 'name' in field ? field.name : undefined;
    return {
      filterable: 'filterable' in field ? field.filterable : false,
      groupable: 'groupable' in field ? field.groupable : false,
      label: 'label' in field ? field.label : name,
      name,
      sortable: 'sortable' in field ? field.sortable : false,
      type: 'type' in field ? field.type : undefined
    };
  });
};

const validateMetadata = (metadata: unknown) =>
  decodeSoqlBuilderMetadata(metadata).pipe(Effect.mapError(error => toDriverError('subscribe', error)));

const formatQuery = (sObject: string, fields: readonly string[]): string => {
  if (sObject.length === 0) return '';
  const selection = fields.length > 0 ? fields.join(', ') : 'Id';
  return `SELECT ${selection}\n    FROM ${sObject}`;
};

const parseFoundationQuery = (statement: string): SoqlBuilderQuery => {
  const match = /^\s*SELECT\s+([\s\S]+?)\s+FROM\s+([A-Za-z_][\w.]*)/iu.exec(statement);
  if (!match) return { fields: [], originalSoqlStatement: statement, sObject: '' };

  const fields = match[1]
    .split(',')
    .map(field => field.trim())
    .filter(field => /^[A-Za-z_][\w.]*$/u.test(field));
  return {
    fields,
    originalSoqlStatement: statement,
    sObject: match[2]
  };
};

const saveViewState = (messageService: IMessageService, state: SoqlBuilderState) =>
  tryDriverOperation('dispatch', () => {
    messageService.setState({
      ...state,
      metadata: {
        fields: [...state.metadata.fields],
        objects: [...state.metadata.objects]
      },
      query: { ...state.query, fields: [...state.query.fields] }
    });
  });

const makeVscodeSoqlBuilderDriver = Effect.gen(function* () {
  const messageService = yield* MessageService;
  const savedState = yield* Schema.decodeUnknown(SoqlBuilderStateSchema)(messageService.getState()).pipe(
    Effect.orElseSucceed(createInitialSoqlBuilderState)
  );
  const state = yield* SubscriptionRef.make(savedState);
  const messages = yield* Queue.unbounded<SoqlEditorEvent>();
  const errors = yield* PubSub.unbounded<DriverError>();
  const removeMessageListener = messageService.onMessage(event => {
    messages.unsafeOffer(event);
  });
  yield* Effect.addFinalizer(() =>
    Effect.sync(removeMessageListener).pipe(
      Effect.andThen(Queue.shutdown(messages)),
      Effect.andThen(PubSub.shutdown(errors))
    )
  );

  const reportMessageError = <A>(handler: Effect.Effect<A, DriverError>) =>
    handler.pipe(Effect.catchAll(error => PubSub.publish(errors, error).pipe(Effect.asVoid)));

  const setQuery = (query: SoqlBuilderQuery) =>
    SubscriptionRef.update(state, current => ({ ...current, query }));

  const handleMessage = (event: SoqlEditorEvent) => {
    switch (event.type) {
      case MessageType.SOBJECTS_RESPONSE:
        return Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          const metadata = yield* validateMetadata({
            fields: current.metadata.fields,
            objects: toObjectMetadata(event.payload)
          });
          yield* SubscriptionRef.set(state, { ...current, isObjectsLoading: false, metadata });
        });
      case MessageType.SOBJECT_METADATA_RESPONSE:
        return Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          const metadata = yield* validateMetadata({
            fields: toFieldMetadata(event.payload),
            objects: current.metadata.objects
          });
          yield* SubscriptionRef.set(state, { ...current, isFieldsLoading: false, metadata });
        });
      case MessageType.TEXT_SOQL_CHANGED:
        return setQuery(parseFoundationQuery(event.payload));
      case MessageType.NO_DEFAULT_ORG:
        return SubscriptionRef.update(state, current => ({ ...current, hasNoDefaultOrg: true }));
      case MessageType.CONNECTION_CHANGED:
        return SubscriptionRef.update(state, current => ({ ...current, hasNoDefaultOrg: false })).pipe(
          Effect.andThen(
            tryDriverOperation('subscribe', () =>
              messageService.sendMessage({ type: MessageType.SOBJECTS_REQUEST })
            )
          )
        );
      default:
        return Effect.void;
    }
  };

  yield* Stream.fromQueue(messages).pipe(
    Stream.runForEach(event => reportMessageError(handleMessage(event))),
    Effect.forkScoped
  );

  yield* SubscriptionRef.update(state, current => ({ ...current, isObjectsLoading: true }));
  yield* tryDriverOperation('initialize', () =>
    messageService.sendMessage({ type: MessageType.SOBJECTS_REQUEST })
  );

  const dispatch: SoqlBuilderDriverService['dispatch'] = (action: SoqlBuilderAction) =>
    Effect.gen(function* () {
      const current = yield* SubscriptionRef.get(state);
      const query =
        action._tag === 'ObjectSelected'
          ? {
              fields: [],
              originalSoqlStatement: formatQuery(action.objectName, []),
              sObject: action.objectName
            }
          : {
              ...current.query,
              fields: [...action.fieldNames],
              originalSoqlStatement: formatQuery(current.query.sObject, action.fieldNames)
            };
      const nextState: SoqlBuilderState = {
        ...current,
        isFieldsLoading: action._tag === 'ObjectSelected',
        metadata:
          action._tag === 'ObjectSelected' ? { ...current.metadata, fields: [] } : current.metadata,
        query
      };

      yield* SubscriptionRef.set(state, nextState);
      yield* tryDriverOperation('dispatch', () => {
        if (action._tag === 'ObjectSelected') {
          messageService.sendMessage({
            payload: action.objectName,
            type: MessageType.SOBJECT_METADATA_REQUEST
          });
        }
        messageService.sendMessage({
          payload: query.originalSoqlStatement,
          type: MessageType.UI_SOQL_CHANGED
        });
      });
      yield* saveViewState(messageService, nextState);
    });

  return SoqlBuilderDriver.of({
    dispatch,
    initialState: SubscriptionRef.get(state),
    stateChanges: Stream.merge(
      state.changes.pipe(Stream.drop(1)),
      Stream.fromPubSub(errors).pipe(Stream.mapEffect(error => Effect.fail(error)))
    )
  });
});

export const VscodeSoqlBuilderDriverLive = Layer.scoped(SoqlBuilderDriver, makeVscodeSoqlBuilderDriver);
