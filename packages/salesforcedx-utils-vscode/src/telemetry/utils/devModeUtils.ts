/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Settings from '../../../src/settings';

export const isLocalLogging = (extName: string) => {
  return Settings.SettingsService.isAdvancedSettingEnabledFor(
    extName,
    Settings.AdvancedSettings.LOCAL_TELEMETRY_LOGGING
  );
};
