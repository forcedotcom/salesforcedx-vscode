/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import {  getDefaultOrgRef } from '../core/defaultOrgRef';

/** Update VS Code context variables when the default org changes */
export const watchDefaultOrgContext = () =>
  Effect.gen(function* () {
    const ref = yield* getDefaultOrgRef();
    return ref.changes.pipe(
  Stream.runForEach( orgInfo =>
    Effect.all(
      [
        Effect.promise(() =>
          vscode.commands.executeCommand('setContext', 'sf:has_target_org', Boolean(orgInfo.orgId ?? orgInfo.username))
        ),
        Effect.promise(() =>
          vscode.commands.executeCommand(
            'setContext',
            'sf:target_org_has_change_tracking',
            Boolean(orgInfo.tracksSource)
          )
        )
      ],
      { concurrency: 'unbounded' }
    ).pipe(Effect.catchAll(() => Effect.void))));
  });
