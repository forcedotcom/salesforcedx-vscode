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
    reporter = new TelemetryReporter(
      'salesforcedx-vscode',
      'v1',
      'test87349-0'
    );
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

    telemetryService.sendExtensionActivationEvent();
    assert.notCalled(sendEvent);
  });

  it('Should send correct data format on sendExtensionActivationEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionActivationEvent();
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-lightning'
    };
    assert.calledWith(sendEvent, 'activationEvent', expectedData);
  });

  it('Should send correct data format on sendExtensionDeactivationEvent', async () => {
    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(reporter, true);

    telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(sendEvent);

    const expectedData = {
      extensionName: 'salesforcedx-vscode-lightning'
    };
    assert.calledWith(sendEvent, 'deactivationEvent', expectedData);
  });
});
