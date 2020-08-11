/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { colorLogs } from '../src/utils';
import { expect } from 'chai';

describe('Colorize Logs', async () => {
  it('should color time/date format correctly', async () => {
    const testData = '12:47:29.584';
    const coloredData = colorLogs(testData);
    expect(coloredData).to.eql(
      '\u001b[94m12\u001b[39m:\u001b[94m47\u001b[39m:\u001b[94m29.\u001b[94m584\u001b[39m\u001b[39m'
    );
  });

  it('should color exception message correctly', async () => {
    const testData =
      '$CalloutInTestmethodException: Methods defined as TestMethod do not support Web service callouts"';
    const coloredData = colorLogs(testData);
    expect(coloredData).to.eql(
      '$\u001b[1m\u001b[31mCalloutInTestmethodException\u001b[39m\u001b[22m: Methods defined as TestMethod do not support Web service callouts"'
    );
  });

  it('should color debug message correctly', async () => {
    const testData = 'SYSTEM,DEBUG;VALIDATION';
    const coloredData = colorLogs(testData);
    expect(coloredData).to.eql(
      'SYSTEM,\u001b[1m\u001b[36mDEBUG\u001b[39m\u001b[22m;VALIDATION'
    );
  });

  it('should color basic strings correctly', async () => {
    const testData = 'testdevhub@ria.com';
    const coloredData = colorLogs(testData);
    expect(coloredData).to.eql('testdevhub@\u001b[94mria.com\u001b[39m');
  });

  it('should color info text correctly', async () => {
    const testData = 'APEX_PROFILING,INFO;';
    const coloredData = colorLogs(testData);
    expect(coloredData).to.eql(
      'APEX_PROFILING,\u001b[1m\u001b[32mINFO\u001b[39m\u001b[22m;'
    );
  });

  it('should color warn text correctly', async () => {
    const testData = 'APEX_PROFILING,WARN;';
    const coloredData = colorLogs(testData);
    expect(coloredData).to.eql(
      'APEX_PROFILING,\u001b[1m\u001b[33mWARN\u001b[39m\u001b[22m;'
    );
  });
});
