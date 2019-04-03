/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { assert, match, SinonStub, stub } from 'sinon';
import { window } from 'vscode';
import { SfdxCoreSettings } from '../../../src/settings/sfdxCoreSettings';
import { TelemetryService } from '../../../src/telemetry/telemetry';
import TelemetryReporter from '../../../src/telemetry/telemetryReporter';
import { MockContext } from './MockContext';

describe('Telemetry', () => {
  const machineId = '45678903';
  let mShowInformation: SinonStub;
  let settings: SinonStub;
  let mockContext: MockContext;
  let reporter: SinonStub;

  describe('in dev mode', () => {
    beforeEach(() => {
      mShowInformation = stub(window, 'showInformationMessage').returns(
        Promise.resolve(null)
      );
      settings = stub(
        SfdxCoreSettings.prototype,
        'getTelemetryEnabled'
      ).returns(true);
    });

    afterEach(() => {
      mShowInformation.restore();
      settings.restore();
    });

    it('Should not initialize telemetry reporter', async () => {
      // create vscode extensionContext
      mockContext = new MockContext(true);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, 'someValue.machineId');

      const telemetryReporter = telemetryService.getReporter();
      expect(typeof telemetryReporter).to.be.eql('undefined');
    });

    it('Should show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has never been previously shown
      mockContext = new MockContext(false);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, 'someValue.machineId');

      const telemetryEnabled = telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).to.be.eql(true);

      telemetryService.showTelemetryMessage();
      assert.calledOnce(mShowInformation);
    });

    it('Should not show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has been previously shown
      mockContext = new MockContext(true);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, 'someValue.machineId');

      const telemetryEnabled = telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).to.be.eql(true);

      telemetryService.showTelemetryMessage();
      assert.notCalled(mShowInformation);
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      mShowInformation = stub(window, 'showInformationMessage').returns(
        Promise.resolve(null)
      );
      settings = stub(
        SfdxCoreSettings.prototype,
        'getTelemetryEnabled'
      ).returns(true);
      reporter = stub(TelemetryReporter.prototype, 'sendTelemetryEvent');
    });

    afterEach(() => {
      mShowInformation.restore();
      settings.restore();
      reporter.restore();
    });

    it('Should show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has never been previously shown
      mockContext = new MockContext(false);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, machineId);

      const telemetryEnabled = telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).to.be.eql(true);

      telemetryService.showTelemetryMessage();
      assert.calledOnce(mShowInformation);
    });

    it('Should not show telemetry info message', async () => {
      // create vscode extensionContext in which telemetry msg has been previously shown
      mockContext = new MockContext(true);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, machineId);

      const telemetryEnabled = telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).to.be.eql(true);

      telemetryService.showTelemetryMessage();
      assert.notCalled(mShowInformation);
    });

    it('Should send telemetry data', async () => {
      // create vscode extensionContext in which telemetry msg has been previously shown
      mockContext = new MockContext(true);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, machineId);

      telemetryService.sendExtensionActivationEvent([0, 678]);
      assert.calledOnce(reporter);
    });

    it('Should not send telemetry data', async () => {
      // create vscode extensionContext
      mockContext = new MockContext(true);
      // user has updated settings for not sending telemetry data.
      settings.restore();
      settings = stub(
        SfdxCoreSettings.prototype,
        'getTelemetryEnabled'
      ).returns(false);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, machineId);

      const telemetryEnabled = telemetryService.isTelemetryEnabled();
      expect(telemetryEnabled).to.be.eql(false);

      telemetryService.sendCommandEvent('create_apex_class_command', [0, 678]);
      assert.notCalled(reporter);
    });

    it('Should send correct data format on sendExtensionActivationEvent', async () => {
      // create vscode extensionContext
      mockContext = new MockContext(true);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, machineId);

      telemetryService.sendExtensionActivationEvent([0, 678]);
      assert.calledOnce(reporter);

      const expectedData = {
        extensionName: 'salesforcedx-vscode-core',
        startupTime: match.string
      };
      assert.calledWith(reporter, 'activationEvent', match(expectedData));
    });

    it('Should send correct data format on sendExtensionDeactivationEvent', async () => {
      // create vscode extensionContext
      mockContext = new MockContext(true);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, machineId);

      telemetryService.sendExtensionDeactivationEvent();
      assert.calledOnce(reporter);

      const expectedData = {
        extensionName: 'salesforcedx-vscode-core'
      };
      assert.calledWith(reporter, 'deactivationEvent', expectedData);
    });

    it('Should send correct data format on sendCommandEvent', async () => {
      // create vscode extensionContext
      mockContext = new MockContext(true);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, machineId);

      telemetryService.sendCommandEvent('create_apex_class_command', [0, 678]);
      assert.calledOnce(reporter);

      const expectedData = {
        extensionName: 'salesforcedx-vscode-core',
        commandName: 'create_apex_class_command',
        executionTime: match.string
      };
      assert.calledWith(reporter, 'commandExecution', match(expectedData));
    });

    it('Should send correct data format on sendCommandEvent with additionalData', async () => {
      // create vscode extensionContext
      mockContext = new MockContext(true);

      const telemetryService = TelemetryService.getInstance();
      telemetryService.initializeService(mockContext, machineId);
      const additionalData = {
        dirType: 'testDirectoryType',
        secondParam: 'value'
      };

      telemetryService.sendCommandEvent(
        'create_apex_class_command',
        [0, 678],
        additionalData
      );
      assert.calledOnce(reporter);

      const expectedData = {
        extensionName: 'salesforcedx-vscode-core',
        commandName: 'create_apex_class_command',
        executionTime: match.string,
        dirType: 'testDirectoryType',
        secondParam: 'value'
      };
      assert.calledWith(reporter, 'commandExecution', match(expectedData));
    });
  });
});
