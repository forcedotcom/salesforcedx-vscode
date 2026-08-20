/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  SoqlBuilderServiceError,
  SoqlBuilderStateSchema,
  createInitialSoqlBuilderQuery,
  createInitialSoqlBuilderState,
  decodeSoqlBuilderMetadata,
  type SoqlBuilderAction,
  type SoqlBuilderQuery,
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
import * as Ref from 'effect/Ref';
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
import {
  createSoqlBuilderTelemetry,
  parseSoqlBuilderQuery,
  serializeSoqlBuilderQuery
} from './soqlBuilderModelAdapter';

type ServiceOperation = ServiceError['operation'];

const toServiceError = (operation: ServiceOperation, error: unknown): ServiceError =>
  new SoqlBuilderServiceError({
    details: String(error),
    operation
  });

const tryServiceOperation = <A>(operation: ServiceOperation, evaluate: () => A) =>
  Effect.try({
    try: evaluate,
    catch: error => toServiceError(operation, error)
  });

const toObjectMetadata = (names: readonly string[]) =>
  names.map(name => ({ label: name, name, queryable: true }));

const validateMetadata = (metadata: unknown) =>
  decodeSoqlBuilderMetadata(metadata).pipe(Effect.mapError(error => toServiceError('subscribe', error)));

const parseExternalQuery = (statement: string) =>
  tryServiceOperation('subscribe', () => parseSoqlBuilderQuery(statement));

const serializeQuery = (query: SoqlBuilderQuery) =>
  tryServiceOperation('dispatch', () => serializeSoqlBuilderQuery(query));

const decodeSavedState = (input: unknown) =>
  Schema.decodeUnknown(SoqlBuilderStateSchema)(input).pipe(
    Effect.orElse(() =>
      Schema.decodeUnknown(
        Schema.Struct({
          headerComments: Schema.optional(Schema.String),
          allRows: Schema.Boolean,
          errors: Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
          fields: Schema.Array(Schema.NonEmptyTrimmedString),
          limit: Schema.String,
          orderBy: Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
          originalSoqlStatement: Schema.String,
          sObject: Schema.String,
          unsupported: Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
          where: Schema.Record({ key: Schema.String, value: Schema.Unknown })
        })
      )(input).pipe(
        Effect.flatMap(saved => parseExternalQuery(saved.originalSoqlStatement)),
        Effect.map(query => ({ ...createInitialSoqlBuilderState(), query }))
      )
    ),
    Effect.mapError(error => toServiceError('initialize', error))
  );

const saveViewState = (messageService: IMessageService, state: SoqlBuilderState) =>
  tryServiceOperation('dispatch', () => messageService.setState(state));

const makeVscodeSoqlBuilderService = Effect.gen(function* () {
  const messageService = yield* MessageService;
  const savedState = yield* decodeSavedState(messageService.getState()).pipe(
    Effect.orElseSucceed(createInitialSoqlBuilderState)
  );
  const state = yield* SubscriptionRef.make(savedState);
  const messages = yield* Queue.unbounded<HostToUiSoqlEditorEvent>();
  const errors = yield* PubSub.unbounded<ServiceError>();

  const requestSequence = yield* Ref.make(0);
  const activeMetadataRequestId = yield* Ref.make<string | undefined>(undefined);
  const activeObjectsRequestId = yield* Ref.make<string | undefined>(undefined);

  const removeMessageListener = messageService.onMessage(event => {
    messages.unsafeOffer(event);
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

  const requestObjects = (operation: ServiceOperation) =>
    Effect.gen(function* () {
      const sequence = yield* Ref.updateAndGet(requestSequence, current => current + 1);
      const requestId = `objects-${sequence}`;
      yield* Ref.set(activeObjectsRequestId, requestId);
      yield* tryServiceOperation(operation, () =>
        messageService.sendMessage({ type: MessageType.SOBJECTS_REQUEST, requestId })
      );
    });

  const requestMetadata = (objectName: string, operation: ServiceOperation) =>
    Effect.gen(function* () {
      const sequence = yield* Ref.updateAndGet(requestSequence, current => current + 1);
      const requestId = `metadata-${sequence}`;
      yield* Ref.set(activeMetadataRequestId, requestId);
      yield* tryServiceOperation(operation, () =>
        messageService.sendMessage({
          payload: objectName,
          requestId,
          type: MessageType.SOBJECT_METADATA_REQUEST
        })
      );
    });

  const publishQuery = (current: SoqlBuilderState, query: SoqlBuilderQuery) =>
    Effect.gen(function* () {
      const originalSoqlStatement = yield* serializeQuery(query);
      const nextState: SoqlBuilderState = {
        ...current,
        errorMessage: undefined,
        notificationsDismissed: false,
        query: {
          ...query,
          originalSoqlStatement,
          parseErrors: [],
          unsupportedSyntax: []
        }
      };
      yield* SubscriptionRef.set(state, nextState);
      yield* tryServiceOperation('dispatch', () =>
        messageService.sendMessage({
          payload: originalSoqlStatement,
          type: MessageType.UI_SOQL_CHANGED
        })
      );
      yield* saveViewState(messageService, nextState);
      return nextState;
    });

  const handleMessage = Match.type<HostToUiSoqlEditorEvent>().pipe(
    Match.discriminatorsExhaustive('type')({
      [MessageType.SOBJECTS_RESPONSE]: event =>
        Effect.gen(function* () {
          const activeRequestId = yield* Ref.get(activeObjectsRequestId);
          if (event.requestId !== activeRequestId) return;
          const current = yield* SubscriptionRef.get(state);
          const metadata = yield* validateMetadata({
            ...current.metadata,
            objects: toObjectMetadata(event.payload)
          });
          yield* SubscriptionRef.set(state, { ...current, isObjectsLoading: false, metadata });
        }),
      [MessageType.SOBJECT_METADATA_RESPONSE]: event =>
        Effect.gen(function* () {
          const activeRequestId = yield* Ref.get(activeMetadataRequestId);
          if (event.requestId !== activeRequestId) return;
          const current = yield* SubscriptionRef.get(state);
          if (event.payload.name !== current.query.sObject) return;
          const metadata = yield* validateMetadata({
            childRelationships: event.payload.childRelationships,
            fields: event.payload.fields,
            objects: current.metadata.objects,
            selectedObjectName: event.payload.name
          });
          yield* SubscriptionRef.set(state, { ...current, isFieldsLoading: false, metadata });
        }),
      [MessageType.TEXT_SOQL_CHANGED]: event =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          if (event.payload === current.query.originalSoqlStatement) return;

          const query = yield* parseExternalQuery(event.payload);
          const objectChanged = query.sObject !== current.query.sObject;
          const nextState: SoqlBuilderState = {
            ...current,
            isFieldsLoading: query.sObject.length > 0 && objectChanged,
            metadata: objectChanged
              ? {
                  childRelationships: [],
                  fields: [],
                  objects: current.metadata.objects
                }
              : current.metadata,
            notificationsDismissed: false,
            query
          };
          yield* SubscriptionRef.set(state, nextState);
          yield* saveViewState(messageService, nextState);

          if (query.parseErrors.length > 0 || query.unsupportedSyntax.length > 0) {
            yield* tryServiceOperation('subscribe', () =>
              messageService.sendMessage({
                payload: createSoqlBuilderTelemetry(query),
                type: MessageType.UI_TELEMETRY
              })
            );
          }
          if (query.sObject.length > 0 && objectChanged) {
            yield* requestMetadata(query.sObject, 'subscribe');
          }
        }),
      [MessageType.NO_DEFAULT_ORG]: () =>
        SubscriptionRef.update(state, current => ({
          ...current,
          hasNoDefaultOrg: true,
          isFieldsLoading: false,
          isObjectsLoading: false
        })),
      [MessageType.CONNECTION_CHANGED]: () =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          const nextState: SoqlBuilderState = {
            ...current,
            hasNoDefaultOrg: false,
            isFieldsLoading: current.query.sObject.length > 0,
            isObjectsLoading: true,
            metadata: {
              childRelationships: [],
              fields: [],
              objects: []
            }
          };
          yield* SubscriptionRef.set(state, nextState);
          yield* requestObjects('subscribe');
          if (current.query.sObject.length > 0) {
            yield* requestMetadata(current.query.sObject, 'subscribe');
          }
        }),
      [MessageType.RUN_SOQL_QUERY_DONE]: () =>
        SubscriptionRef.update(state, current => ({ ...current, isQueryRunning: false })),
      [MessageType.GET_QUERY_PLAN_DONE]: () =>
        SubscriptionRef.update(state, current => ({ ...current, isQueryPlanRunning: false }))
    })
  );

  yield* Stream.fromQueue(messages).pipe(
    Stream.runForEach(event => reportMessageError(handleMessage(event))),
    Effect.forkScoped
  );

  yield* SubscriptionRef.update(state, current => ({ ...current, isObjectsLoading: true }));
  yield* requestObjects('initialize');
  if (savedState.query.sObject.length > 0) {
    yield* SubscriptionRef.update(state, current => ({ ...current, isFieldsLoading: true }));
    yield* requestMetadata(savedState.query.sObject, 'initialize');
  }

  const dispatch: SoqlBuilderServiceShape['dispatch'] = Match.type<SoqlBuilderAction>().pipe(
    Match.tagsExhaustive({
      ObjectSelected: action =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          const query = {
            ...createInitialSoqlBuilderQuery(),
            ...(current.query.headerComments === undefined
              ? {}
              : { headerComments: current.query.headerComments }),
            sObject: action.objectName
          };
          yield* publishQuery(
            {
              ...current,
              isFieldsLoading: true,
              metadata: {
                childRelationships: [],
                fields: [],
                objects: current.metadata.objects
              }
            },
            query
          );
          yield* requestMetadata(action.objectName, 'dispatch');
        }),
      FieldsSelected: action =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          yield* publishQuery(current, { ...current.query, fields: [...action.fieldNames] });
        }),
      AllFieldsSelected: () =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          yield* publishQuery(current, {
            ...current.query,
            fields: current.metadata.fields.map(field => field.name)
          });
        }),
      AllFieldsCleared: () =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          yield* publishQuery(current, { ...current.query, fields: [] });
        }),
      WhereConditionUpserted: action =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          const existingIndex = current.query.where.conditions.findIndex(
            condition => condition.index === action.condition.index
          );
          const conditions =
            existingIndex < 0
              ? [...current.query.where.conditions, action.condition]
              : current.query.where.conditions.map((condition, index) =>
                  index === existingIndex ? action.condition : condition
                );
          yield* publishQuery(current, {
            ...current.query,
            where: {
              conditions,
              ...(action.andOr === undefined ? {} : { andOr: action.andOr })
            }
          });
        }),
      WhereConditionRemoved: action =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          yield* publishQuery(current, {
            ...current.query,
            where: {
              ...current.query.where,
              conditions: current.query.where.conditions.filter(condition => condition.index !== action.index)
            }
          });
        }),
      WhereConjunctionChanged: action =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          yield* publishQuery(current, {
            ...current.query,
            where: { ...current.query.where, andOr: action.andOr }
          });
        }),
      OrderByUpserted: action =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          const existingIndex = current.query.orderBy.findIndex(item => item.field === action.orderBy.field);
          const orderBy =
            existingIndex < 0
              ? [...current.query.orderBy, action.orderBy]
              : current.query.orderBy.map((item, index) =>
                  index === existingIndex ? action.orderBy : item
                );
          yield* publishQuery(current, { ...current.query, orderBy });
        }),
      OrderByRemoved: action =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          yield* publishQuery(current, {
            ...current.query,
            orderBy: current.query.orderBy.filter(orderBy => orderBy.field !== action.fieldName)
          });
        }),
      LimitChanged: action =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          yield* publishQuery(current, { ...current.query, limit: action.limit });
        }),
      AllRowsChanged: action =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          yield* publishQuery(current, { ...current.query, allRows: action.allRows });
        }),
      NotificationsDismissed: () =>
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(state);
          const nextState = { ...current, notificationsDismissed: true };
          yield* SubscriptionRef.set(state, nextState);
          yield* saveViewState(messageService, nextState);
        }),
      SetDefaultOrgRequested: () =>
        tryServiceOperation('dispatch', () =>
          messageService.sendMessage({ type: MessageType.SET_DEFAULT_ORG })
        ),
      RunQueryRequested: () =>
        Effect.gen(function* () {
          yield* SubscriptionRef.update(state, current => ({ ...current, isQueryRunning: true }));
          yield* tryServiceOperation('dispatch', () =>
            messageService.sendMessage({ type: MessageType.RUN_SOQL_QUERY })
          );
        }),
      QueryPlanRequested: () =>
        Effect.gen(function* () {
          yield* SubscriptionRef.update(state, current => ({ ...current, isQueryPlanRunning: true }));
          yield* tryServiceOperation('dispatch', () =>
            messageService.sendMessage({ type: MessageType.GET_QUERY_PLAN })
          );
        })
    })
  );

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
