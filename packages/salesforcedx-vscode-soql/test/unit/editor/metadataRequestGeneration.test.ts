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
  MetadataRequestGenerationGateLive,
  runForCurrentMetadataGeneration
} from '../../../src/editor/metadataRequestGeneration';

const provideMetadataRequestGate = Effect.provide(MetadataRequestGenerationGateLive);

describe('metadata request generation', () => {
  it('publishes a response while its org generation is current', async () => {
    const published = await Effect.runPromise(
      Effect.gen(function* () {
        const values = yield* Ref.make<string[]>([]);
        yield* runForCurrentMetadataGeneration(Effect.succeed('Account'), value =>
          Ref.update(values, current => [...current, value])
        );
        return yield* Ref.get(values);
      }).pipe(provideMetadataRequestGate)
    );

    expect(published).toEqual(['Account']);
  });

  it('does not publish a late response after the org generation changes', async () => {
    const published = await Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const response = yield* Deferred.make<string>();
        const values = yield* Ref.make<string[]>([]);
        const request = yield* runForCurrentMetadataGeneration(
          Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(response))),
          value => Ref.update(values, current => [...current, value])
        ).pipe(Effect.fork);

        yield* Deferred.await(started);
        yield* invalidateMetadataRequests(Effect.void);
        yield* Deferred.succeed(response, 'PreviousOrgObject__c');
        yield* Fiber.join(request);
        return yield* Ref.get(values);
      }).pipe(provideMetadataRequestGate)
    );

    expect(published).toEqual([]);
  });

  it('finishes publication before a later org-change notification', async () => {
    const events = await Effect.runPromise(
      Effect.gen(function* () {
        const publicationStarted = yield* Deferred.make<void>();
        const finishPublication = yield* Deferred.make<void>();
        const values = yield* Ref.make<string[]>([]);
        const publish = yield* runForCurrentMetadataGeneration(Effect.succeed('Account'), value =>
          Deferred.succeed(publicationStarted, undefined).pipe(
            Effect.andThen(Deferred.await(finishPublication)),
            Effect.andThen(Ref.update(values, current => [...current, `published:${value}`]))
          )
        ).pipe(Effect.fork);

        yield* Deferred.await(publicationStarted);
        const invalidate = yield* invalidateMetadataRequests(
          Ref.update(values, current => [...current, 'connection_changed'])
        ).pipe(Effect.fork);
        yield* Deferred.succeed(finishPublication, undefined);
        yield* Fiber.join(publish);
        yield* Fiber.join(invalidate);
        return yield* Ref.get(values);
      }).pipe(provideMetadataRequestGate)
    );

    expect(events).toEqual(['published:Account', 'connection_changed']);
  });
});
