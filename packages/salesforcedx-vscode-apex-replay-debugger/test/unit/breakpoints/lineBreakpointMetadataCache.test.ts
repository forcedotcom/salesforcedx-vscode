/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Scope from 'effect/Scope';
import {
  makeLineBreakpointMetadataCache,
  type LineBreakpointMetadataCache
} from '../../../src/breakpoints/lineBreakpointMetadataCache';

const outer = (uri: string, line: number): LineBreakpointInfo => ({ uri, typeref: 'Outer', lines: [line] });
const withCache = <A>(
  getLineBreakpointInfo: (uri: string) => Promise<LineBreakpointInfo[]>,
  test: (cache: LineBreakpointMetadataCache) => Promise<A>
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
      const cache = yield* makeLineBreakpointMetadataCache(getLineBreakpointInfo, scope);
      return yield* Effect.promise(() => test(cache));
    }).pipe(Effect.scoped)
  );

describe('LineBreakpointMetadataCache', () => {
  it('fetches each uncached document once and returns their aggregate metadata', async () => {
    const getLineBreakpointInfo = vi.fn((uri: string) =>
      Promise.resolve([outer(uri, uri.endsWith('One.cls') ? 3 : 7)])
    );
    await withCache(getLineBreakpointInfo, async cache => {
      await expect(
        Effect.runPromise(
          cache.ensure(['file:///workspace/One.cls', 'file:///workspace/Two.cls', 'file:///workspace/One.cls'])
        )
      ).resolves.toEqual([outer('file:///workspace/One.cls', 3), outer('file:///workspace/Two.cls', 7)]);
      expect(getLineBreakpointInfo).toHaveBeenCalledTimes(2);
    });
  });

  it('replaces only the refreshed document metadata', async () => {
    const responses = [
      [outer('file:///workspace/One.cls', 3)],
      [outer('file:///workspace/Two.cls', 7)],
      [outer('file:///workspace/One.cls', 5)]
    ];
    const getLineBreakpointInfo = vi.fn(() => Promise.resolve(responses.shift()!));
    await withCache(getLineBreakpointInfo, async cache => {
      await Effect.runPromise(cache.ensure(['file:///workspace/One.cls', 'file:///workspace/Two.cls']));
      await Effect.runPromise(cache.refresh('file:///workspace/One.cls'));
      await expect(Effect.runPromise(cache.snapshot())).resolves.toEqual(
        expect.arrayContaining([outer('file:///workspace/One.cls', 5), outer('file:///workspace/Two.cls', 7)])
      );
    });
  });

  it('shares an in-flight request for one document', async () => {
    let resolve!: (value: LineBreakpointInfo[]) => void;
    const getLineBreakpointInfo = vi.fn(() => new Promise<LineBreakpointInfo[]>(done => (resolve = done)));
    await withCache(getLineBreakpointInfo, async cache => {
      const first = Effect.runPromise(cache.ensure(['file:///workspace/One.cls']));
      const second = Effect.runPromise(cache.ensure(['file:///workspace/One.cls']));
      await vi.waitFor(() => expect(getLineBreakpointInfo).toHaveBeenCalledOnce());
      resolve([outer('file:///workspace/One.cls', 3)]);
      await expect(Promise.all([first, second])).resolves.toEqual([
        [outer('file:///workspace/One.cls', 3)],
        [outer('file:///workspace/One.cls', 3)]
      ]);
      expect(getLineBreakpointInfo).toHaveBeenCalledOnce();
    });
  });

  it('retries a document after a failed lookup', async () => {
    const uri = 'file:///workspace/Unavailable.cls';
    const getLineBreakpointInfo = vi
      .fn()
      .mockRejectedValueOnce(new Error('language server unavailable'))
      .mockResolvedValueOnce([outer(uri, 3)]);
    await withCache(getLineBreakpointInfo, async cache => {
      await expect(Effect.runPromise(cache.ensure([uri]))).rejects.toThrow('language server unavailable');
      await expect(Effect.runPromise(cache.ensure([uri]))).resolves.toEqual([outer(uri, 3)]);
      expect(getLineBreakpointInfo).toHaveBeenCalledTimes(2);
    });
  });

  it('shares concurrent refreshes for one document', async () => {
    const uri = 'file:///workspace/One.cls';
    const responses: Array<(value: LineBreakpointInfo[]) => void> = [];
    const getLineBreakpointInfo = vi.fn(() => new Promise<LineBreakpointInfo[]>(resolve => responses.push(resolve)));
    await withCache(getLineBreakpointInfo, async cache => {
      const first = Effect.runPromise(cache.refresh(uri));
      await vi.waitFor(() => expect(getLineBreakpointInfo).toHaveBeenCalledOnce());
      const second = Effect.runPromise(cache.refresh(uri));
      responses[0]([outer(uri, 3)]);
      await expect(Promise.all([first, second])).resolves.toEqual([[outer(uri, 3)], [outer(uri, 3)]]);
      await expect(Effect.runPromise(cache.ensure([uri]))).resolves.toEqual([outer(uri, 3)]);
      expect(getLineBreakpointInfo).toHaveBeenCalledOnce();
    });
  });

  it('retries after a failed refresh', async () => {
    const uri = 'file:///workspace/One.cls';
    const getLineBreakpointInfo = vi
      .fn()
      .mockResolvedValueOnce([outer(uri, 3)])
      .mockRejectedValueOnce(new Error('language server unavailable'))
      .mockResolvedValueOnce([outer(uri, 5)]);
    await withCache(getLineBreakpointInfo, async cache => {
      await Effect.runPromise(cache.ensure([uri]));
      await expect(Effect.runPromise(cache.refresh(uri))).rejects.toThrow('language server unavailable');
      await expect(Effect.runPromise(cache.ensure([uri]))).resolves.toEqual([outer(uri, 5)]);
      expect(getLineBreakpointInfo).toHaveBeenCalledTimes(3);
    });
  });

  it('waits for an in-flight refresh before returning metadata', async () => {
    const uri = 'file:///workspace/One.cls';
    let resolveRefresh!: (value: LineBreakpointInfo[]) => void;
    const getLineBreakpointInfo = vi
      .fn()
      .mockResolvedValueOnce([outer(uri, 3)])
      .mockImplementationOnce(() => new Promise<LineBreakpointInfo[]>(resolve => (resolveRefresh = resolve)));
    await withCache(getLineBreakpointInfo, async cache => {
      await Effect.runPromise(cache.ensure([uri]));
      const refresh = Effect.runPromise(cache.refresh(uri));
      await vi.waitFor(() => expect(getLineBreakpointInfo).toHaveBeenCalledTimes(2));
      const ensure = Effect.runPromise(cache.ensure([uri]));
      resolveRefresh([outer(uri, 5)]);
      await expect(Promise.all([refresh, ensure])).resolves.toEqual([[outer(uri, 5)], [outer(uri, 5)]]);
    });
  });

  it('retains a refresh after its caller is interrupted without blocking other documents', async () => {
    const firstUri = 'file:///workspace/One.cls';
    const secondUri = 'file:///workspace/Two.cls';
    let resolveRefresh!: (value: LineBreakpointInfo[]) => void;
    const getLineBreakpointInfo = vi
      .fn()
      .mockResolvedValueOnce([outer(firstUri, 3)])
      .mockImplementationOnce(() => new Promise<LineBreakpointInfo[]>(resolve => (resolveRefresh = resolve)))
      .mockResolvedValueOnce([outer(secondUri, 7)]);

    await Effect.runPromise(
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
        const cache = yield* makeLineBreakpointMetadataCache(getLineBreakpointInfo, scope);
        yield* cache.ensure([firstUri]);
        const refresh = yield* Effect.fork(cache.refresh(firstUri));
        yield* Effect.promise(() => vi.waitFor(() => expect(getLineBreakpointInfo).toHaveBeenCalledTimes(2)));
        yield* Fiber.interrupt(refresh);

        const ensure = yield* Effect.fork(cache.ensure([firstUri]));
        expect(yield* cache.ensure([secondUri])).toEqual([outer(secondUri, 7)]);
        resolveRefresh([outer(firstUri, 5)]);
        expect(yield* Fiber.join(ensure)).toEqual([outer(firstUri, 5)]);
      }).pipe(Effect.scoped)
    );
  });

  it('refreshes again when the initial metadata lookup is still pending', async () => {
    const uri = 'file:///workspace/One.cls';
    const responses: Array<(value: LineBreakpointInfo[]) => void> = [];
    const getLineBreakpointInfo = vi.fn(() => new Promise<LineBreakpointInfo[]>(resolve => responses.push(resolve)));

    await withCache(getLineBreakpointInfo, async cache => {
      const initialEnsure = Effect.runPromise(cache.ensure([uri]));
      await vi.waitFor(() => expect(getLineBreakpointInfo).toHaveBeenCalledOnce());
      const refresh = Effect.runPromise(cache.refresh(uri));
      responses[0]([outer(uri, 3)]);
      await vi.waitFor(() => expect(getLineBreakpointInfo).toHaveBeenCalledTimes(2));
      responses[1]([outer(uri, 5)]);

      await expect(Promise.all([initialEnsure, refresh])).resolves.toEqual([[outer(uri, 3)], [outer(uri, 5)]]);
      await expect(Effect.runPromise(cache.ensure([uri]))).resolves.toEqual([outer(uri, 5)]);
    });
  });

  it('refreshes after a pending initial metadata lookup fails', async () => {
    const uri = 'file:///workspace/One.cls';
    let rejectInitial!: (reason: Error) => void;
    const getLineBreakpointInfo = vi
      .fn()
      .mockImplementationOnce(() => new Promise<LineBreakpointInfo[]>((_resolve, reject) => (rejectInitial = reject)))
      .mockResolvedValueOnce([outer(uri, 5)]);

    await withCache(getLineBreakpointInfo, async cache => {
      const initialEnsure = Effect.runPromise(cache.ensure([uri]));
      await vi.waitFor(() => expect(getLineBreakpointInfo).toHaveBeenCalledOnce());
      const refresh = Effect.runPromise(cache.refresh(uri));
      rejectInitial(new Error('language server unavailable'));

      await expect(initialEnsure).rejects.toThrow('language server unavailable');
      await expect(refresh).resolves.toEqual([outer(uri, 5)]);
      expect(getLineBreakpointInfo).toHaveBeenCalledTimes(2);
    });
  });
});
