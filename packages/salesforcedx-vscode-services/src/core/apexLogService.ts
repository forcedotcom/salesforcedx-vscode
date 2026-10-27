/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  getLogBody,
  listLogs,
  streamLogs,
  type ListLogsOptions,
  type StreamLogsOptions
} from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import { ConnectionService } from './connectionService';
import { refineSoqlError } from './queryExecute';

export { ApexLogListItem, type ListLogsOptions } from '@salesforce/apex-node/effect';

export class ApexLogService extends Effect.Service<ApexLogService>()('ApexLogService', {
  accessors: true,
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const connectionFailure = (error: Effect.Effect.Error<ReturnType<typeof connectionService.getConnection>>) =>
      Stream.succeed({ _tag: 'QueryError' as const, error });

    return {
      listLogs: Effect.fn('ApexLogService.listLogs')((limit: number = 25, options?: ListLogsOptions) =>
        connectionService.getConnection().pipe(
          Effect.flatMap(connection => listLogs(connection, limit, options)),
          Effect.catchTag('ApexLogQueryError', error => Effect.fail(refineSoqlError(error.soql, error.cause)))
        )
      ),
      getLogBody: Effect.fn('ApexLogService.getLogBody')((logId: string) =>
        connectionService.getConnection().pipe(Effect.flatMap(connection => getLogBody(connection, logId)))
      ),
      streamLogs: (options: StreamLogsOptions) =>
        Stream.repeatEffectWithSchedule(Effect.void, options.schedule).pipe(
          Stream.zipWithIndex,
          Stream.mapEffect(([, index]) => options.pollOptions?.(index) ?? Effect.succeed(Option.some({}))),
          Stream.filterMap(filters => filters),
          Stream.flatMap(filters =>
            Stream.unwrap(
              connectionService.getConnection().pipe(
                Effect.map(connection =>
                  streamLogs(connection, {
                    ...options,
                    schedule: Schedule.recurs(0),
                    pollOptions: () => Effect.succeed(Option.some(filters))
                  }).pipe(
                    Stream.map(event =>
                      Match.value(event).pipe(
                        Match.tag('Log', 'BodyError', value => value),
                        Match.tag('QueryError', ({ error }) => ({
                          _tag: 'QueryError' as const,
                          error: Match.value(error).pipe(
                            Match.tag('ApexLogQueryError', value => refineSoqlError(value.soql, value.cause)),
                            Match.tag('ParseError', value => value),
                            Match.exhaustive
                          )
                        })),
                        Match.exhaustive
                      )
                    )
                  )
                )
              )
            ).pipe(
              // Connection setup belongs to each poll, including recovery after a failed lookup.
              Stream.catchTags({
                SettingsError: connectionFailure,
                NoWorkspaceOpenError: connectionFailure,
                FailedToCreateConfigAggregatorError: connectionFailure,
                FailedToCreateAuthInfoError: connectionFailure,
                FailedToCreateConnectionError: connectionFailure,
                NoTargetOrgConfiguredError: connectionFailure,
                AccessTokenExpiredError: connectionFailure
              })
            )
          )
        )
    };
  })
}) {}
