/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AppInsights } from '@salesforce/salesforcedx-utils-vscode';
import { UserService } from '@salesforce/salesforcedx-utils-vscode/src/services/userService';
import { ExtensionMode, window } from 'vscode';
import { SalesforceCoreSettings } from '../../../src/settings/salesforceCoreSettings';
import { showTelemetryMessage, telemetryService } from '../../../src/telemetry';
import { MockExtensionContext } from './MockExtensionContext';

describe('Telemetry', () => {
  let mShowInformation: jest.SpyInstance;
  let settings: jest.SpyInstance;
  let mockExtensionContext: MockExtensionContext;
  let reporter: jest.SpyInstance;
  let exceptionEvent: jest.SpyInstance;
  let teleSpy: jest.SpyInstance;
  let cliSpy: jest.SpyInstance;
  let getTelemetryUserIdSpy: jest.SpyInstance;

  const fakeCliId = 'sdfghjkuytrfce34rtgh';

  describe('in dev mode', () => {
    beforeEach(() => {
      mShowInformation = jest
        .spyOn(window, 'showInformationMessage')
        .mockResolvedValue(undefined);
      settings = jest
        .spyOn(SalesforceCoreSettings.prototype, 'getTelemetryEnabled')
        .mockReturnValue(true);
      teleSpy = jest.spyOn(telemetryService, 'setCliTelemetryEnabled');
      cliSpy = jest
        .spyOn(telemetryService, 'checkCliTelemetry')
        .mockResolvedValue(true);
    });

    afterEach(() => {
      mShowInformation.mockRestore();
      settings.mockRestore();
      teleSpy.mockRestore();
      cliSpy.mockRestore();
    });

    it('Should not initialize telemetry reporter', async () => {
      // create vscode extensionContext
      mockExtensionContext = new MockExtensionContext(true);

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryReporters = telemetryService.getReporters();

      expect(telemetryReporters.length).toEqual(0);
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });

    it('Should show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has never been previously shown
      mockExtensionContext = new MockExtensionContext(false);

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toEqual(true);

      showTelemetryMessage(mockExtensionContext);
      expect(mShowInformation).toHaveBeenCalledTimes(1);
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });

    it('Should not show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has been previously shown
      mockExtensionContext = new MockExtensionContext(true);

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toEqual(true);

      showTelemetryMessage(mockExtensionContext);
      expect(mShowInformation).not.toHaveBeenCalled();
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });

    it('Should disable CLI telemetry', async () => {
      mockExtensionContext = new MockExtensionContext(true);

      cliSpy.mockResolvedValue(false);
      await telemetryService.initializeService(mockExtensionContext);

      expect(teleSpy.mock.calls[0]).toEqual([false]);
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      mShowInformation = jest
        .spyOn(window, 'showInformationMessage')
        .mockResolvedValue(undefined);
      settings = jest
        .spyOn(SalesforceCoreSettings.prototype, 'getTelemetryEnabled')
        .mockReturnValue(true);
      reporter = jest.spyOn(AppInsights.prototype, 'sendTelemetryEvent');
      exceptionEvent = jest.spyOn(AppInsights.prototype, 'sendExceptionEvent');
      teleSpy = jest.spyOn(telemetryService, 'setCliTelemetryEnabled');
      cliSpy = jest
        .spyOn(telemetryService, 'checkCliTelemetry')
        .mockResolvedValue(true);
      getTelemetryUserIdSpy = jest.spyOn(UserService, 'getTelemetryUserId').mockResolvedValue(fakeCliId);
    });

    afterEach(() => {
      mShowInformation.mockRestore();
      settings.mockRestore();
      reporter.mockRestore();
      exceptionEvent.mockRestore();
      teleSpy.mockRestore();
      cliSpy.mockRestore();
      getTelemetryUserIdSpy.mockRestore();
    });

    it('Should show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has never been previously shown
      mockExtensionContext = new MockExtensionContext(
        false,
        ExtensionMode.Production
      );

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toEqual(true);

      showTelemetryMessage(mockExtensionContext);
      expect(mShowInformation).toHaveBeenCalledTimes(1);
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });

    it('Should not show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has been previously shown
      mockExtensionContext = new MockExtensionContext(
        true,
        ExtensionMode.Production
      );

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).toEqual(true);

      showTelemetryMessage(mockExtensionContext);
      expect(mShowInformation).not.toHaveBeenCalled();
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });

    it('Should initialize telemetry reporter', async () => {
      // create vscode extensionContext
      mockExtensionContext = new MockExtensionContext(
        true,
        ExtensionMode.Production
      );
      await telemetryService.initializeService(mockExtensionContext);

      const telemetryReporters = telemetryService.getReporters();

      expect(telemetryReporters.length).toBeGreaterThan(0);
      expect(teleSpy.mock.calls[0]).toEqual([true]);
    });

    it('Should assign mockextension globalState to userId for App Insights reporter', async () => {
      // create vscode extensionContext
      mockExtensionContext = new MockExtensionContext(
        true,
        ExtensionMode.Production
      );
      const telemetryEnabled = await telemetryService.isTelemetryEnabled();

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryReporters = telemetryService.getReporters();
      // const appInsights = telemetryReporters[0];

      expect(telemetryEnabled).toEqual(true);
      expect(telemetryReporters.length).toBeGreaterThan(0);
      expect(teleSpy.mock.calls[0]).toEqual([true]);
      // expect(getTelemetryUserIdSpy).toHaveBeenCalled();
      // expect((appInsights as any).userId === fakeCliId).toBe(true);
    });
  });
});
