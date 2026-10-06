/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { SF_CONFIG_ISV_DEBUGGER_SID, SF_CONFIG_ISV_DEBUGGER_URL } from '@salesforce/salesforcedx-apex-debugger';
import * as Array from 'effect/Array';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { nls } from '../messages';
import { type ProgressAndSuccessCommandKey } from '../utils/notificationMode';

/**
 * Raised when the `ApexDebuggerSession` tooling query fails. Previously the executor swallowed this in a
 * bare `catch {}`; now it flows to ErrorHandlerService for user-facing rendering.
 */
class DebuggerSessionQueryError extends Schema.TaggedError<DebuggerSessionQueryError>()('DebuggerSessionQueryError', {
  message: Schema.String
}) {}

/**
 * Raised when the `ApexDebuggerSession` Status='Detach' tooling update fails.
 * @ExportTaggedError
 */
export class DebuggerSessionUpdateError extends Schema.TaggedError<DebuggerSessionUpdateError>()(
  'DebuggerSessionUpdateError',
  {
    message: Schema.String
  }
) {}

/**
 * Effect command for `sf.debugger.stop`: find the active Apex Debugger session and detach it.
 *
 * Queries the tooling API for the one active `ApexDebuggerSession`; if present, updates its Status to
 * `Detach` and shows a success toast, otherwise reports that no session was found. The query is
 * `FROM ApexDebuggerSession`, so any returned Id is an ApexDebuggerSession id by construction — no prefix
 * check needed. A single progress notification wraps the whole command; query/update failures surface as
 * tagged errors (rendered by ErrorHandlerService) rather than being swallowed.
 */
const COMMAND: ProgressAndSuccessCommandKey = 'SFDX: Stop Apex Debugger Session';

const SessionRow = Schema.Struct({ Id: Schema.String });
const SESSION_SOQL = "SELECT Id FROM ApexDebuggerSession WHERE Status = 'Active' LIMIT 1";

const queryError = (e: unknown) => new DebuggerSessionQueryError({ message: isError(e) ? e.message : String(e) });

export const debuggerStop = Effect.fn('debuggerStop')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationMode = yield* api.services.NotificationModeService;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project (parity
  // with the migrated org commands and the old sfProjectPreconditionChecker gate).
  yield* api.services.ProjectService.getSfProject();

  // ISV Debugger projects authenticate via org-isv-debugger-sid/url stored in project-local config,
  // not a target-org — getConnection() would fail with NoTargetOrgConfiguredError for these projects.
  const configAggregator = yield* api.services.ConfigService.getConfigAggregator();
  const isvSid = configAggregator.getPropertyValue<string>(SF_CONFIG_ISV_DEBUGGER_SID);
  const isvUrl = configAggregator.getPropertyValue<string>(SF_CONFIG_ISV_DEBUGGER_URL);

  const conn = yield* isvSid && isvUrl
    ? Effect.tryPromise({
        try: () =>
          AuthInfo.create({ accessTokenOptions: { accessToken: isvSid, loginUrl: isvUrl, instanceUrl: isvUrl } }).then(
            authInfo => Connection.create({ authInfo })
          ),
        catch: queryError
      })
    : api.services.ConnectionService.getConnection();

  // ISV uses a sid/url connection QueryService cannot resolve; default-org path uses QueryService.
  const sessionRecords =
    isvSid && isvUrl
      ? Effect.tryPromise({
          // eslint-disable-next-line no-restricted-syntax -- ISV sid/url connection QueryService cannot resolve
          try: () => Promise.resolve(conn.tooling.query(SESSION_SOQL)),
          catch: queryError
        }).pipe(
          Effect.flatMap(page =>
            Schema.decodeUnknown(Schema.Struct({ records: Schema.Array(SessionRow) }))(page).pipe(
              Effect.map(decoded => decoded.records),
              Effect.mapError(queryError)
            )
          )
        )
      : Effect.flatMap(api.services.QueryService, queryService =>
          queryService.query({ soql: SESSION_SOQL, tooling: true }, SessionRow).pipe(
            Effect.flatMap(({ records }) => Stream.runCollect(records)),
            Effect.map(Chunk.toReadonlyArray),
            Effect.mapError(queryError)
          )
        );

  yield* Effect.all({
    progressLocation: notificationMode.getProgressLocation(COMMAND),
    promptService: api.services.PromptService
  }).pipe(
    Effect.flatMap(({ progressLocation, promptService }) =>
      sessionRecords.pipe(
        // LIMIT 1 → Array.head is None (nothing to stop) or Some(the session to detach).
        Effect.flatMap(records =>
          Option.match(Array.head(records), {
            onNone: () => Effect.succeed(false as const),
            onSome: ({ Id }) =>
              Effect.as(
                Effect.tryPromise({
                  try: () => conn.tooling.sobject('ApexDebuggerSession').update({ Id, Status: 'Detach' }),
                  catch: e => new DebuggerSessionUpdateError({ message: isError(e) ? e.message : String(e) })
                }),
                true as const
              )
          })
        ),
        Effect.tap(stopped =>
          notificationMode.showSuccessNotification(
            COMMAND,
            nls.localize(stopped ? 'debugger_stop_success_text' : 'debugger_stop_none_found_text'),
            false
          )
        ),
        promptService.withProgress(nls.localize('debugger_stop_text'), progressLocation)
      )
    )
  );
});
