/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getExtensionExports } from '@salesforce/effect-ext-utils';
import type { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getRuntime } from '../services/runtime';
import { makeLineBreakpointMetadataCache } from './lineBreakpointMetadataCache';

const APEX_LANGUAGE_SERVER_EXTENSION_ID = 'salesforce.apex-language-server-extension';
const DOCUMENT_STATE_UNAVAILABLE = 'No document state is available';
const DOCUMENT_STATE_READY_SCHEDULE = Schedule.fixed(Duration.millis(100)).pipe(
  Schedule.intersect(Schedule.recurs(30))
);

type ApexExtensionApi = {
  readonly client: {
    getLineBreakpointInfo(uri: string): Promise<LineBreakpointInfo[]>;
  };
};

class ApexLanguageServerBreakpointInfoError extends Schema.TaggedError<ApexLanguageServerBreakpointInfoError>()(
  'ApexLanguageServerBreakpointInfoError',
  { message: Schema.String }
) {}

const ApexExtensionApiSchema = Schema.Struct({
  // ApexClientCore exposes methods on its prototype, so Schema.Struct would reject the live class instance.
  client: Schema.declare<ApexExtensionApi['client']>(
    (value): value is ApexExtensionApi['client'] =>
      typeof value === 'object' &&
      value !== null &&
      'getLineBreakpointInfo' in value &&
      typeof value.getLineBreakpointInfo === 'function',
    { identifier: 'ApexClient' }
  )
});

const ensureDocumentOpen = Effect.fn('ApexReplayDebugger.ensureBreakpointDocumentOpen')(function* (uri: string) {
  yield* Effect.logDebug('Opening Apex breakpoint document before requesting breakpoint information', { uri });
  yield* Effect.promise(() => vscode.workspace.openTextDocument(URI.parse(uri)));
});

const errorMessage = (error: unknown): string =>
  isError(error)
    ? error.message
    : typeof error === 'object' && error !== null && 'error' in error
      ? String(error.error)
      : String(error);

const getLineBreakpointInfo = Effect.fn('ApexReplayDebugger.getLineBreakpointInfo')(function* (uri: string) {
  yield* ensureDocumentOpen(uri);
  yield* Effect.logDebug('Requesting Apex language server breakpoint information', { uri });
  const lineBreakpointInfo = yield* getExtensionExports({
    extId: APEX_LANGUAGE_SERVER_EXTENSION_ID,
    schema: ApexExtensionApiSchema
  }).pipe(
    Effect.flatMap(api =>
      Effect.tryPromise({
        try: () => api.client.getLineBreakpointInfo(uri),
        catch: error => new ApexLanguageServerBreakpointInfoError({ message: errorMessage(error) })
      }).pipe(
        // Opening a document asynchronously notifies the language server. Retry only until that state is visible.
        Effect.retry({
          schedule: DOCUMENT_STATE_READY_SCHEDULE,
          while: error => error.message.includes(DOCUMENT_STATE_UNAVAILABLE)
        })
      )
    ),
    Effect.tapError(error =>
      Effect.logWarning('Unable to retrieve Apex language server breakpoint information', { uri, error })
    )
  );
  yield* Effect.logDebug('Received Apex language server breakpoint information', {
    uri,
    breakpointInfoCount: lineBreakpointInfo.length,
    breakpointInformation: lineBreakpointInfo.map(({ typeref, lines }) => ({ typeref, lines }))
  });
  return lineBreakpointInfo;
});

const getLineBreakpointInfoPromise = (uri: string): Promise<LineBreakpointInfo[]> =>
  getRuntime().runPromise(getLineBreakpointInfo(uri));

const cache = Effect.cached(makeLineBreakpointMetadataCache(getLineBreakpointInfoPromise)).pipe(Effect.flatten);

export const ensureLineBreakpointMetadata = (uris: readonly string[]) =>
  getRuntime().runPromise(cache.pipe(Effect.flatMap(metadataCache => metadataCache.ensure(uris))));

export const refreshLineBreakpointMetadata = (uri: string) =>
  getRuntime().runPromise(cache.pipe(Effect.flatMap(metadataCache => metadataCache.refresh(uri))));
