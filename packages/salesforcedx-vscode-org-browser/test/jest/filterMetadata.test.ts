/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  isCompleteSearchTerm,
  isInvalidStructuredSearchTerm,
  parseFilterValue
} from '../../src/commands/filterMetadata';

describe('Org Browser filter input', () => {
  it.each([
    ['broker', 'broker', false],
    ['Apex*', 'Apex*', false],
    ['/Apex.*/', 'Apex.*', true]
  ])('applies bare %s to both types and components', (input, pattern, isRegex) => {
    expect(parseFilterValue(input)).toEqual({
      typeFilter: undefined,
      componentFilter: pattern,
      typeIsRegex: false,
      componentIsRegex: isRegex
    });
  });

  it.each([
    ['ApexClass:', 'ApexClass', false],
    ['Apex*:', 'Apex*', false],
    ['/Apex.*/:', 'Apex.*', true]
  ])('treats %s as a type-only filter', (input, pattern, isRegex) => {
    expect(parseFilterValue(input)).toEqual({
      typeFilter: pattern,
      componentFilter: '',
      typeIsRegex: isRegex,
      componentIsRegex: false
    });
  });

  it('keeps the colon-separated type and component filters', () => {
    expect(parseFilterValue('ApexClass:/test.*/')).toEqual({
      typeFilter: 'ApexClass',
      componentFilter: 'test.*',
      typeIsRegex: false,
      componentIsRegex: true
    });
  });

  it.each([
    ['broker', true],
    ['ApexClass:Broker', true],
    ['/Apex.*/:/Broker.*/', true],
    ['/Apex', false],
    ['ApexClass:/Broker', false],
    ['/Apex(/:Broker', false],
    ['ApexClass:/[/', false],
    ['/Apex/x', false]
  ])('treats %s as complete=%s for discovery prompting', (value, expected) => {
    expect(isCompleteSearchTerm(value)).toBe(expected);
  });

  it.each([
    ['broker', false],
    ['ApexClass:Broker', false],
    [':Broker', false],
    ['ApexClass:', true],
    ['/Apex', true],
    ['ApexClass:/Broker', true],
    ['ApexClass:/[/', true]
  ])('treats %s as invalid structured search=%s', (value, expected) => {
    expect(isInvalidStructuredSearchTerm(value)).toBe(expected);
  });
});
