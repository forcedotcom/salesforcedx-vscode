/*
 * Copyright (c) 2019, salesforce.com, inc.
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
  let sendExceptionEvent: SinonStub;
  let processHrtimeStub: SinonStub;
  const mockDuration = [100, 100];

  beforeEach(() => {
    reporter = new TelemetryReporter(
      'salesforcedx-vscode-lightning',
      'v1',
      'test87349-0'
    );
    sendEvent = stub(reporter, 'sendTelemetryEvent');
    // @ts-ignore
    reporter.sendExceptionEvent = () => {};
    // @ts-ignore
    sendExceptionEvent = stub(reporter, 'sendExceptionEvent');
    processHrtimeStub = stub(process, 'hrtime');
    processHrtimeStub.returns(mockDuration);
  });

  afterEach(async () => {
    sendEvent.restore();
    sendExceptionEvent.restore();
    processHrtimeStub.restore();
    await reporter.dispose();
  });

  it('Should send telemetry data', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    await telemetryService.sendExtensionActivationEvent([0, 600]);
    assert.calledOnce(sendEvent);
  });

  it('Should not send telemetry data', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, false);

    await telemetryService.sendExtensionActivationEvent([0, 700]);
    assert.notCalled(sendEvent);
  });

  it('Should send correct data format on sendExtensionActivationEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    await telemetryService.sendExtensionActivationEvent([0, 800]);
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-lightning',
      startupTime: match.string
    };
    assert.calledWith(sendEvent, 'activationEvent', match(expectedData));
  });

  it('Should send correct data format on sendExtensionDeactivationEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    await telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-lightning'
    };
    assert.calledWith(sendEvent, 'deactivationEvent', expectedData);
  });

  it('Should send correct data format on sendCommandEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    const mockCommandLogName = 'force_lightning_mock_command';
    const mockCommandHrstart: [number, number] = [100, 200];
    const mockAdditionalData = { mockKey: 'mockValue' };
    const mockCommandDuration = [300, 400];
    processHrtimeStub.returns(mockCommandDuration);
    await telemetryService.sendCommandEvent(
      mockCommandLogName,
      mockCommandHrstart,
      mockAdditionalData
    );
    assert.calledOnce(sendEvent);

    const expectedExecutionTime = '3000.0004';
    const expectedData = {
      extensionName: 'salesforcedx-vscode-lightning',
      commandName: mockCommandLogName,
      executionTime: expectedExecutionTime,
      mockKey: 'mockValue'
    };
    assert.calledWith(sendEvent, 'commandExecution', match(expectedData));
  });

  it('Should send correct data format on sendException', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    const mockExceptionLogName = 'force_lightning_mock_exception';
    const mockErrorMessage = 'mockError';
    await telemetryService.sendException(
      mockExceptionLogName,
      mockErrorMessage
    );
    assert.calledOnce(sendExceptionEvent);
    assert.calledWith(
      sendExceptionEvent,
      mockExceptionLogName,
      mockErrorMessage
    );
  });
});
