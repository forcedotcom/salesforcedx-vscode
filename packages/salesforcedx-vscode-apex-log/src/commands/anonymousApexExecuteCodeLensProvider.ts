/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  CancellationToken,
  CodeLens,
  EventEmitter,
  ExtensionContext,
  languages,
  Range,
  TextDocument,
  Disposable
} from 'vscode';
import { nls } from '../messages';
import { getRuntime } from '../services/runtime';

const ANON_APEX_DOCUMENT_SELECTOR = { language: 'apex-anon' };

export const provideAnonymousApexExecuteLenses = (document: TextDocument, targetOrgSet: boolean): CodeLens[] =>
  document.getText().trim().length === 0 || !targetOrgSet
    ? []
    : [
        new CodeLens(new Range(0, 0, 0, 0), {
          command: 'sf.anon.apex.execute.document',
          title: nls.localize('exec_anon_codelens'),
          tooltip: nls.localize('exec_anon_codelens')
        })
      ];

const hasTargetOrg = Effect.fn('ApexLog.CodeLensProvider.hasTargetOrg')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const info = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  return Boolean(info.orgId ?? info.username);
});

export const registerAnonymousApexExecuteCodeLensProvider = Effect.fn(
  'ApexLog.CodeLensProvider.registerAnonymousApexExecuteCodeLensProvider'
)(function* (context: ExtensionContext) {
  const changeEmitter = new EventEmitter<void>();
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const ref = yield* api.services.TargetOrgRef();
  const abortController = new AbortController();
  void getRuntime().runPromise(ref.changes.pipe(Stream.runForEach(() => Effect.sync(() => changeEmitter.fire()))), {
    signal: abortController.signal
  });

  const provider = {
    onDidChangeCodeLenses: changeEmitter.event,
    provideCodeLenses: (document: TextDocument, _token: CancellationToken) =>
      hasTargetOrg().pipe(
        Effect.map(targetOrgSet => provideAnonymousApexExecuteLenses(document, targetOrgSet)),
        Effect.tapError(e => Effect.logError(String(e))),
        Effect.catchAll(() => Effect.succeed<CodeLens[]>([])),
        getRuntime().runPromise
      )
  };
  context.subscriptions.push(
    languages.registerCodeLensProvider(ANON_APEX_DOCUMENT_SELECTOR, provider),
    new Disposable(() => abortController.abort()),
    changeEmitter
  );
});
