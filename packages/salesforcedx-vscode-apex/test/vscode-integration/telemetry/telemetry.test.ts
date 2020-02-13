/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, match, SinonStub, stub } from 'sinon';
import TelemetryReporter from 'vscode-extension-telemetry';
import { TelemetryService } from '../../../src/telemetry/telemetry';

describe('Telemetry', () => {
  let reporter: TelemetryReporter;
  let sendEvent: SinonStub;

  beforeEach(() => {
    reporter = new TelemetryReporter('salesforcedx-vscode', 'v1', 'test567890');
    sendEvent = stub(reporter, 'sendTelemetryEvent');
  });

  afterEach(async () => {
    sendEvent.restore();
    await reporter.dispose();
  });

  it('Should send telemetry data', async () => {
    const telemetryService = new TelemetryService();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionActivationEvent([0, 678]);
    assert.calledOnce(sendEvent);
  });

  it('Should not send telemetry data', async () => {
    const telemetryService = new TelemetryService();
    telemetryService.initializeService(reporter, false);

    telemetryService.sendExtensionActivationEvent([1, 700]);
    assert.notCalled(sendEvent);
  });

  it('Should send correct data format on sendExtensionActivationEvent', async () => {
    const telemetryService = new TelemetryService();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionActivationEvent([1, 700]);
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex',
      startupTime: match.string
    };
    assert.calledWith(sendEvent, 'activationEvent', match(expectedData));
  });

  it('Should send correct data format on sendExtensionDeactivationEvent', async () => {
    const telemetryService = new TelemetryService();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex'
    };
    assert.calledWith(sendEvent, 'deactivationEvent', expectedData);
  });

  it('Should send correct data format on sendApexLSPActivationEvent', async () => {
    const telemetryService = new TelemetryService();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendApexLSPActivationEvent([0, 50]);
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex',
      startupTime: match.string
    };
    assert.calledWith(sendEvent, 'apexLSPStartup', match(expectedData));
  });

  it('Should send correct data format on sendApexLSPError', async () => {
    const telemetryService = new TelemetryService();
    telemetryService.initializeService(reporter, true);
    const errorMsg = 'NullPointerException on Apex LSP';
    telemetryService.sendApexLSPError(errorMsg);
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex',
      errorMsg
    };
    assert.calledWith(sendEvent, 'apexLSPError', expectedData);
  });

  it('Should send correct data format on sendErrorEvent with additionalData', async () => {
    const telemetryService = new TelemetryService();
    telemetryService.initializeService(reporter, true);

    const additionalData = {
      cancelled: false,
      standardObjects: 1,
      customObjects: 2,
      commandName: 'sobject_refresh_command',
      executionTime: telemetryService.getEndHRTime([0, 678])
    };

    telemetryService.sendErrorEvent(
      { message: 'sample error', stack: 'sample stack' },
      additionalData
    );
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex',
      errorMessage: 'sample error',
      errorStack: 'sample stack',
      cancelled: false,
      standardObjects: 1,
      customObjects: 2,
      commandName: 'sobject_refresh_command',
      executionTime: match.string
    };
    assert.calledWith(sendEvent, 'error', match(expectedData));
  });
});
