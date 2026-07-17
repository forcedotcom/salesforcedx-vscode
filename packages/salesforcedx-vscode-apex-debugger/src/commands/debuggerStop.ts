/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Array from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { nls } from '../messages';

/**
 * Raised when the `ApexDebuggerSession` tooling query fails. Previously the executor swallowed this in a
 * bare `catch {}`; now it flows to ErrorHandlerService for user-facing rendering.
 */
export class DebuggerSessionQueryError extends Schema.TaggedError<DebuggerSessionQueryError>()(
  'DebuggerSessionQueryError',
  {
    message: Schema.String
  }
) {}

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
export const debuggerStop = Effect.fn('debuggerStop')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project (parity
  // with the migrated org commands and the old sfProjectPreconditionChecker gate).
  yield* api.services.ProjectService.getSfProject();

  const conn = yield* api.services.ConnectionService.getConnection();

  // LIMIT 1 → Array.head is None (nothing to stop) or Some(the session to detach).
  yield* Effect.tryPromise({
    try: () => conn.tooling.query<{ Id: string }>("SELECT Id FROM ApexDebuggerSession WHERE Status = 'Active' LIMIT 1"),
    catch: e => new DebuggerSessionQueryError({ message: isError(e) ? e.message : String(e) })
  }).pipe(
    Effect.flatMap(({ records }) =>
      Option.match(Array.head(records), {
        onNone: () => Effect.succeed(nls.localize('debugger_stop_none_found_text')),
        onSome: ({ Id }) =>
          Effect.tryPromise({
            try: () => conn.tooling.sobject('ApexDebuggerSession').update({ Id, Status: 'Detach' }),
            catch: e => new DebuggerSessionUpdateError({ message: isError(e) ? e.message : String(e) })
          }).pipe(Effect.as(nls.localize('debugger_stop_success_text')))
      })
    ),
    Effect.tap(message => Effect.sync(() => void vscode.window.showInformationMessage(message))),
    promptService.withProgress(nls.localize('debugger_stop_text'))
  );
});
