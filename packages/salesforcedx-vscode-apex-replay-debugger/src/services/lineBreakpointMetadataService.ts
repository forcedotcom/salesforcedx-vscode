/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getApexLanguageServerExports, getMessageFromError } from '@salesforce/effect-ext-utils';
import type { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Runtime from 'effect/Runtime';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { makeLineBreakpointMetadataCache } from '../breakpoints/lineBreakpointMetadataCache';

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

export class LineBreakpointMetadataService extends Effect.Service<LineBreakpointMetadataService>()(
  'LineBreakpointMetadataService',
  {
    accessors: true,
    scoped: Effect.gen(function* () {
      const scope = yield* Effect.scope;
      const getLineBreakpointInfo = Effect.fn('ApexReplayDebugger.getLineBreakpointInfo')(function* (uri: string) {
        yield* Effect.annotateCurrentSpan('uri', uri);
        yield* Effect.promise(() => vscode.workspace.openTextDocument(URI.parse(uri)));
        const lineBreakpointInfo = yield* getApexLanguageServerExports(ApexExtensionApiSchema).pipe(
          Effect.flatMap(apexApi =>
            Effect.tryPromise({
              try: () => apexApi.client.getLineBreakpointInfo(uri),
              catch: error => new ApexLanguageServerBreakpointInfoError({ message: getMessageFromError(error) })
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
        yield* Effect.annotateCurrentSpan('breakpointInfoCount', lineBreakpointInfo.length);
        return lineBreakpointInfo;
      });
      const runtime = yield* Effect.runtime<Effect.Effect.Context<ReturnType<typeof getLineBreakpointInfo>>>();
      return yield* makeLineBreakpointMetadataCache(
        uri => Runtime.runPromise(runtime)(getLineBreakpointInfo(uri)),
        scope
      );
    })
  }
) {}
