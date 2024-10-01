/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  getYYYYMMddHHmmssDateFormat,
  makeDoubleDigit,
  optionYYYYMMddHHmmss,
  optionHHmm,
  optionMMddYYYY
} from '../../../src/date/format';

describe('getYYYYMMddHHmmssDateFormat', () => {
  it('should return the correct date format', () => {
    const date = new Date('2022-01-01T12:34:56');
    const formattedDate = getYYYYMMddHHmmssDateFormat(date);
    expect(formattedDate).toBe('20220101123456');
  });
});

describe('makeDoubleDigit', () => {
  it('should return the double digit format for single digit numbers', () => {
    const doubleDigit = makeDoubleDigit(5);
    expect(doubleDigit).toBe('05');
  });

  it('should return the same number for double digit numbers', () => {
    const doubleDigit = makeDoubleDigit(12);
    expect(doubleDigit).toBe('12');
  });
});

describe('optionYYYYMMddHHmmss', () => {
  it('should have the correct options', () => {
    expect(optionYYYYMMddHHmmss).toEqual({
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  });
});

describe('optionHHmm', () => {
  it('should have the correct options', () => {
    expect(optionHHmm).toEqual({
      hour: '2-digit',
      minute: '2-digit'
    });
  });
});

describe('optionMMddYYYY', () => {
  it('should have the correct options', () => {
    expect(optionMMddYYYY).toEqual({
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  });
});
