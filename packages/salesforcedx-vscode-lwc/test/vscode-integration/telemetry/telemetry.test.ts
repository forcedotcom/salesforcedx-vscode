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

  beforeEach(() => {
    reporter = new TelemetryReporter(
      'salesforcedx-vscode-lwc',
      'v1',
      'test345390'
    );
    sendEvent = stub(reporter, 'sendTelemetryEvent');
  });

  afterEach(async () => {
    sendEvent.restore();
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

    const expectedData = {
      extensionName: 'salesforcedx-vscode-lwc',
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
      extensionName: 'salesforcedx-vscode-lwc'
    };
    assert.calledWith(sendEvent, 'deactivationEvent', expectedData);
  });
});
