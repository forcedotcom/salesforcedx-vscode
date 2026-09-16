/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import { ALL_EXCEPTION_CATCHER_ENABLED, INTERNAL_DEVELOPMENT_FLAG, TELEMETRY_ENABLED } from '../constants';

const getTelemetryEnabled = Effect.fn('SalesforceCoreSettings.getTelemetryEnabled')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [vscodeTelemetryEnabled, salesforceTelemetryEnabled] = yield* Effect.all([
    api.services.SettingsService.getValue('telemetry', 'enableTelemetry', true),
    api.services.SettingsService.getValue(SFDX_CORE_CONFIGURATION_NAME, TELEMETRY_ENABLED, true)
  ]);
  return (vscodeTelemetryEnabled ?? true) && (salesforceTelemetryEnabled ?? true);
});

const getConfigValue = Effect.fn('SalesforceCoreSettings.getConfigValue')(function* <T>(key: string, defaultValue: T) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return (
    (yield* api.services.SettingsService.getValue(SFDX_CORE_CONFIGURATION_NAME, key, defaultValue)) ?? defaultValue
  );
});

/**
 * A centralized location for interacting with sfdx-core settings.
 */
export class SalesforceCoreSettings {
  private static instance: SalesforceCoreSettings;

  public static getInstance() {
    if (!SalesforceCoreSettings.instance) {
      SalesforceCoreSettings.instance = new SalesforceCoreSettings();
    }
    return SalesforceCoreSettings.instance;
  }

  // checks for Microsoft's telemetry setting as well as Salesforce's telemetry setting.
  public getTelemetryEnabled() {
    return getTelemetryEnabled();
  }

  public getEnableAllExceptionCatcher() {
    return this.getConfigValue(ALL_EXCEPTION_CATCHER_ENABLED, false);
  }

  public getInternalDev() {
    return this.getConfigValue(INTERNAL_DEVELOPMENT_FLAG, false);
  }

  private getConfigValue<T>(key: string, defaultValue: T) {
    return getConfigValue(key, defaultValue);
  }
}
