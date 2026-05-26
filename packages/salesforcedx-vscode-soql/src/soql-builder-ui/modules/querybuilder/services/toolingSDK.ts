/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { Effect, Match, SubscriptionRef } from 'effect';
import { MessageService } from './message/iMessageService';
import { MessageType, SObjectMetadata, SoqlEditorEvent } from './message/soqlEditorEvent';

export class ToolingSDK extends Effect.Service<ToolingSDK>()('ToolingSDK', {
  accessors: true,
  effect: Effect.gen(function* () {
    const messageService = yield* MessageService;

    const sobjects = yield* SubscriptionRef.make<string[]>([]);
    const sobjectMetadata = yield* SubscriptionRef.make<SObjectMetadata>({ fields: [] });
    const queryRunState = yield* SubscriptionRef.make<boolean>(false);
    const noDefaultOrg = yield* SubscriptionRef.make<boolean>(false);
    const queryPlanRunState = yield* SubscriptionRef.make<boolean>(false);

    let latestSObjectName: string | undefined;

    const loadSObjectDefinitions = (): void => {
      messageService.sendMessage({ type: MessageType.SOBJECTS_REQUEST });
    };

    const loadSObjectMetadata = (sobjectName: string): void => {
      latestSObjectName = sobjectName;
      messageService.sendMessage({ type: MessageType.SOBJECT_METADATA_REQUEST, payload: sobjectName });
    };

    // onMessage fires synchronously — Effect.runSync is acceptable at this sync/async boundary
    const handleMessage = Match.type<SoqlEditorEvent>().pipe(
      Match.when({ type: MessageType.SOBJECTS_RESPONSE }, e => {
        Effect.runSync(SubscriptionRef.set(sobjects, e.payload));
      }),
      Match.when({ type: MessageType.SOBJECT_METADATA_RESPONSE }, e => {
        Effect.runSync(SubscriptionRef.set(sobjectMetadata, e.payload));
      }),
      Match.when({ type: MessageType.CONNECTION_CHANGED }, () => {
        Effect.runSync(SubscriptionRef.set(noDefaultOrg, false));
        loadSObjectDefinitions();
        if (latestSObjectName) loadSObjectMetadata(latestSObjectName);
      }),
      Match.when({ type: MessageType.NO_DEFAULT_ORG }, () => {
        Effect.runSync(SubscriptionRef.set(noDefaultOrg, true));
      }),
      Match.when({ type: MessageType.RUN_SOQL_QUERY_DONE }, () => {
        Effect.runSync(SubscriptionRef.set(queryRunState, false));
      }),
      Match.when({ type: MessageType.GET_QUERY_PLAN_DONE }, () => {
        Effect.runSync(SubscriptionRef.set(queryPlanRunState, false));
      }),
      Match.orElse(() => undefined)
    );

    messageService.onMessage(handleMessage);

    return { sobjects, sobjectMetadata, queryRunState, noDefaultOrg, queryPlanRunState, loadSObjectDefinitions, loadSObjectMetadata };
  })
}) {}
