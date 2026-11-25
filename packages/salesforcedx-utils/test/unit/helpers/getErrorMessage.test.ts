/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getErrorMessage } from '../../../src/helpers/getErrorMessage';

describe('getErrorMessage', () => {
  it.each([
    [new Error('failed'), 'failed'],
    [new TypeError('invalid'), 'invalid'],
    [new Error(), ''],
    ['failed', 'failed'],
    ['', ''],
    [0, '0'],
    [{ message: 'object message' }, '[object Object]'],
    [{ error: new Error('nested') }, '[object Object]'],
    [{ toString: () => 'custom message' }, 'custom message']
  ])('converts %s to %s', (error, expected) => {
    expect(getErrorMessage(error)).toBe(expected);
  });

  it('prefers an Error message over its cause or custom toString', () => {
    const error = new Error('outer', { cause: new Error('inner') });
    error.toString = () => 'custom';
    expect(getErrorMessage(error)).toBe('outer');
  });
});
