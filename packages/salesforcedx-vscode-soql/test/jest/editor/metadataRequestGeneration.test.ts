/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Ref from 'effect/Ref';
import {
  invalidateMetadataRequests,
  runForCurrentMetadataGeneration
} from '../../../src/editor/metadataRequestGeneration';

describe('metadata request generation', () => {
  it('publishes a response while its org generation is current', async () => {
    const published = await Effect.runPromise(
      Effect.gen(function* () {
        const generation = yield* Ref.make(0);
        const values = yield* Ref.make<string[]>([]);
        yield* runForCurrentMetadataGeneration(generation, Effect.succeed('Account'), value =>
          Ref.update(values, current => [...current, value])
        );
        return yield* Ref.get(values);
      })
    );

    expect(published).toEqual(['Account']);
  });

  it('does not publish a late response after the org generation changes', async () => {
    const published = await Effect.runPromise(
      Effect.gen(function* () {
        const generation = yield* Ref.make(0);
        const started = yield* Deferred.make<void>();
        const response = yield* Deferred.make<string>();
        const values = yield* Ref.make<string[]>([]);
        const request = yield* runForCurrentMetadataGeneration(
          generation,
          Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(response))),
          value => Ref.update(values, current => [...current, value])
        ).pipe(Effect.fork);

        yield* Deferred.await(started);
        yield* invalidateMetadataRequests(generation);
        yield* Deferred.succeed(response, 'PreviousOrgObject__c');
        yield* Fiber.join(request);
        return yield* Ref.get(values);
      })
    );

    expect(published).toEqual([]);
  });
});
