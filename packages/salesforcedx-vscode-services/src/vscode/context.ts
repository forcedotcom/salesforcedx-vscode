/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { ChannelService } from './channelService';

const updateContext = (orgInfo: { orgId?: string; username?: string; tracksSource?: boolean }) =>
  Effect.all(
    [
      Effect.promise(() =>
        vscode.commands.executeCommand('setContext', 'sf:has_target_org', Boolean(orgInfo.orgId ?? orgInfo.username))
      ),
      Effect.promise(() =>
        vscode.commands.executeCommand('setContext', 'sf:target_org_has_change_tracking', Boolean(orgInfo.tracksSource))
      )
    ],
    { concurrency: 'unbounded' }
  ).pipe(Effect.catchAll(() => Effect.void));

/** Update VS Code context variables when the default org changes */
export const watchDefaultOrgContext = () =>
  Effect.gen(function* () {
    const ref = yield* getDefaultOrgRef();
    const channelService = yield* ChannelService;
    return yield* Stream.concat(
      Stream.fromEffect(SubscriptionRef.get(ref)), // current value
      ref.changes // future changes
    ).pipe(
      Stream.tap(orgInfo => channelService.appendToChannel(`watchDefaultOrgContext: ${JSON.stringify(orgInfo)}`)),
      Stream.runForEach(updateContext)
    );
  });
