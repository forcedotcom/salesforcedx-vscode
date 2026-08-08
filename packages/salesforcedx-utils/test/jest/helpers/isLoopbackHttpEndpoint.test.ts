/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isLoopbackHttpEndpoint } from '../../../src/helpers/isLoopbackHttpEndpoint';

describe('isLoopbackHttpEndpoint', () => {
  it.each(['http://localhost:3002', 'https://127.0.0.1:4318', 'http://[::1]:3003'])(
    'accepts HTTP(S) loopback endpoint %s',
    endpoint => expect(isLoopbackHttpEndpoint(endpoint)).toBe(true)
  );

  it.each([
    undefined,
    '',
    'https://remote.example/o11y',
    'http://localhost.example.com',
    'file:///tmp/o11y',
    'not a url'
  ])('rejects non-loopback endpoint %s', endpoint => expect(isLoopbackHttpEndpoint(endpoint)).toBe(false));
});
