/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { assert, match, SinonStub, stub, SinonSpy, spy } from 'sinon';
import TelemetryReporter from 'vscode-extension-telemetry';
import { TelemetryService } from '../../../src/telemetry/telemetry';

describe('Telemetry', () => {
  let reporter: TelemetryReporter;
  let sendEvent: SinonStub<
    [
      string,
      ({ [key: string]: string } | undefined)?,
      ({ [key: string]: number } | undefined)?
    ],
    void
  >;
  let sendExceptionEvent: SinonSpy<any[], any>;
  let processHrtimeStub: SinonStub<
    [([number, number] | undefined)?],
    [number, number]
  >;
  const mockDuration: [number, number] = [100, 100];

  beforeEach(() => {
    reporter = new TelemetryReporter(
      'salesforcedx-vscode-lwc',
      'v1',
      'test345390'
    );
    sendEvent = stub(reporter, 'sendTelemetryEvent');
    // @ts-ignore
    reporter.sendExceptionEvent = () => {};
    // @ts-ignore
    sendExceptionEvent = spy(reporter, 'sendExceptionEvent');
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

    await telemetryService.sendExtensionActivationEvent([0, 678]);
    assert.calledOnce(sendEvent);
  });

  it('Should not send telemetry data', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, false);

    await telemetryService.sendExtensionActivationEvent([0, 678]);
    assert.notCalled(sendEvent);
  });

  it('Should send correct data format on sendExtensionActivationEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    await telemetryService.sendExtensionActivationEvent([0, 678]);
    assert.calledOnce(sendEvent);

    const expectedProps = {
      extensionName: 'salesforcedx-vscode-lwc'
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

    await telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-lwc'
    };
    assert.calledWith(sendEvent, 'deactivationEvent', expectedData);
  });

  it('Should send correct data format on sendCommandEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    const mockCommandLogName = 'force_lwc_mock_command';
    const mockCommandHrstart: [number, number] = [100, 200];
    const mockAdditionalData = { mockKey: 'mockValue' };
    const mockCommandDuration: [number, number] = [300, 400];
    processHrtimeStub.returns(mockCommandDuration);
    await telemetryService.sendCommandEvent(
      mockCommandLogName,
      mockCommandHrstart,
      mockAdditionalData
    );
    assert.calledOnce(sendEvent);

    const expectedExecutionTime = 3000.0004;
    const expectedProps = {
      extensionName: 'salesforcedx-vscode-lwc',
      commandName: mockCommandLogName,
      mockKey: 'mockValue'
    };
    const expectedMeasures = {
      executionTime: expectedExecutionTime
    };
    assert.calledWith(
      sendEvent,
      'commandExecution',
      expectedProps,
      expectedMeasures
    );
  });

  it('Should send correct data format on sendException', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    const mockExceptionLogName = 'force_lwc_mock_exception';
    const mockErrorMessage = 'mockError';
    await telemetryService.sendException(
      mockExceptionLogName,
      mockErrorMessage
    );
    assert.calledOnce(sendExceptionEvent);
    assert.calledWith(
      sendExceptionEvent as SinonSpy<any[], any>,
      mockExceptionLogName,
      mockErrorMessage
    );
  });
});
