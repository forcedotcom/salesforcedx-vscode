/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, match, SinonStub, stub } from 'sinon';
import TelemetryReporter from 'vscode-extension-telemetry';
import { ReplayDebuggerTelemetryService } from '../../../src/telemetry/telemetry';

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

  it('Should send correct data format on sendExtensionDeactivationEvent', () => {
    const telemetryService = ReplayDebuggerTelemetryService.getInstance();

    telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger'
    };
    assert.calledWith(sendEvent, 'deactivationEvent', expectedData);
  });

  it('Should send launch event', () => {
    const telemetryService = ReplayDebuggerTelemetryService.getInstance();

    telemetryService.sendLaunchEvent('123', 'error message');

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger',
      logSize: '123',
      errorMessage: 'error message'
    };
    assert.calledWith(sendEvent, 'launchDebuggerSession', expectedData);
  });

  it('Should send checkpoint event', () => {
    const telemetryService = ReplayDebuggerTelemetryService.getInstance();

    telemetryService.sendCheckpointEvent('error message');

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger',
      errorMessage: 'error message'
    };
    assert.calledWith(sendEvent, 'updateCheckpoints', expectedData);
  });

  it('Should send error event', () => {
    const telemetryService = ReplayDebuggerTelemetryService.getInstance();

    telemetryService.sendErrorEvent('error message', 'error callstack');

    const expectedData = {
      extensionName: 'salesforcedx-vscode-apex-replay-debugger',
      errorMessage: 'error message',
      errorStack: 'error callstack'
    };
    assert.calledWith(sendEvent, 'error', expectedData);
  });
});
