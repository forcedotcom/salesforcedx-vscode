/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as dateUtil from '../../src/utils/dateUtil';

describe('Date Utils', () => {
  const testStartTime = '2020-11-09T18:02:50.000+0000';
  const testStartTimeDate = new Date(testStartTime);

  it('should format a date to locale by default', () => {
    const expectedFormat = `${testStartTimeDate.toDateString()} ${testStartTimeDate.toLocaleTimeString()}`;
    expect(dateUtil.formatStartTime(testStartTime)).to.equal(expectedFormat);
  });

  it('should format a date to locale by param', () => {
    const expectedFormat = `${testStartTimeDate.toDateString()} ${testStartTimeDate.toLocaleTimeString()}`;
    expect(dateUtil.formatStartTime(testStartTime, 'locale')).to.equal(
      expectedFormat
    );
  });

  it('should format a date to ISO', () => {
    expect(dateUtil.formatStartTime(testStartTime, 'ISO')).to.equal(
      testStartTimeDate.toISOString()
    );
  });
});
