/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { MetricsReporter } from '../../../src/telemetry/MetricsReporter';

describe('MetricsReporter', () => {
  describe('extensionPackStatus', () => {
    const eventName = 'extensionPackStatus';
    const fakeExtension = {
      extensionUri: { url: 'fake' }
    };
    let telemetrySpy: jest.SpyInstance;
    const extensionsSpy = jest.fn();

    beforeEach(() => {
      vscode.extensions.getExtension = extensionsSpy;
    });

    it('reports NONE if neither base nor expanded packs are installed', () => {
      extensionsSpy.mockReturnValue(undefined);
      telemetrySpy = jest.spyOn(TelemetryService.prototype, 'sendEventData');

      MetricsReporter.extensionPackStatus();

      expect(telemetrySpy).toHaveBeenCalledTimes(1);
      expect(telemetrySpy).toHaveBeenCalledWith(eventName, { extpack: 'NONE' });
    });

    it('reports BASE if only the base pack is installed', () => {
      extensionsSpy.mockReturnValueOnce(fakeExtension);
      extensionsSpy.mockReturnValueOnce(undefined);
      telemetrySpy = jest.spyOn(TelemetryService.prototype, 'sendEventData');

      MetricsReporter.extensionPackStatus();

      expect(telemetrySpy).toHaveBeenCalledTimes(1);
      expect(telemetrySpy).toHaveBeenCalledWith(eventName, { extpack: 'BASE' });
    });

    it('reports EXPANDED if only the expanded pack is installed', () => {
      extensionsSpy.mockReturnValueOnce(undefined);
      extensionsSpy.mockReturnValueOnce(fakeExtension);
      telemetrySpy = jest.spyOn(TelemetryService.prototype, 'sendEventData');

      MetricsReporter.extensionPackStatus();

      expect(telemetrySpy).toHaveBeenCalledTimes(1);
      expect(telemetrySpy).toHaveBeenCalledWith(eventName, { extpack: 'EXPANDED' });
    });

    it('reports BOTH if both the base and expanded packs are installed', () => {
      extensionsSpy.mockReturnValue(fakeExtension);
      telemetrySpy = jest.spyOn(TelemetryService.prototype, 'sendEventData');

      MetricsReporter.extensionPackStatus();

      expect(telemetrySpy).toHaveBeenCalledTimes(1);
      expect(telemetrySpy).toHaveBeenCalledWith(eventName, { extpack: 'BOTH' });
    });
  });
});
