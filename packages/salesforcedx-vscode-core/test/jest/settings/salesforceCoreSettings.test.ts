/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ENABLE_SOURCE_TRACKING_FOR_DEPLOY_RETRIEVE } from '../../../src/constants';
import { SalesforceCoreSettings } from '../../../src/settings/salesforceCoreSettings';

describe('salesforceCoreSettings', () => {
  let getConfigValueSpy: jest.SpyInstance;
  beforeEach(() => {
    getConfigValueSpy = jest.spyOn((SalesforceCoreSettings as any).prototype, 'getConfigValue');
  });
  describe('getEnableSourceTrackingForDeployAndRetrieve', () => {
    it('should set the default value for enable source tracking to be true.', () => {
      getConfigValueSpy.mockReturnValue(true);
      const salesforceCoreSettingsInstance = SalesforceCoreSettings.getInstance();
      const defaultValue = salesforceCoreSettingsInstance.getEnableSourceTrackingForDeployAndRetrieve();
      expect(salesforceCoreSettingsInstance).toBeInstanceOf(SalesforceCoreSettings);
      expect(getConfigValueSpy).toHaveBeenCalled();
      expect(getConfigValueSpy).toBeCalledWith(ENABLE_SOURCE_TRACKING_FOR_DEPLOY_RETRIEVE, true);
      expect(defaultValue).toEqual(true);
    });
  });
});
