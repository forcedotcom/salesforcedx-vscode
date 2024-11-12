/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AppInsights, TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import {
  ActivationInfo,
  Measurements,
  Properties,
  TelemetryData,
  TelemetryReporter,
  TelemetryServiceInterface
} from '@salesforce/vscode-service-provider';
import { expect } from 'chai';
import { assert, SinonStub, stub } from 'sinon';
import { ExtensionContext, ExtensionMode, window } from 'vscode';
import { SalesforceCoreSettings } from '../../../src/settings/salesforceCoreSettings';
import { showTelemetryMessage, telemetryService } from '../../../src/telemetry';
import { MockExtensionContext } from './MockExtensionContext';

class MockTelemetryService extends TelemetryService implements TelemetryServiceInterface {
  public initializeService(extensionContext: ExtensionContext): Promise<void> {
    return Promise.resolve();
  }
  public initializeServiceWithAttributes(
    name: string,
    apiKey?: string,
    version?: string,
    extensionMode?: ExtensionMode
  ): Promise<void> {
    return Promise.resolve();
  }
  public getReporters(): TelemetryReporter[] {
    return [];
  }
  public isTelemetryEnabled(): Promise<boolean> {
    return Promise.resolve(true);
  }
  public checkCliTelemetry(): Promise<boolean> {
    return Promise.resolve(true);
  }
  public isTelemetryExtensionConfigurationEnabled(): boolean {
    return true;
  }
  public setCliTelemetryEnabled(isEnabled: boolean): void {
    // No-op implementation
  }
  public sendActivationEventInfo(activationInfo: ActivationInfo): void {
    // No-op implementation
  }
  public sendExtensionActivationEvent(
    hrstart: [number, number],
    markEndTime?: number,
    telemetryData?: TelemetryData
  ): void {
    // No-op implementation
  }
  public sendExtensionDeactivationEvent(): void {
    // No-op implementation
  }
  public sendCommandEvent(
    commandName?: string,
    hrstart?: [number, number],
    properties?: Properties,
    measurements?: Measurements
  ): void {
    // No-op implementation
  }
  public sendException(name: string, message: string): void {
    // No-op implementation
  }
  public sendEventData(
    eventName: string,
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ): void {
    // No-op implementation
  }
  public dispose(): void {
    // No-op implementation
  }
}

// Mock the ServiceProvider module
jest.mock('@salesforce/vscode-service-provider', () => ({
  ServiceProvider: {
    getService: () => new MockTelemetryService()
  },
  ServiceType: {
    Telemetry: 'Telemetry'
  }
}));

describe('Telemetry', () => {
  const machineId = '45678903';
  let mShowInformation: SinonStub;
  let settings: SinonStub;
  let mockExtensionContext: MockExtensionContext;
  let reporter: SinonStub;
  let exceptionEvent: SinonStub;
  let teleStub: SinonStub;
  let cliStub: SinonStub;

  describe('in dev mode', () => {
    beforeEach(() => {
      mShowInformation = stub(window, 'showInformationMessage').returns(Promise.resolve(null));
      settings = stub(SalesforceCoreSettings.prototype, 'getTelemetryEnabled').returns(true);
      teleStub = stub(telemetryService, 'setCliTelemetryEnabled');
      cliStub = stub(telemetryService, 'checkCliTelemetry');
      cliStub.returns(Promise.resolve(true));
    });

    afterEach(() => {
      mShowInformation.restore();
      settings.restore();
      teleStub.restore();
      cliStub.restore();
    });

    it('Should not initialize telemetry reporter', async () => {
      // create vscode extensionContext
      mockExtensionContext = new MockExtensionContext(true);

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryReporter = telemetryService.getReporters();

      expect(typeof telemetryReporter).to.eql('undefined');
      expect(teleStub.firstCall.args).to.eql([true]);
    });

    it('Should show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has never been previously shown
      mockExtensionContext = new MockExtensionContext(false);

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).to.be.eql(true);

      await showTelemetryMessage(mockExtensionContext);
      assert.calledOnce(mShowInformation);
      expect(teleStub.firstCall.args).to.eql([true]);
    });

    it('Should not show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has been previously shown
      mockExtensionContext = new MockExtensionContext(true);

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).to.be.eql(true);

      await showTelemetryMessage(mockExtensionContext);
      assert.notCalled(mShowInformation);
      expect(teleStub.firstCall.args).to.eql([true]);
    });

    it('Should disable CLI telemetry', async () => {
      mockExtensionContext = new MockExtensionContext(true);

      cliStub.returns(Promise.resolve(false));
      await telemetryService.initializeService(mockExtensionContext);

      expect(teleStub.firstCall.args).to.eql([false]);
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      mShowInformation = stub(window, 'showInformationMessage').returns(Promise.resolve(null));
      settings = stub(SalesforceCoreSettings.prototype, 'getTelemetryEnabled').returns(true);
      reporter = stub(AppInsights.prototype, 'sendTelemetryEvent');
      exceptionEvent = stub(AppInsights.prototype, 'sendExceptionEvent');
      teleStub = stub(telemetryService, 'setCliTelemetryEnabled');
      cliStub = stub(telemetryService, 'checkCliTelemetry');
      cliStub.returns(Promise.resolve(true));
    });

    afterEach(() => {
      mShowInformation.restore();
      settings.restore();
      reporter.restore();
      exceptionEvent.restore();
      teleStub.restore();
      cliStub.restore();
    });

    it('Should show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has never been previously shown
      mockExtensionContext = new MockExtensionContext(false);

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).to.be.eql(true);

      await showTelemetryMessage(mockExtensionContext);
      assert.calledOnce(mShowInformation);
      expect(teleStub.firstCall.args).to.eql([true]);
    });

    it('Should not show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has been previously shown
      mockExtensionContext = new MockExtensionContext(true);

      await telemetryService.initializeService(mockExtensionContext);

      const telemetryEnabled = await telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).to.be.eql(true);

      await showTelemetryMessage(mockExtensionContext);
      assert.notCalled(mShowInformation);
      expect(teleStub.firstCall.args).to.eql([true]);
    });
  });
});
