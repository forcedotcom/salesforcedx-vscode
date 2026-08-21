/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  SoqlBuilderServiceError,
  createInitialSoqlBuilderState,
  decodeSoqlBuilderMetadata,
  type SoqlBuilderAction,
  type SoqlBuilderServiceError as ServiceError,
  type SoqlBuilderState
} from '@salesforce/soql-builder-ui/domain';
import {
  SoqlBuilderService,
  type SoqlBuilderService as SoqlBuilderServiceShape
} from '@salesforce/soql-builder-ui/service';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Match from 'effect/Match';
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
  type HostToUiSoqlEditorEvent
} from '../modules/querybuilder/services/message/soqlEditorEvent';

type ServiceOperation = ServiceError['operation'];

type DeferredSoqlBuilderHostEvent = Extract<
  HostToUiSoqlEditorEvent,
  { readonly type: typeof MessageType.RUN_SOQL_QUERY_DONE | typeof MessageType.GET_QUERY_PLAN_DONE }
>;

type SoqlBuilderHostToUiEvent = Exclude<HostToUiSoqlEditorEvent, DeferredSoqlBuilderHostEvent>;

const isSoqlBuilderHostToUiEvent = (
  event: HostToUiSoqlEditorEvent
): event is SoqlBuilderHostToUiEvent =>
  event.type !== MessageType.RUN_SOQL_QUERY_DONE && event.type !== MessageType.GET_QUERY_PLAN_DONE;

const toServiceError = (operation: ServiceOperation, error: unknown): ServiceError =>
  new SoqlBuilderServiceError({
    details: String(error),
    operation
  });

const tryServiceOperation = (operation: ServiceOperation, evaluate: () => void) =>
  Effect.try({
    try: evaluate,
    catch: error => toServiceError(operation, error)
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
  decodeSoqlBuilderMetadata(metadata).pipe(Effect.mapError(error => toServiceError('subscribe', error)));

const SavedStateSchema = Schema.Struct({
  errorMessage: Schema.optional(Schema.String),
  hasNoDefaultOrg: Schema.Boolean,
  isFieldsLoading: Schema.Boolean,
  isObjectsLoading: Schema.Boolean,
  metadata: Schema.Unknown,
  query: Schema.Struct({
    fields: Schema.Array(Schema.NonEmptyTrimmedString),
    originalSoqlStatement: Schema.String,
    sObject: Schema.String
  })
});

const decodeSavedState = (input: unknown) =>
  Schema.decodeUnknown(SavedStateSchema)(input).pipe(
    Effect.flatMap(saved =>
      validateMetadata(saved.metadata).pipe(Effect.map(metadata => ({ ...saved, metadata })))
    )
  );

const formatQuery = (sObject: string, fields: readonly string[]): string => {
  if (sObject.length === 0) return '';
  const selection = fields.length > 0 ? fields.join(', ') : 'Id';
  return `SELECT ${selection}\n    FROM ${sObject}`;
};

const parseFoundationQuery = (statement: string): SoqlBuilderState['query'] => {
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
  tryServiceOperation('dispatch', () => {
    messageService.setState({
      ...state,
      metadata: {
        fields: [...state.metadata.fields],
        objects: [...state.metadata.objects]
      },
      query: { ...state.query, fields: [...state.query.fields] }
    });
  });

const makeVscodeSoqlBuilderService = Effect.gen(function* () {
  const messageService = yield* MessageService;
  const savedState = yield* decodeSavedState(messageService.getState()).pipe(Effect.orElseSucceed(createInitialSoqlBuilderState));
  const state = yield* SubscriptionRef.make(savedState);
  const messages = yield* Queue.unbounded<SoqlBuilderHostToUiEvent>();
  const errors = yield* PubSub.unbounded<ServiceError>();
  const removeMessageListener = messageService.onMessage(event => {
    if (isSoqlBuilderHostToUiEvent(event)) messages.unsafeOffer(event);
  });
  yield* Effect.addFinalizer(() =>
    Effect.sync(removeMessageListener).pipe(
      Effect.andThen(Queue.shutdown(messages)),
      Effect.andThen(PubSub.shutdown(errors))
    )
  );

  const reportMessageError = <A>(handler: Effect.Effect<A, ServiceError>) =>
    handler.pipe(
      Effect.catchTag('SoqlBuilderServiceError', error => PubSub.publish(errors, error).pipe(Effect.asVoid))
    );

  const setQuery = (query: SoqlBuilderState['query']) =>
    SubscriptionRef.update(state, current => ({ ...current, query }));

  const handleMessage = Match.type<SoqlBuilderHostToUiEvent>().pipe(
    Match.discriminatorsExhaustive('type')({
      [MessageType.SOBJECTS_RESPONSE]: event =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          const metadata = yield* validateMetadata({
            fields: current.metadata.fields,
            objects: toObjectMetadata(event.payload)
          });
          yield* SubscriptionRef.set(state, { ...current, isObjectsLoading: false, metadata });
        }),
      [MessageType.SOBJECT_METADATA_RESPONSE]: event =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          const metadata = yield* validateMetadata({
            fields: toFieldMetadata(event.payload),
            objects: current.metadata.objects
          });
          yield* SubscriptionRef.set(state, { ...current, isFieldsLoading: false, metadata });
        }),
      [MessageType.TEXT_SOQL_CHANGED]: event => setQuery(parseFoundationQuery(event.payload)),
      [MessageType.NO_DEFAULT_ORG]: () =>
        SubscriptionRef.update(state, current => ({ ...current, hasNoDefaultOrg: true })),
      [MessageType.CONNECTION_CHANGED]: () =>
        SubscriptionRef.update(state, current => ({ ...current, hasNoDefaultOrg: false })).pipe(
          Effect.andThen(
            tryServiceOperation('subscribe', () =>
              messageService.sendMessage({ type: MessageType.SOBJECTS_REQUEST })
            )
          )
        )
    })
  );

  yield* Stream.fromQueue(messages).pipe(
    Stream.runForEach(event => reportMessageError(handleMessage(event))),
    Effect.forkScoped
  );

  yield* SubscriptionRef.update(state, current => ({ ...current, isObjectsLoading: true }));
  yield* tryServiceOperation('initialize', () =>
    messageService.sendMessage({ type: MessageType.SOBJECTS_REQUEST })
  );

  const dispatch: SoqlBuilderServiceShape['dispatch'] = (action: SoqlBuilderAction) =>
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
      yield* tryServiceOperation('dispatch', () => {
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

  return SoqlBuilderService.of({
    dispatch,
    initialState: SubscriptionRef.get(state),
    stateChanges: Stream.merge(
      state.changes.pipe(Stream.drop(1)),
      Stream.fromPubSub(errors).pipe(Stream.mapEffect(error => Effect.fail(error)))
    )
  });
});

export const VscodeSoqlBuilderServiceLive = Layer.scoped(SoqlBuilderService, makeVscodeSoqlBuilderService);
