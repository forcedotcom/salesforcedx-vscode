/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { stripAllRows } from '../../../src/editor/allRows';

describe('stripAllRows', () => {
  it('strips a trailing ALL ROWS clause and sets scanAll true', () => {
    expect(stripAllRows('SELECT Id FROM Account ALL ROWS')).toEqual({
      soql: 'SELECT Id FROM Account',
      scanAll: true
    });
  });

  it('is case-insensitive and tolerates extra whitespace', () => {
    expect(stripAllRows('SELECT Id FROM Account   all   rows   ')).toEqual({
      soql: 'SELECT Id FROM Account',
      scanAll: true
    });
  });

  it('leaves a query without ALL ROWS unchanged with scanAll false', () => {
    expect(stripAllRows('SELECT Id FROM Account LIMIT 5')).toEqual({
      soql: 'SELECT Id FROM Account LIMIT 5',
      scanAll: false
    });
  });

  it('does not strip ALL ROWS that is not at the end (e.g. inside a string literal)', () => {
    const soql = "SELECT Id FROM Account WHERE Name = 'ALL ROWS'";
    expect(stripAllRows(soql)).toEqual({ soql, scanAll: false });
  });
});
