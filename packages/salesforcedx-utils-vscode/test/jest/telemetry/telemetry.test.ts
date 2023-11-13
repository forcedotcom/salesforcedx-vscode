/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryProvider, TelemetryService } from '../../../src';
import {
  SFDX_CORE_EXTENSION_NAME,
  SFDX_E4D_EXTENSION_NAME
} from '../../../src/constants';

describe('Telemetry', () => {
  describe('Telemetry Provider', () => {
    afterEach(() => {
      // Clear instances after each test to avoid state leakage.
      TelemetryProvider.instances.clear();
    });
    it('getInstance should return a TelemetryService instance for core extension when no name is provided', () => {
      const instance = TelemetryProvider.getInstance();
      expect(instance).toBeInstanceOf(TelemetryService);
      expect(
        TelemetryProvider.instances.has(SFDX_CORE_EXTENSION_NAME)
      ).toBeTruthy();
    });

    it('getInstance should return the same TelemetryService instance for core extension on subsequent calls', () => {
      const firstInstance = TelemetryProvider.getInstance();
      const secondInstance = TelemetryProvider.getInstance();
      expect(secondInstance).toBe(firstInstance);
    });

    it('getInstance should return a TelemetryService instance for a named extension', () => {
      const extensionName = 'someExtension';
      const instance = TelemetryProvider.getInstance(extensionName);
      expect(instance).toBeInstanceOf(TelemetryService);
      expect(TelemetryProvider.instances.has(extensionName)).toBeTruthy();
    });

    it('getInstance should return the same TelemetryService instance for a named extension on subsequent calls', () => {
      const extensionName = 'someExtension';
      const firstInstance = TelemetryProvider.getInstance(extensionName);
      const secondInstance = TelemetryProvider.getInstance(extensionName);
      expect(secondInstance).toBe(firstInstance);
    });

    it('getInstance should return different instances for different extension names', () => {
      const firstExtensionName = 'extensionOne';
      const secondExtensionName = 'extensionTwo';
      const firstInstance = TelemetryProvider.getInstance(firstExtensionName);
      const secondInstance = TelemetryProvider.getInstance(secondExtensionName);
      expect(firstInstance).not.toBe(secondInstance);
    });
  });

  describe('Telemetry Service', () => {
    it('getInstance should return the e4d instance for compatibility', () => {
      const firstInstance = TelemetryService.getInstance();
      const secondInstance = TelemetryProvider.getInstance(
        SFDX_E4D_EXTENSION_NAME
      );
      expect(firstInstance).toBe(secondInstance);
    });
  });
});
