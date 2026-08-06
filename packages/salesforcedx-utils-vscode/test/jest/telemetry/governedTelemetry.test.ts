/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import { makeGovernedEgressDispatcher } from 'salesforcedx-vscode-services/out/src/observability/governedEgressDispatcher';
import { makeTelemetryDispatcher } from '../../../src/telemetry/governedTelemetry';

const getServicesApi = jest.fn();

jest.mock('@salesforce/effect-ext-utils/out/src/extensionProvider', () => ({
  getServicesApi: Effect.suspend(() => getServicesApi() as Effect.Effect<unknown>)
}));

describe('makeTelemetryDispatcher', () => {
  const makeApi = (classification: 'gov' | 'nonGov' | 'unknown') => {
    class Policy extends Context.Tag('TestPolicy')<
      Policy,
      {
        getClassification: (orgId: string) => Effect.Effect<'gov' | 'nonGov' | 'unknown'>;
        getCurrent: () => Effect.Effect<{ orgId?: string; classification: 'gov' | 'nonGov' | 'unknown' }>;
        changes: Stream.Stream<{ orgId?: string; classification: 'gov' | 'nonGov' | 'unknown' }>;
      }
    >() {}
    const policy = {
      getClassification: () => Effect.succeed(classification),
      getCurrent: () => Effect.succeed({ orgId: '00D', classification }),
      changes: Stream.empty
    };
    return {
      services: {
        OrgTelemetryPolicy: Policy,
        makeGovernedEgressDispatcher,
        prebuiltServicesDependencies: Context.make(Policy, policy)
      }
    };
  };

  beforeEach(() => getServicesApi.mockReset());

  it.each([
    ['gov', 0],
    ['unknown', 0],
    ['nonGov', 1]
  ] as const)('gates %s classifications', async (classification, expected) => {
    const send = jest.fn();
    const makeSink = jest.fn(() => ({ send: () => Effect.sync(send), forceFlush: Effect.void, close: Effect.void }));
    getServicesApi.mockReturnValue(Effect.succeed(makeApi(classification)));

    const dispatcher = await makeTelemetryDispatcher(Effect.sync(makeSink));
    expect(dispatcher).toBeDefined();
    await Effect.runPromise(dispatcher!.submit({ orgId: '00D', payload: 1 }));
    await Effect.runPromise(dispatcher!.forceFlush);

    expect(makeSink).toHaveBeenCalledTimes(expected);
    expect(send).toHaveBeenCalledTimes(expected);
    await Effect.runPromise(dispatcher!.close);
  });

  it('fails closed when the services API is missing or invalid', async () => {
    const makeSink = jest.fn();
    getServicesApi.mockReturnValue(Effect.fail(new Error('missing')));
    expect(await makeTelemetryDispatcher(Effect.sync(makeSink))).toBeUndefined();

    getServicesApi.mockReturnValue(Effect.succeed({ services: {} }));
    expect(await makeTelemetryDispatcher(Effect.sync(makeSink))).toBeUndefined();
    expect(makeSink).not.toHaveBeenCalled();
  });

  it('does not retry sink initialization after a session failure', async () => {
    const makeSink = jest.fn(() => {
      throw new Error('failed');
    });
    getServicesApi.mockReturnValue(Effect.succeed(makeApi('nonGov')));
    const dispatcher = await makeTelemetryDispatcher(Effect.sync(makeSink));

    await Effect.runPromise(dispatcher!.submit({ orgId: '00D', payload: 1 }));
    await Effect.runPromise(dispatcher!.submit({ orgId: '00D', payload: 2 }));
    await Effect.runPromise(dispatcher!.forceFlush);

    expect(makeSink).toHaveBeenCalledTimes(1);
    await Effect.runPromise(dispatcher!.close);
  });

  it('releases an unknown item after the same org becomes nonGov', async () => {
    const send = jest.fn();
    const program = Effect.gen(function* () {
      const changes = yield* Queue.unbounded<{ orgId: string; classification: 'nonGov' }>();
      const api = makeApi('unknown');
      const policyTag = api.services.OrgTelemetryPolicy;
      getServicesApi.mockReturnValue(
        Effect.succeed({
          services: {
            ...api.services,
            prebuiltServicesDependencies: Context.make(policyTag, {
              getClassification: () => Effect.succeed('unknown' as const),
              getCurrent: () => Effect.succeed({ orgId: '00D', classification: 'unknown' as const }),
              changes: Stream.fromQueue(changes)
            })
          }
        })
      );
      const dispatcher = yield* Effect.promise(() =>
        makeTelemetryDispatcher(
          Effect.succeed({ send: () => Effect.sync(send), forceFlush: Effect.void, close: Effect.void })
        )
      );

      expect(yield* dispatcher!.submit({ orgId: '00D', payload: 1 })).toBe('queued');
      yield* Queue.offer(changes, { orgId: '00D', classification: 'nonGov' });
      yield* Effect.sleep(10);
      yield* dispatcher!.forceFlush;
      expect(send).toHaveBeenCalledTimes(1);
      yield* dispatcher!.close;
    });

    await Effect.runPromise(program);
  });
});
