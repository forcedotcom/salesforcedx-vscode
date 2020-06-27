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
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionActivationEvent([0, 678]);
    assert.calledOnce(sendEvent);
  });

  it('Should not send telemetry data', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, false);

    telemetryService.sendExtensionActivationEvent([1, 700]);
    assert.notCalled(sendEvent);
  });

  it('Should send correct data format on sendExtensionActivationEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionActivationEvent([1, 700]);
    assert.calledOnce(sendEvent);

    const expectedProps = {
      extensionName: 'salesforcedx-vscode-apex'
    };
    const expectedMeasures = {
      startupTime: match.number
    };
    assert.calledWith(
      sendEvent,
      'activationEvent',
      expectedProps,
      match(expectedMeasures)
    );
  });

  it('Should send correct data format on sendExtensionDeactivationEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex'
    };
    assert.calledWith(sendEvent, 'deactivationEvent', expectedData);
  });

  it('Should send correct data format on sendApexLSPActivationEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendApexLSPActivationEvent([0, 50]);
    assert.calledOnce(sendEvent);

    const expectedProps = {
      extensionName: 'salesforcedx-vscode-apex'
    };
    const expectedMeasures = {
      startupTime: match.number
    };
    assert.calledWith(
      sendEvent,
      'apexLSPStartup',
      expectedProps,
      match(expectedMeasures)
    );
  });

  it('Should send correct data format on sendApexLSPError', async () => {
    const telemetryService = TelemetryService.getInstance();
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

  it('Should send correct data format on sendErrorEvent with additional properties', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    const properties = {
      cancelled: false,
      commandName: 'sobject_refresh_command'
    };

    telemetryService.sendErrorEvent(
      { message: 'sample error', stack: 'sample stack' },
      properties
    );
    assert.calledOnce(sendEvent);

    const expectedProps = {
      extensionName: 'salesforcedx-vscode-apex',
      errorMessage: 'sample error',
      errorStack: 'sample stack',
      cancelled: false,
      commandName: 'sobject_refresh_command'
    };
    assert.calledWith(sendEvent, 'error', expectedProps);
  });

  it('Should send correct data format on sendErrorEvent with additional measurements', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    const measurements = {
      customObjects: 2,
      standardObjects: 1,
      executionTime: telemetryService.getEndHRTime([0, 678])
    };

    telemetryService.sendErrorEvent(
      { message: 'sample error', stack: 'sample stack' },
      undefined,
      measurements
    );
    assert.calledOnce(sendEvent);

    const expectedProps = {
      errorMessage: 'sample error',
      errorStack: 'sample stack',
      extensionName: 'salesforcedx-vscode-apex'
    };
    const expectedMeasures = {
      customObjects: 2,
      executionTime: match.number,
      standardObjects: 1
    };
    assert.calledWith(
      sendEvent,
      'error',
      expectedProps,
      match(expectedMeasures)
    );
  });
});
