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
    telemetryService.initializeService([reporter], true);

    telemetryService.sendExtensionActivationEvent([0, 330]);
    assert.calledOnce(sendEvent);
  });

  it('Should not send telemetry data', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService([reporter], false);

    telemetryService.sendLaunchEvent('test', 'test2');
    assert.notCalled(sendEvent);
  });

  it('Should send correct data format on sendExtensionActivationEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService([reporter], true);

    telemetryService.sendExtensionActivationEvent([0, 330]);
    assert.calledOnce(sendEvent);

    const expectedProps = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger'
    };

    const expectedMeasures = {
      startupTime: match.number
    };
    assert.calledWith(sendEvent, 'activationEvent', expectedProps, match(expectedMeasures));
  });

  it('Should send correct data format on sendExtensionDeactivationEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService([reporter], true);

    telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger'
    };
    assert.calledWith(sendEvent, 'deactivationEvent', expectedData);
  });

  it('Should send launch event', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService([reporter], true);

    telemetryService.sendLaunchEvent('123', 'error message');

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger',
      logSize: '123',
      errorMessage: 'error message'
    };
    assert.calledWith(sendEvent, 'launchDebuggerSession', expectedData);
  });

  it('Should send checkpoint event', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService([reporter], true);

    telemetryService.sendCheckpointEvent('error message');

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger',
      errorMessage: 'error message'
    };
    assert.calledWith(sendEvent, 'updateCheckpoints', expectedData);
  });

  it('Should send error event', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService([reporter], true);

    telemetryService.sendErrorEvent('error message', 'error callstack');

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger',
      errorMessage: 'error message',
      errorStack: 'error callstack'
    };
    assert.calledWith(sendEvent, 'error', expectedData);
  });
});
