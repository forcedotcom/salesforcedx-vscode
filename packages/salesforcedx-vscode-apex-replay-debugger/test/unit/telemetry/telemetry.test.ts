/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, SinonStub, stub } from 'sinon';
import TelemetryReporter from 'vscode-extension-telemetry';
import { TelemetryService } from '../../../src/telemetry/telemetry';

describe('Telemetry', () => {
  let reporter: TelemetryReporter;
  let sendEvent: SinonStub;

  beforeEach(() => {
    reporter = new TelemetryReporter('salesforcedx-vscode', 'v1', 'test567890');
    sendEvent = stub(reporter, 'sendTelemetryEvent');
  });

  afterEach(() => {
    sendEvent.restore();
    reporter.dispose();
  });

  it('Should send telemetry data', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionActivationEvent();
    assert.calledOnce(sendEvent);
  });

  it('Should not send telemetry data', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, false);

    telemetryService.sendCommandEvent('create_apex_class_command');
    assert.notCalled(sendEvent);
  });

  it('Check telemetry sendCommandEvent data format', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendCommandEvent('create_apex_class_command');
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger',
      commandName: 'create_apex_class_command'
    };
    assert.calledWith(sendEvent, 'commandExecution', expectedData);
  });

  it('Check telemetry sendExtensionActivationEvent data format', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionActivationEvent();
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger'
    };
    assert.calledWith(sendEvent, 'activationEvent', expectedData);
  });

  it('Check telemetry sendExtensionDeactivationEvent data format', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger'
    };
    assert.calledWith(sendEvent, 'deactivationEvent', expectedData);
  });
});
