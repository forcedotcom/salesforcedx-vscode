/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { stringify } from 'yaml';
import { validateAction } from './shared/validateAction.mts';

const action = (runs: Record<string, unknown>) => stringify({ name: 'Test', description: 'Test action', runs });

describe('JavaScript action runtime validation', () => {
  it('accepts node24 with a main entry point', () => {
    expect(validateAction(action({ using: 'node24', main: 'lib/index.js' })).errors).toEqual([]);
  });

  it('still requires a main entry point for node24', () => {
    expect(validateAction(action({ using: 'node24' })).errors.length).toBeGreaterThan(0);
  });

  it('still rejects unknown fields for node24', () => {
    expect(
      validateAction(action({ using: 'node24', main: 'lib/index.js', unexpected: true })).errors.length
    ).toBeGreaterThan(0);
  });

  it('rejects unsupported runtimes', () => {
    expect(validateAction(action({ using: 'node25', main: 'lib/index.js' })).errors.length).toBeGreaterThan(0);
  });

  it.each([
    'name: [unterminated\nruns:\n  using: node24\n  main: lib/index.js\n',
    'name: Test\nruns: {using: node24, main: lib/index.js\n'
  ])('returns parse errors for malformed YAML instead of throwing', source => {
    expect(validateAction(source).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'parse_error' })])
    );
  });
});
