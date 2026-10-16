/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { prepareQuery } from '../../src/prepareQuery';

describe('prepareQuery', () => {
  it.each([
    ['SELECT Id FROM Account', 'SELECT Id FROM Account', false],
    ['// this is a comment\nSELECT Id, Name FROM Account', 'SELECT Id, Name FROM Account', false],
    ['// first\n// second\n\n   // indented\n\nSELECT Id\nFROM Account', 'SELECT Id\nFROM Account', false],
    ['SELECT Id, Name FROM Account;', 'SELECT Id, Name FROM Account', false],
    ['SELECT Id FROM Account;;', 'SELECT Id FROM Account', false],
    ['SELECT Id FROM Account;   ', 'SELECT Id FROM Account', false],
    ['// header\nSELECT Id FROM Account;', 'SELECT Id FROM Account', false],
    ['SELECT Id FROM Account ALL ROWS;', 'SELECT Id FROM Account', true],
    ['// header\nSELECT Id FROM Account ALL ROWS;;  ', 'SELECT Id FROM Account', true],
    ["SELECT Id FROM Account WHERE Name = 'a//b'", "SELECT Id FROM Account WHERE Name = 'a//b'", false],
    ["SELECT Id FROM Account WHERE Name = 'foo;'", "SELECT Id FROM Account WHERE Name = 'foo;'", false],
    ["SELECT Id FROM Account WHERE Name = ';'", "SELECT Id FROM Account WHERE Name = ';'", false],
    ["SELECT Id FROM Account WHERE Name = 'a;';", "SELECT Id FROM Account WHERE Name = 'a;'", false]
  ])('prepares %s', (input, soql, scanAll) => {
    expect(prepareQuery(input)).toEqual({ soql, scanAll });
  });
});
