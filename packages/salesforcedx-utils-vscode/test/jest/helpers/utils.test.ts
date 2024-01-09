/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { realpathSync } from 'fs';
import { TelemetryService } from '../../../src';
import { flushFilePath } from '../../../src/helpers/utils';

describe('flushFilePath', () => {
  let teleSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.mock('fs');
    jest.mock('../../../src/context/workspaceContextUtil');
  });
  it('should detect changes in character casing', () => {
    const originalPath = './test.txt';
    const alteredPath = './TEST.txt';

    jest.spyOn(realpathSync, 'native').mockReturnValue(alteredPath);
    teleSpy = jest.spyOn(TelemetryService.prototype, 'sendEventData');

    const r = flushFilePath(originalPath);
    expect(r).toEqual(alteredPath);
    expect(teleSpy).toHaveBeenCalledTimes(1);
  });

  it('should not send to telemetry if there are no changes in character casing', () => {
    const originalPath = './test.txt';
    const alteredPath = './test.txt';

    jest.spyOn(realpathSync, 'native').mockReturnValue(alteredPath);
    teleSpy = jest.spyOn(TelemetryService.prototype, 'sendEventData');

    const r = flushFilePath(originalPath);
    expect(r).toEqual(alteredPath);
    expect(teleSpy).not.toHaveBeenCalled();
  });
});
