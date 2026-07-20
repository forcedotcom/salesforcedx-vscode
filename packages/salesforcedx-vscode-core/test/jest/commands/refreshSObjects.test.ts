/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { extractErrorMessage } from '../../../src/commands/refreshSObjects';

describe('extractErrorMessage', () => {
  it('returns the message of an Error instance', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the nested error message from { error: Error }', () => {
    expect(extractErrorMessage({ error: new Error('nested') })).toBe('nested');
  });

  it('returns the message from { message: string }', () => {
    expect(extractErrorMessage({ message: 'plain' })).toBe('plain');
  });

  it('does not treat an array as a record (array-exclusion) and falls through to String()', () => {
    expect(extractErrorMessage([])).toBe('');
  });

  it.each([
    ['a string primitive', 'oops', 'oops'],
    ['a number primitive', 42, '42'],
    ['undefined', undefined, 'undefined'],
    ['null', null, 'null']
  ])('stringifies %s', (_label, input, expected) => {
    expect(extractErrorMessage(input)).toBe(expected);
  });
});
