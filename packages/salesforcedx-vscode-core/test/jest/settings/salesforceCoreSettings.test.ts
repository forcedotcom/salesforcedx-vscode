/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ALL_EXCEPTION_CATCHER_ENABLED } from '../../../src/constants';
import { SalesforceCoreSettings } from '../../../src/settings/salesforceCoreSettings';

describe('salesforceCoreSettings', () => {
  let getConfigValueSpy: jest.SpyInstance;
  beforeEach(() => {
    getConfigValueSpy = jest.spyOn((SalesforceCoreSettings as any).prototype, 'getConfigValue');
  });
  describe('getEnableAllExceptionCatcher', () => {
    it('should set the default value for enable all exception catching to be false.', () => {
      getConfigValueSpy.mockReturnValue(false);
      const salesforceCoreSettingsInstance = SalesforceCoreSettings.getInstance();
      const defaultValue = salesforceCoreSettingsInstance.getEnableAllExceptionCatcher();
      expect(salesforceCoreSettingsInstance).toBeInstanceOf(SalesforceCoreSettings);
      expect(getConfigValueSpy).toHaveBeenCalled();
      expect(getConfigValueSpy).toBeCalledWith(ALL_EXCEPTION_CATCHER_ENABLED, false);
      expect(defaultValue).toEqual(false);
    });
  });
});
