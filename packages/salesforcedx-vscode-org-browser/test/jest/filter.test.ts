/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { makeFilterState, matchesPattern, parseFilterText } from '../../src/browser/filter';

describe('Org Browser filter grammar', () => {
  it.each([
    ['', { typeFilter: undefined, componentFilter: undefined, typeIsRegex: false, componentIsRegex: false }],
    ['ApexClass', { typeFilter: 'ApexClass', componentFilter: undefined, typeIsRegex: false, componentIsRegex: false }],
    [':Foo*', { typeFilter: '*', componentFilter: 'Foo*', typeIsRegex: false, componentIsRegex: false }],
    ['Apex*:Foo*', { typeFilter: 'Apex*', componentFilter: 'Foo*', typeIsRegex: false, componentIsRegex: false }],
    ['/Apex.*/:/Foo.*/', { typeFilter: 'Apex.*', componentFilter: 'Foo.*', typeIsRegex: true, componentIsRegex: true }]
  ])('parses %s', (text, expected) => {
    expect(parseFilterText(text)).toEqual(expected);
  });

  it('preserves presence toggles in the stable filter projection', () => {
    expect(makeFilterState(false, true, 'Apex*')).toEqual({
      showLocal: false,
      showOrg: true,
      text: 'Apex*',
      typeFilter: 'Apex*',
      componentFilter: undefined,
      typeIsRegex: false,
      componentIsRegex: false
    });
  });

  it.each([
    ['ApexClass', 'apexclass', false, true],
    ['ApexClass', 'Apex*', false, true],
    ['CustomObject', 'Apex*', false, false],
    ['ApexClass', '^Apex(Class|Trigger)$', true, true],
    ['ApexClass', '[', true, false]
  ])('matches %s against %s', (text, pattern, regex, expected) => {
    expect(matchesPattern(text, pattern, regex)).toBe(expected);
  });
});
