/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as FetchHttpClient from 'effect/http/FetchHttpClient';
import { decisions } from '@salesforce/opencode-decisions';
import { Config, Effect, Option, Redacted, Schema } from 'effect';

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
  const fetch = yield* Effect.serviceOption(FetchHttpClient.Fetch);
  const password = yield* Config.option(Config.Redacted('OPENCODE_PASSWORD'));
  const result = yield* Effect.tryPromise({
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
        {
          baseUrl: 'http://127.0.0.1:4096',
          headers: Option.match(password, {
            onNone: () => ({}),
            onSome: value => ({
              authorization: `Basic ${Buffer.from(`opencode:${Redacted.value(value)}`).toString('base64')}`
            })
          }),
          signal,
          fetch: Option.getOrElse(fetch, () => globalThis.fetch)
        }
      ),
    catch: error => new JevRequestFailed({ message: String(error) })
  });
  const expectedNames = Object.keys(input.questions);
  if (
    result.answers.length !== expectedNames.length ||
    new Set(result.answers.map(answer => answer.name)).size !== expectedNames.length
  ) {
    return yield* new JevRequestFailed({ message: 'Jev returned missing or duplicate answers' });
  }
  return yield* Effect.forEach(expectedNames, name => {
    const question = input.questions[name];
    const Choice = Schema.Struct({
      type: Schema.Literal('choice'),
      name: Schema.Literal(name),
      choice: Schema.Literals(Object.keys(question.criteria))
    });
    return Schema.decodeUnknownEffect(Choice)(result.answers.find(answer => answer.name === name)).pipe(
      Effect.map(answer => answer.choice),
      Effect.mapError(() => new JevRequestFailed({ message: `Invalid Jev answer for ${name}` }))
    );
  });
});
