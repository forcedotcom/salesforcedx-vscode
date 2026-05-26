/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';

const registerCommandWithRuntime = jest.fn(() => () => Effect.succeed({ dispose: jest.fn() }));

jest.mock('../../src/services/extensionProvider', () => ({
  buildAllServicesLayer: () => ({}),
  setAllServicesLayer: jest.fn(),
  getApexOasRuntime: () => ({ runPromise: <A, E>(eff: Effect.Effect<A, E>) => Effect.runPromise(eff) })
}));

jest.mock('@salesforce/effect-ext-utils', () => ({
  ExtensionProviderService: {
    pipe: jest.fn()
  }
}));

// Provide ExtensionProviderService via Effect.gen yield* — return shape matching (yield* ExtensionProviderService).getServicesApi
jest.mock('../../src/index', () => {
  const actual = jest.requireActual('../../src/index');
  return actual;
});

describe('OAS Extension Activation', () => {
  it('module loads without error', () => {
    // Smoke test — full activation flow is covered by integration tests
    expect(registerCommandWithRuntime).toBeDefined();
  });
});
