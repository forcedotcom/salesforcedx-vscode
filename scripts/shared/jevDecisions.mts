/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import { decisions } from '@salesforce/opencode-decisions';
import { Config, Effect, Option, Schema } from 'effect';

class JevRequestFailed extends Schema.TaggedError<JevRequestFailed>()('JevRequestFailed', {
  message: Schema.String
}) {}

export const jevDecisions = Effect.fn('jev.decisions')(function* (input: {
  readonly state: string;
  readonly questions: Readonly<
    Record<
      string,
      { readonly type: 'choice'; readonly instructions: string; readonly criteria: Readonly<Record<string, string>> }
    >
  >;
}) {
  const baseUrl = yield* Config.string('OPENCODE_SERVER_URL').pipe(Config.withDefault('http://127.0.0.1:4096'));
  const fetch = yield* Effect.serviceOption(FetchHttpClient.Fetch);
  return yield* Effect.tryPromise({
    try: signal =>
      decisions(
        {
          input: [{ type: 'text', text: input.state }],
          questions: Object.entries(input.questions).map(([name, question]) => ({
            type: 'choice',
            name,
            instructions: question.instructions,
            choices: Object.entries(question.criteria).map(([value, description]) => ({ value, description }))
          }))
        },
        { baseUrl, signal, fetch: Option.getOrElse(fetch, () => globalThis.fetch) }
      ),
    catch: error => new JevRequestFailed({ message: String(error) })
  }).pipe(Effect.map(result => Object.fromEntries(result.answers.map(answer => [answer.name, answer]))));
});
