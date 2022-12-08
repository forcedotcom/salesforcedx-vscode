/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import { TelemetryReporter, TelemetryService } from '../../../src';
import * as cliConfiguration from '../../../src/telemetry/cliConfiguration';
import { MockExtensionContext } from './MockExtensionContext';

const mShowInformation = stub();
mShowInformation.returns(Promise.resolve());
jest.mock('../../../src/telemetry/telemetryReporter');
jest.mock('../../../src/telemetry/cliConfiguration');

describe('Telemetry dev mode', () => {
  const extensionName = 'salesforcedx-test';
  let telemetryService: TelemetryService;
  let mockExtensionContext: MockExtensionContext;
  let teleStub: SinonStub;
  let cliStub: SinonStub;

  beforeEach(() => {
    const reporter = stub();
    const exceptionEvent = stub();
    const telemetryReporterStub = class MockReporter {
      public sendTelemetryEvent = reporter;
      public sendExceptionEvent = exceptionEvent;
      public dispose = stub();
    };

    // @ts-ignore
    TelemetryReporter.mockImplementation(() => telemetryReporterStub);
    jest.spyOn(cliConfiguration, 'disableCLITelemetry');
    jest
      .spyOn(cliConfiguration, 'isCLITelemetryAllowed')
      .mockResolvedValue(true);

    telemetryService = TelemetryService.getInstance();
    teleStub = stub(telemetryService, 'setCliTelemetryEnabled');
    cliStub = stub(telemetryService, 'checkCliTelemetry');
    cliStub.returns(Promise.resolve(true));
  });

  afterEach(() => {
    teleStub.restore();
    cliStub.restore();
  });

  it('Should not initialize telemetry reporter', async () => {
    // create vscode extensionContext
    mockExtensionContext = new MockExtensionContext(true);
    jest.spyOn(telemetryService, 'isTelemetryEnabled').mockResolvedValue(false);

    await telemetryService.initializeService(
      mockExtensionContext as any,
      extensionName,
      'fakeAPIKey',
      'fakeVersion'
    );

    const telemetryReporter = telemetryService.getReporter();
    expect(typeof telemetryReporter).to.be.eql('undefined');
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  it('Should disable CLI telemetry', async () => {
    mockExtensionContext = new MockExtensionContext(true);

    cliStub.returns(Promise.resolve(false));
    await telemetryService.initializeService(
      mockExtensionContext as any,
      extensionName,
      'fakeApiKey',
      'fakeVersion'
    );

    expect(teleStub.firstCall.args).to.eql([false]);
  });
});
