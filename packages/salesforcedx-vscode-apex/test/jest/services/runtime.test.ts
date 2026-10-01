/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Layer from 'effect/Layer';

// Provide a trivial layer so getRuntime() builds a real ManagedRuntime we can dispose.
jest.mock('../../../src/services/extensionProvider', () => ({ AllServicesLayer: Layer.empty }));

import { disposeRuntime, getRuntime } from '../../../src/services/runtime';

describe('services/runtime disposeRuntime', () => {
  afterEach(async () => {
    await disposeRuntime();
  });

  it('is a no-op when the runtime was never created', async () => {
    await expect(disposeRuntime()).resolves.toBeUndefined();
  });

  it('disposes the created runtime and clears the memo so getRuntime rebuilds fresh', async () => {
    const first = getRuntime();
    expect(getRuntime()).toBe(first); // memoized

    const disposeSpy = jest.spyOn(first, 'dispose');
    await disposeRuntime();
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    expect(getRuntime()).not.toBe(first); // memo cleared → new instance
  });
});
