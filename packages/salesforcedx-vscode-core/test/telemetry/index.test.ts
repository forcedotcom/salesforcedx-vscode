/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { assert, SinonStub, stub } from 'sinon';
import { window } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { SfdxCoreSettings } from '../../src/settings/sfdxCoreSettings';
import { TelemetryService } from '../../src/telemetry/telemetry';
import { MockContext } from './MockContext';

describe('Telemetry', () => {
  let mShowInformation: SinonStub;
  let settings: SinonStub;
  let mockContext: MockContext;
  let reporter: SinonStub;

  beforeEach(() => {
    mShowInformation = stub(window, 'showInformationMessage').returns(
      Promise.resolve(null)
    );
    settings = stub(SfdxCoreSettings.prototype, 'getTelemetryEnabled').returns(
      true
    );
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
    telemetryService.initializeService(mockContext);

    const telemetryEnabled = telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(true);

    telemetryService.showTelemetryMessage();
    assert.calledOnce(mShowInformation);
  });

  it('Should not show telemetry info message', async () => {
    // create vscode extensionContext in which telemetry msg has been previously shown
    mockContext = new MockContext(true);

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext);

    const telemetryEnabled = telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(true);

    telemetryService.showTelemetryMessage();
    assert.notCalled(mShowInformation);
  });

  it('Should send telemetry data', async () => {
    // create vscode extensionContext in which telemetry msg has been previously shown
    mockContext = new MockContext(true);

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext);

    telemetryService.sendExtensionActivationEvent();
    assert.calledOnce(reporter);
  });

  it('Should not send telemetry data', async () => {
    // create vscode extensionContext
    mockContext = new MockContext(true);
    // user has updated settings for not sending telemetry data.
    settings.restore();
    settings = stub(SfdxCoreSettings.prototype, 'getTelemetryEnabled').returns(
      false
    );

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext);

    const telemetryEnabled = telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(false);

    telemetryService.sendCommandEvent('create_apex_class_command');
    assert.notCalled(reporter);
  });

  it('Should send correct data format on sendExtensionActivationEvent', async () => {
    // create vscode extensionContext
    mockContext = new MockContext(true);

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext);

    telemetryService.sendExtensionActivationEvent();
    assert.calledOnce(reporter);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-core'
    };
    assert.calledWith(reporter, 'activationEvent', expectedData);
  });

  it('Should send correct data format on sendExtensionDeactivationEvent', async () => {
    // create vscode extensionContext
    mockContext = new MockContext(true);

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext);

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
    telemetryService.initializeService(mockContext);

    telemetryService.sendCommandEvent('create_apex_class_command');
    assert.calledOnce(reporter);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-core',
      commandName: 'create_apex_class_command'
    };
    assert.calledWith(reporter, 'commandExecution', expectedData);
  });
});
