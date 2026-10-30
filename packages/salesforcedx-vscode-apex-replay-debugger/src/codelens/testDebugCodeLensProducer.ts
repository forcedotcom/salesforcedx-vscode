/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { getRuntime } from '../services/runtime';

const commandMappings = new Map([
  ['sf.apex.debug.class.run.delegate', 'sf.test.view.debugTests'],
  ['sf.apex.debug.method.run.delegate', 'sf.test.view.debugSingleTest']
]);

const testDebugDescriptors = [...commandMappings.keys()];

const APEX_LANGUAGE_SERVER_EXTENSION_ID = 'salesforce.apex-language-server-extension';

type ApexLanguageServerApi = {
  readonly codeLens: {
    register: (
      descriptor: string,
      callback: (lens: vscode.CodeLens) => vscode.CodeLens | null | Promise<vscode.CodeLens | null>
    ) => vscode.Disposable;
  };
};

class CodeLensRegistrationError extends Data.TaggedError('CodeLensRegistrationError')<{
  readonly cause: Error;
}> {}

const isApexLanguageServerApi = (value: unknown): value is ApexLanguageServerApi => {
  if (typeof value !== 'object' || value === null) return false;
  const codeLens = 'codeLens' in value ? value.codeLens : undefined;
  return typeof codeLens === 'object' && codeLens !== null && typeof Reflect.get(codeLens, 'register') === 'function';
};

const getApexLanguageServer = async (): Promise<ApexLanguageServerApi | undefined> => {
  const extension = vscode.extensions.getExtension<ApexLanguageServerApi>(APEX_LANGUAGE_SERVER_EXTENSION_ID);
  if (!extension) return undefined;

  if (!extension.isActive) await extension.activate();
  return isApexLanguageServerApi(extension.exports) ? extension.exports : undefined;
};

const getTestName = (lens: vscode.CodeLens): string | undefined => {
  const commandArguments = lens.command?.arguments;
  return commandArguments?.length === 1 && typeof commandArguments[0] === 'string' && commandArguments[0].length > 0
    ? commandArguments[0]
    : undefined;
};

export const produceTestDebugCodeLens = (lens: vscode.CodeLens): vscode.CodeLens | null => {
  const command = lens.command;
  const testName = getTestName(lens);
  const targetCommand = command ? commandMappings.get(command.command) : undefined;
  if (!command || !targetCommand || !testName) return null;

  return new vscode.CodeLens(lens.range, {
    ...command,
    command: targetCommand,
    title: `$(debug) ${command.title}`,
    arguments: [{ name: testName }]
  });
};

const hasDefaultOrg = Effect.fn('ApexReplayDebugger.hasDefaultOrg')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const targetOrg = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  return Boolean(targetOrg.orgId ?? targetOrg.username);
});

export const registerTestDebugCodeLensProducer = Effect.fn('ApexReplayDebugger.registerTestDebugCodeLensProducer')(
  function* (
    context: vscode.ExtensionContext,
    isDefaultOrgAvailable = () => getRuntime().runPromise(hasDefaultOrg()),
    getLanguageServer = getApexLanguageServer
  ) {
    const languageServer = yield* Effect.tryPromise({
      try: getLanguageServer,
      catch: cause => new CodeLensRegistrationError({ cause: isError(cause) ? cause : new Error(String(cause)) })
    }).pipe(
      Effect.map(value => (isApexLanguageServerApi(value) ? value : undefined)),
      Effect.catchAll(() => Effect.void)
    );
    if (!languageServer) return;

    const registrations = yield* Effect.try({
      try: () =>
        testDebugDescriptors.map(descriptor =>
          languageServer.codeLens.register(descriptor, async (lens: vscode.CodeLens) =>
            (await isDefaultOrgAvailable()) ? produceTestDebugCodeLens(lens) : null
          )
        ),
      catch: cause => new CodeLensRegistrationError({ cause: isError(cause) ? cause : new Error(String(cause)) })
    }).pipe(Effect.option);
    if (registrations._tag === 'None') {
      yield* Effect.sync(
        () => void vscode.window.showErrorMessage(nls.localize('apex_debug_codelens_registration_failed'))
      );
      return;
    }
    context.subscriptions.push(...registrations.value);
  }
);
