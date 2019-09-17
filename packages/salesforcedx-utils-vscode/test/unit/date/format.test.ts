/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  getYYYYMMddHHmmssDateFormat,
  makeDoubleDigit,
  optionHHmm,
  optionMMddYYYY,
  optionYYYYMMddHHmmss
} from '../../../src/date';

describe('Date format utility', () => {
  it('Should return a string with two characters, zero being the first character', () => {
    const singleDigit = 9;
    const doubleDigit = makeDoubleDigit(singleDigit);
    expect(doubleDigit).to.equal('09');
  });

  it('Should return a the same two character string when provided a double digit number', () => {
    const singleDigit = 13;
    const doubleDigit = makeDoubleDigit(singleDigit);
    expect(doubleDigit).to.equal('13');
  });

  it('Should return a YYYYMMddHHmmss formatted string', () => {
    const utcString = '2019-09-10T04:34:28+0000';
    const result = getYYYYMMddHHmmssDateFormat(new Date(utcString));
    expect(result.startsWith('2019')).to.equal(true);
    expect(result.length).to.equal(14);
  });

  it('Should return a YYYYMMddHHmmss formatted string when using optionYYYYMMddHHmmss', () => {
    const utcString = '2019-09-10T04:34:28+0000';

    const localUTCDate = new Date(utcString);
    const localDateFormatted = localUTCDate.toLocaleDateString(
      'en-US',
      optionYYYYMMddHHmmss
    );

    const dateTimeFormatRegex = /([0-9]{2})(\/)([0-9]{2})(\/)([0-9]{4})(\,)\s([0-9])(:)([0-9]{2})(:)([0-9]{2})\s(AM|PM)/;
    expect(dateTimeFormatRegex.test(localDateFormatted)).to.equal(true);
  });

  it('Should return a HHmm formatted string when using optionHHmm', () => {
    const utcString = '2019-09-10T04:34:28+0000';

    const localUTCDate = new Date(utcString);
    const localTimeFormatted = localUTCDate.toLocaleTimeString(
      'en-US',
      optionHHmm
    );

    const timeFormatRegex = /([0-9])(:)([0-9]{2})\s(AM|PM)/;
    expect(timeFormatRegex.test(localTimeFormatted)).to.equal(true);
  });

  it('Should return a optionMMddYYYY formatted string when using optionMMddYYYY', () => {
    const utcString = '2019-09-10T04:34:28+0000';

    const localUTCDate = new Date(utcString);
    const localDateFormatted = localUTCDate.toLocaleDateString(
      'en-US',
      optionMMddYYYY
    );

    const dateTimeFormatRegex = /([0-9]{2})(\/)([0-9]{2})(\/)([0-9]{4})/;
    expect(dateTimeFormatRegex.test(localDateFormatted)).to.equal(true);
  });
});
