/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Model, OpenCode, Provider } from '@opencode/client/effect';
import { Effect } from 'effect';
import * as FetchHttpClient from 'effect/http/FetchHttpClient';

type Client = Effect.Success<ReturnType<typeof OpenCode.make>>;
type Request = Parameters<Client['experimental']['generate']['decisions']>[0];
type Result = Effect.Success<ReturnType<Client['experimental']['generate']['decisions']>>;

/** Promise-only boundary: no runnable Effect values cross between Effect majors. */
export const decisions = (
  input: Omit<Request, 'model'>,
  options: {
    readonly baseUrl: string;
    readonly signal?: AbortSignal;
    readonly fetch?: typeof globalThis.fetch;
  }
): Promise<Result> =>
  Effect.gen(function* () {
    const client = yield* OpenCode.make({ baseUrl: options.baseUrl });
    const request = (id: string) =>
      client.experimental.generate.decisions({
        ...input,
        model: { providerID: Provider.ID.make('opencode'), id: Model.ID.make(id) }
      });
    return yield* request('jev-1.13-free').pipe(
      Effect.catchTags({
        ProviderRequestError: error =>
          (error.status !== undefined && [404, 410, 429, 503].includes(error.status)) || error.reason === 'rate_limit'
            ? request('jev-1.14')
            : Effect.fail(error),
        ModelNotFoundError: () => request('jev-1.14')
      })
    );
  }).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, options.fetch ?? globalThis.fetch),
    Effect.scoped,
    effect => Effect.runPromise(effect, { signal: options.signal })
  );
