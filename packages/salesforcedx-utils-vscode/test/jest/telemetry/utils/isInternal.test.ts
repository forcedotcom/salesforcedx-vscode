/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import { isInternalHost } from '../../../../src/telemetry/utils/isInternal';

describe('Telemetry internal user check', () => {
  let osHostnameSpy: jest.SpyInstance;

  beforeEach(() => {
    osHostnameSpy = jest.spyOn(os, 'hostname');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return true if internal user', () => {
    osHostnameSpy.mockReturnValue('test.internal.salesforce.com');
    expect(isInternalHost()).toBe(true);
  });

  it('should return false if not an internal user', () => {
    osHostnameSpy.mockReturnValue('test.salesforce.com');
    expect(isInternalHost()).toBe(false);
  });

  it('should return false if hostname is undefined', () => {
    osHostnameSpy.mockReturnValue('undefined');
    expect(isInternalHost()).toBe(false);
  });
});
