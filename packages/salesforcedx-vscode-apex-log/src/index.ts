/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeExtensionScope,
  ExtensionPackageJsonSchema,
  ExtensionProviderService,
  type ExtensionPackageJson,
  getExtensionScope
} from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { createAnonymousApexScriptCommand } from './commands/createAnonymousApexScript';
import { executeAnonymousDocumentCommand, executeAnonymousSelectionCommand } from './commands/executeAnonymous';
import { logGetCommand } from './commands/logGet';
import { openLogsFolderCommand } from './commands/openLogsFolder';
import { createLogAutoCollect } from './logs/logAutoCollect';
import { CurrentTraceFlags } from './services/apexLogState';
import { AllServicesLayer, buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { createTraceFlagStatusBar } from './statusBar/traceFlagStatusBar';
import { traceFlagCleanupScheduler } from './traceFlagCleanupScheduler';
import {
  createLogLevelCommand,
  createTraceFlagForCurrentUserCommand,
  createTraceFlagForUserCommand,
  deleteDebugLevelForIdCommand,
  deleteTraceFlagForCurrentUserCommand,
  deleteTraceFlagForIdCommand,
  openTraceFlagsCommand
} from './traceFlags/traceFlagJsonSync';
import { registerTraceFlagsCodeLensProvider } from './traceFlags/traceFlagsCodeLensProvider';
import { SCHEME as TRACE_FLAGS_SCHEME, TraceFlagsContentProviderService } from './traceFlags/traceFlagsContentProvider';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await Effect.runPromise(activation(context).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope)));
};

export const deactivate = async (): Promise<void> =>
  Effect.runPromise(deactivation().pipe(Effect.provide(AllServicesLayer)));

const activation = Effect.fn('activation')(function* (context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const emptyPjson: ExtensionPackageJson = {};
  const pjson = yield* Schema.decodeUnknown(ExtensionPackageJsonSchema)(context.extension.packageJSON).pipe(
    Effect.catchAll(() => Effect.succeed(emptyPjson))
  );
  const displayName = pjson.displayName ?? 'Salesforce Apex Log';
  yield* api.services.ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel(`${displayName} extension activating`))
  );

  const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);
  const scope = yield* getExtensionScope();

  const currentTraceFlagsRef = yield* CurrentTraceFlags;
  yield* Effect.all(
    [
      // init the traceFlagRef
      Effect.forkIn(
        andThenNotifyUIOfChanges(
          api.services.TraceFlagService.getTraceFlags().pipe(
            Effect.catchAll(() => Effect.succeed([])),
            Effect.flatMap(flags => SubscriptionRef.set(currentTraceFlagsRef, flags))
          )
        ),
        scope
      ).pipe(Effect.asVoid),
      registerCommand('sf.apex.log.get', logGetCommand),
      registerCommand('sf.apex.log.openFolder', openLogsFolderCommand),
      registerCommand('sf.apex.traceFlags.open', () => andThenNotifyUIOfChanges(openTraceFlagsCommand())),
      registerCommand('sf.apex.traceFlags.createForCurrentUser', () =>
        andThenNotifyUIOfChanges(createTraceFlagForCurrentUserCommand())
      ),
      registerCommand('sf.apex.traceFlags.deleteForCurrentUser', () =>
        andThenNotifyUIOfChanges(deleteTraceFlagForCurrentUserCommand())
      ),
      registerCommand('sf.apex.traceFlags.createForUser', () =>
        andThenNotifyUIOfChanges(createTraceFlagForUserCommand())
      ),
      registerCommand('sf.apex.traceFlags.createLogLevel', () => andThenNotifyUIOfChanges(createLogLevelCommand())),
      registerCommand('sf.apex.traceFlags.deleteForId', (traceFlagId: string) =>
        andThenNotifyUIOfChanges(deleteTraceFlagForIdCommand(traceFlagId))
      ),
      registerCommand('sf.apex.traceFlags.deleteDebugLevelForId', (debugLevelId: string) =>
        andThenNotifyUIOfChanges(deleteDebugLevelForIdCommand(debugLevelId))
      ),
      registerCommand('sf.create.anonymous.apex.script', createAnonymousApexScriptCommand),
      registerCommand('sf.anon.apex.execute.document', executeAnonymousDocumentCommand),
      registerCommand('sf.anon.apex.execute.selection', executeAnonymousSelectionCommand),

      Effect.forkIn(createTraceFlagStatusBar(), scope).pipe(Effect.asVoid),
      Effect.forkIn(createLogAutoCollect(), scope).pipe(Effect.asVoid),
      Effect.forkIn(traceFlagCleanupScheduler(), scope).pipe(Effect.asVoid),
      registerTraceFlagsCodeLensProvider(context)
    ],

    { concurrency: 'unbounded' }
  );

  const { provider } = yield* TraceFlagsContentProviderService;
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(TRACE_FLAGS_SCHEME, provider));

  yield* Effect.all([], { concurrency: 'unbounded' });

  yield* api.services.ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel(`${displayName} activation complete.`))
  );
});

const deactivation = Effect.fn('deactivation')(function* () {
  yield* closeExtensionScope();
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const displayName = yield* api.services.ExtensionContextService.pipe(
    Effect.flatMap(svc => svc.getDisplayName),
    Effect.catchAll(() => Effect.succeed('Salesforce Apex Log'))
  );
  yield* api.services.ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel(`${displayName} extension deactivated!`))
  );
});

/** wrap commands that need to notify the UI (statusBar, traceFlagsJson) of changes */
const andThenNotifyUIOfChanges = <A, E, R>(eff: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const ref = yield* CurrentTraceFlags;
    yield* eff.pipe(
      Effect.tap(() =>
        api.services.TraceFlagService.getTraceFlags().pipe(
          Effect.catchAll(() => Effect.succeed([])),
          Effect.flatMap(flags => SubscriptionRef.set(ref, flags))
        )
      )
    );
  });
