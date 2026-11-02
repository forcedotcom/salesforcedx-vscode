/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import * as Effect from 'effect/Effect';
import { makeLineBreakpointMetadataCache } from '../../../src/breakpoints/lineBreakpointMetadataCache';

const outer = (uri: string, line: number): LineBreakpointInfo => ({ uri, typeref: 'Outer', lines: [line] });

describe('LineBreakpointMetadataCache', () => {
  it('fetches each uncached document once and returns their aggregate metadata', async () => {
    const getLineBreakpointInfo = vi.fn((uri: string) =>
      Promise.resolve([outer(uri, uri.endsWith('One.cls') ? 3 : 7)])
    );
    const cache = await Effect.runPromise(makeLineBreakpointMetadataCache(getLineBreakpointInfo));

    await expect(
      Effect.runPromise(
        cache.ensure(['file:///workspace/One.cls', 'file:///workspace/Two.cls', 'file:///workspace/One.cls'])
      )
    ).resolves.toEqual([outer('file:///workspace/One.cls', 3), outer('file:///workspace/Two.cls', 7)]);
    expect(getLineBreakpointInfo).toHaveBeenCalledTimes(2);
  });

  it('replaces only the refreshed document metadata', async () => {
    const responses = [
      [outer('file:///workspace/One.cls', 3)],
      [outer('file:///workspace/Two.cls', 7)],
      [outer('file:///workspace/One.cls', 5)]
    ];
    const getLineBreakpointInfo = vi.fn(() => Promise.resolve(responses.shift()!));
    const cache = await Effect.runPromise(makeLineBreakpointMetadataCache(getLineBreakpointInfo));

    await Effect.runPromise(cache.ensure(['file:///workspace/One.cls', 'file:///workspace/Two.cls']));
    await Effect.runPromise(cache.refresh('file:///workspace/One.cls'));

    await expect(Effect.runPromise(cache.snapshot())).resolves.toEqual(
      expect.arrayContaining([outer('file:///workspace/One.cls', 5), outer('file:///workspace/Two.cls', 7)])
    );
  });

  it('shares an in-flight request for one document', async () => {
    let resolve!: (value: LineBreakpointInfo[]) => void;
    const getLineBreakpointInfo = vi.fn(() => new Promise<LineBreakpointInfo[]>(done => (resolve = done)));
    const cache = await Effect.runPromise(makeLineBreakpointMetadataCache(getLineBreakpointInfo));

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
