/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { GlobalCliEnvironment } from '../../../src/cli';
import { ConfigUtil } from '../../../src/config/configUtil';
import {
  disableCLITelemetry,
  ENV_SFDX_DISABLE_TELEMETRY,
  isCLITelemetryAllowed
} from '../../../src/telemetry/cliConfiguration';

describe('CliConfiguration Unit Tests.', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('disableCLITelemetry()', () => {
    let setSpy: jest.SpyInstance;
    beforeEach(() => {
      setSpy = jest.fn();
      (GlobalCliEnvironment as any).environmentVariables = {
        set: setSpy
      };
    });

    it('Should set env value.', async () => {
      disableCLITelemetry();
      expect(setSpy).toHaveBeenCalledWith(ENV_SFDX_DISABLE_TELEMETRY, 'true');
    });
  });

  describe('isCLITelemetryAllowed()', () => {
    let isTelemetryDisabledSpy: jest.SpyInstance;

    beforeEach(() => {
      isTelemetryDisabledSpy = jest.spyOn(ConfigUtil, 'isTelemetryDisabled');
    });

    it('Should be true if setting is false.', async () => {
      isTelemetryDisabledSpy.mockResolvedValue(false);
      const isAllowed = await isCLITelemetryAllowed();
      expect(isAllowed).toEqual(true);
      expect(isTelemetryDisabledSpy).toHaveBeenCalledTimes(1);
    });

    it('Should be false if setting is true.', async () => {
      isTelemetryDisabledSpy.mockResolvedValue(true);
      const isAllowed = await isCLITelemetryAllowed();
      expect(isAllowed).toEqual(false);
      expect(isTelemetryDisabledSpy).toHaveBeenCalledTimes(1);
    });

    it('Should return true if config call fails.', async () => {
      isTelemetryDisabledSpy.mockRejectedValue(new Error('no config for you'));
      const isAllowed = await isCLITelemetryAllowed();
      expect(isAllowed).toEqual(true);
      expect(isTelemetryDisabledSpy).toHaveBeenCalledTimes(1);
    });
  });
});
