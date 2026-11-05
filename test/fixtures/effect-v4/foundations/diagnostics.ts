/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { FsService, QueryService } from '@salesforce/vscode-services/v2';
import { decodeJSON, decodePage } from '../decoderConsumer/consumer.js';
import * as Schema from 'effect/Schema';
import type * as Stream from 'effect/Stream';
import type { PromptService } from '@salesforce/vscode-services/v2';
import { progressValue } from '../decoderConsumer/consumer.js';

Effect.succeed('V4 floating-effect control');
export const nestedRunner = Effect.gen(function* () {
  const value = Effect.runSync(Effect.succeed('V4 nested-runner control'));
  return yield* Effect.succeed(value);
});

export const decoderTypeNegatives = (fs: FsService['Service'], query: QueryService['Service']) => {
  // @ts-expect-error Caller-owned decoder services must not disappear.
  const missingJSONContext: Effect.Effect<unknown, unknown> = fs.readJSON('/caller.json', decodeJSON);
  // @ts-expect-error Schemas cannot cross the provider boundary; callers create their decoder.
  const invalidJSON = fs.readJSON('/caller.json', Schema.Unknown);
  // @ts-expect-error Whole-page decoder callbacks replace record Schema arguments.
  const invalidQuery = query.query({ soql: 'SELECT Id FROM User' }, Schema.Unknown);
  const acquisition = query.query({ soql: 'SELECT Id FROM User' }, decodePage);
  // @ts-expect-error Acquisition executes the first caller decoder with its services.
  const missingQueryContext: Effect.Effect<unknown, unknown> = acquisition;
  const records = acquisition.pipe(Effect.map(result => {
    // @ts-expect-error Later-page decoding retains the caller's services too.
    const missingStreamContext: Stream.Stream<unknown, unknown> = result.records;
    return missingStreamContext;
  }));
  return { missingJSONContext, invalidJSON, invalidQuery, missingQueryContext, records };
};

export const promptRequirementNegative = (prompt: PromptService['Service']) => {
  // @ts-expect-error Progress wrappers retain the caller's service and Scope requirements.
  const missing: Effect.Effect<unknown, unknown> = prompt.withCancellableProgress('Caller progress')(progressValue);
  return missing;
};
