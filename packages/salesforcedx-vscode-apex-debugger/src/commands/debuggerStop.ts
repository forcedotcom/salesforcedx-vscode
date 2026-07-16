/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
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
 * Queries the tooling API for a single active `ApexDebuggerSession`; if exactly one is found whose Id is an
 * ApexDebuggerSession id (`07a` prefix), updates its Status to `Detach`. Otherwise reports that no session
 * was found. Query/update failures surface as tagged errors (rendered by ErrorHandlerService) rather than
 * being swallowed.
 */
export const debuggerStop = Effect.fn('debuggerStop')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project (parity
  // with the migrated org commands and the old sfProjectPreconditionChecker gate).
  yield* api.services.ProjectService.getSfProject();

  const conn = yield* api.services.ConnectionService.getConnection();
  const channel = yield* api.services.ChannelService;

  yield* channel.appendToChannel(nls.localize('debugger_query_session_text'));
  yield* channel.showChannel;

  const result = yield* Effect.tryPromise({
    try: () => conn.tooling.query<{ Id: string }>("SELECT Id FROM ApexDebuggerSession WHERE Status = 'Active' LIMIT 1"),
    catch: e => new DebuggerSessionQueryError({ message: isError(e) ? e.message : String(e) })
  });

  const sessionId = result.records.length === 1 ? result.records[0].Id : undefined;
  if (sessionId?.startsWith('07a')) {
    yield* channel.appendToChannel(nls.localize('debugger_stop_text'));
    yield* Effect.tryPromise({
      try: () => conn.tooling.sobject('ApexDebuggerSession').update({ Id: sessionId, Status: 'Detach' }),
      catch: e => new DebuggerSessionUpdateError({ message: isError(e) ? e.message : String(e) })
    });
    return;
  }

  yield* Effect.sync(() => void vscode.window.showInformationMessage(nls.localize('debugger_stop_none_found_text')));
});
