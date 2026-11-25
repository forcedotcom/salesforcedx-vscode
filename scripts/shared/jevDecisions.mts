/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import * as HttpClient from '@effect/platform/HttpClient';
import * as HttpClientRequest from '@effect/platform/HttpClientRequest';
import { Config, Effect, Schema } from 'effect';

export const JEV_MODELS = ['opencode/jev-1.13-free', 'opencode/jev-1.14'] as const;

class JevRequestFailed extends Schema.TaggedError<JevRequestFailed>()('JevRequestFailed', {
  message: Schema.String
}) {}

const Probability = Schema.Number.pipe(Schema.between(0, 1));
const ChoiceAnswer = Schema.Struct({
  type: Schema.Literal('choice'),
  choice: Schema.String,
  confidence: Probability,
  probabilities: Schema.Record({ key: Schema.String, value: Probability })
});
const Response = Schema.Struct({ answers: Schema.Record({ key: Schema.String, value: ChoiceAnswer }) });

/** Calls free Jev first; only unavailable/rate-limited HTTP responses use paid Jev. */
export const jevDecisions = Effect.fn('jev.decisions')(
  function* (input: {
    readonly state: string;
    readonly questions: Readonly<
      Record<
        string,
        { readonly type: 'choice'; readonly instructions: string; readonly criteria: Readonly<Record<string, string>> }
      >
    >;
  }) {
    const apiKey = yield* Config.redacted('OPENCODE_API_KEY');
    const client = yield* HttpClient.HttpClient;
    const request = Effect.fn('jev.request')(function* (model: (typeof JEV_MODELS)[number]) {
      yield* Effect.log('Classifying with Jev', { model });
      return yield* HttpClientRequest.post('https://opencode.ai/inference/systemone/v1/systemone').pipe(
        HttpClientRequest.bearerToken(apiKey),
        HttpClientRequest.bodyJson({ model: model.slice('opencode/'.length), ...input }),
        Effect.flatMap(client.execute)
      );
    });
    const freeResponse = yield* request(JEV_MODELS[0]);
    const response = [404, 410, 429, 503].includes(freeResponse.status) ? yield* request(JEV_MODELS[1]) : freeResponse;
    if (response.status < 200 || response.status >= 300) {
      return yield* new JevRequestFailed({ message: `Jev returned HTTP ${response.status}` });
    }
    return yield* response.json.pipe(
      Effect.flatMap(Schema.decodeUnknown(Response)),
      Effect.map(result => result.answers)
    );
  },
  Effect.provide(FetchHttpClient.layer),
  Effect.scoped
);
