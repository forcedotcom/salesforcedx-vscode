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
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { createAnonymousApexScriptCommand } from './commands/createAnonymousApexScript';
import { executeAnonymousDocumentCommand, executeAnonymousSelectionCommand } from './commands/executeAnonymous';
import { logGetCommand } from './commands/logGet';
import { openLogsFolderCommand } from './commands/openLogsFolder';
import { createLogAutoCollect, createLogCollectorStateRef } from './logs/logAutoCollect';
import { AllServicesLayer, buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { createTraceFlagStatusBar } from './statusBar/traceFlagStatusBar';
import {
  createLogLevelCommand,
  createTraceFlagForCurrentUserCommand,
  createTraceFlagForUserCommand,
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
  const traceFlagRefreshPubSub = yield* PubSub.sliding<void>(1);

  const logCollectorStateRef = yield* createLogCollectorStateRef();

  yield* Effect.all(
    [
      registerCommand('sf.apex.log.get', logGetCommand),
      registerCommand('sf.apex.log.openFolder', openLogsFolderCommand),
      registerCommand('sf.apex.traceFlags.open', () =>
        openTraceFlagsCommand().pipe(Effect.tap(PubSub.publish(traceFlagRefreshPubSub, undefined)))
      ),
      registerCommand('sf.apex.traceFlags.createForCurrentUser', () =>
        createTraceFlagForCurrentUserCommand().pipe(Effect.tap(PubSub.publish(traceFlagRefreshPubSub, undefined)))
      ),
      registerCommand('sf.apex.traceFlags.deleteForCurrentUser', () =>
        deleteTraceFlagForCurrentUserCommand().pipe(Effect.tap(PubSub.publish(traceFlagRefreshPubSub, undefined)))
      ),
      registerCommand('sf.apex.traceFlags.createForUser', () =>
        createTraceFlagForUserCommand().pipe(Effect.tap(PubSub.publish(traceFlagRefreshPubSub, undefined)))
      ),
      registerCommand('sf.apex.traceFlags.createLogLevel', () =>
        createLogLevelCommand().pipe(Effect.tap(PubSub.publish(traceFlagRefreshPubSub, undefined)))
      ),
      registerCommand('sf.apex.traceFlags.deleteForId', (traceFlagId: string) =>
        deleteTraceFlagForIdCommand(traceFlagId).pipe(Effect.tap(PubSub.publish(traceFlagRefreshPubSub, undefined)))
      ),
      registerCommand('sf.create.anonymous.apex.script', createAnonymousApexScriptCommand),
      registerCommand('sf.anon.apex.execute.document', executeAnonymousDocumentCommand),
      registerCommand('sf.anon.apex.execute.selection', executeAnonymousSelectionCommand)
    ],
    { concurrency: 'unbounded' }
  );

  const { provider } = yield* TraceFlagsContentProviderService;
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(TRACE_FLAGS_SCHEME, provider)
  );
  registerTraceFlagsCodeLensProvider(context);

  const scope = yield* getExtensionScope();
  yield* Effect.forkIn(
    createTraceFlagStatusBar(traceFlagRefreshPubSub, logCollectorStateRef),
    scope
  ).pipe(Effect.asVoid);
  yield* Effect.forkIn(
    createLogAutoCollect(traceFlagRefreshPubSub, logCollectorStateRef),
    scope
  ).pipe(Effect.asVoid);

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
