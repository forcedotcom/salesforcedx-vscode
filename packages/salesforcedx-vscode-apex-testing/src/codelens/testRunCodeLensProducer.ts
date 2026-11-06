/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CallableSchema, ExtensionProviderService, getApexLanguageServerExports } from '@salesforce/effect-ext-utils';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { getApexTestingRuntime } from '../services/extensionProvider';

const commandMappings = new Map([
  ['sf.apex.test.class.run.delegate', 'sf.apex.test.class.run'],
  ['sf.apex.test.method.run.delegate', 'sf.apex.test.method.run']
]);

const testRunDescriptors = [...commandMappings.keys()];

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

const CodeLensApiSchema = Schema.Struct({
  register: CallableSchema<ApexLanguageServerApi['codeLens']['register']>()
});

const ApexLanguageServerApiSchema = Schema.Struct({
  // Preserve the extension-owned CodeLens API because register may rely on its receiver.
  codeLens: Schema.declare<ApexLanguageServerApi['codeLens']>(value => Schema.is(CodeLensApiSchema)(value), {
    identifier: 'ApexLanguageServerCodeLensApi'
  })
});

const getApexLanguageServerClient = () => getApexLanguageServerExports(ApexLanguageServerApiSchema);

type GetLanguageServerClient = () => ReturnType<typeof getApexLanguageServerClient>;

const getTestName = (lens: vscode.CodeLens): string | undefined => {
  const commandArguments = lens.command?.arguments;
  return commandArguments?.length === 1 && typeof commandArguments[0] === 'string' && commandArguments[0].length > 0
    ? commandArguments[0]
    : undefined;
};

export const produceTestRunCodeLens = (lens: vscode.CodeLens): vscode.CodeLens | null => {
  const command = lens.command;
  const testName = getTestName(lens);
  const targetCommand = command ? commandMappings.get(command.command) : undefined;
  if (!command || !targetCommand || !testName) return null;

  return new vscode.CodeLens(lens.range, {
    ...command,
    command: targetCommand,
    title: `$(run) ${command.title}`,
    arguments: [testName]
  });
};

const hasDefaultOrg = Effect.fn('ApexTesting.hasDefaultOrg')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const targetOrg = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  return Boolean(targetOrg.orgId);
});

export const registerTestRunCodeLensProducer = Effect.fn('ApexTesting.registerTestRunCodeLensProducer')(function* (
  context: vscode.ExtensionContext,
  isDefaultOrgAvailable = () => getApexTestingRuntime().runPromise(hasDefaultOrg()),
  getLanguageServerClient: GetLanguageServerClient = getApexLanguageServerClient
) {
  const languageServerClient = yield* getLanguageServerClient().pipe(Effect.option);
  if (languageServerClient._tag === 'None') return;

  const registrations = yield* Effect.try({
    try: () =>
      testRunDescriptors.map(descriptor =>
        languageServerClient.value.codeLens.register(descriptor, async (lens: vscode.CodeLens) =>
          (await isDefaultOrgAvailable()) ? produceTestRunCodeLens(lens) : null
        )
      ),
    catch: cause => new CodeLensRegistrationError({ cause: isError(cause) ? cause : new Error(String(cause)) })
  }).pipe(Effect.option);
  if (registrations._tag === 'None') {
    yield* Effect.sync(
      () => void vscode.window.showErrorMessage(nls.localize('apex_test_codelens_registration_failed'))
    );
    return;
  }
  context.subscriptions.push(...registrations.value);
});
