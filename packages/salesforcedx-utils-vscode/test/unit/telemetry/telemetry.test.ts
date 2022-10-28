/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  assert,
  createSandbox,
  match,
  SinonSandbox,
  SinonStub,
  stub
} from 'sinon';
import {
  TelemetryBuilder,
  TelemetryReporter,
  TelemetryService
} from '../../../src';
import * as cliConfiguration from '../../../src/telemetry/cliConfiguration';
import { MockExtensionContext } from './MockExtensionContext';

const mShowInformation = stub();
mShowInformation.returns(Promise.resolve());

// TODO: W-8781071 Resolve issues with unit testing the service and re-enable these tests
describe('Telemetry production mode', () => {
  const extensionName = 'salesforcedx-test';
  let telemetryService: any;
  let telemetryBuilder: any;
  let sb: SinonSandbox;
  let mockExtensionContext: MockExtensionContext;
  let teleStub: SinonStub;
  let cliStub: SinonStub;
  let vscodeFlagStub: SinonStub;
  let reporter: SinonStub;
  let exceptionEvent: SinonStub;
  let sendTelemetryEventSpy: any;

  beforeEach(() => {
    sb = createSandbox();
    exceptionEvent = sb.stub();
    reporter = sb.stub();
    sendTelemetryEventSpy = jest.spyOn(
      TelemetryReporter.prototype,
      'sendTelemetryEvent'
    );
    jest.spyOn(TelemetryReporter.prototype, 'sendExceptionEvent');
    jest.spyOn(TelemetryReporter.prototype, 'dispose');

    jest.spyOn(cliConfiguration, 'disableCLITelemetry');
    jest
      .spyOn(cliConfiguration, 'isCLITelemetryAllowed')
      .mockResolvedValue(true);

    telemetryService = TelemetryService.getInstance();
    telemetryBuilder = new TelemetryBuilder();
    teleStub = sb.stub(telemetryService, 'setCliTelemetryEnabled');
    vscodeFlagStub = sb.stub(
      telemetryService,
      'isTelemetryExtensionConfigurationEnabled'
    );
    cliStub = sb.stub(telemetryService, 'checkCliTelemetry');
    // create vscode extensionContext
    mockExtensionContext = new MockExtensionContext(true);
    cliStub.returns(Promise.resolve(true));
    vscodeFlagStub.returns(true);
  });

  afterEach(() => {
    sb.restore();
  });

  xit('Should send telemetry data', async () => {
    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );

    telemetryService.sendExtensionActivationEvent([0, 678]);
    assert.calledOnce(sendTelemetryEventSpy);
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('Should not send telemetry data', async () => {
    cliStub.returns(Promise.resolve(false));
    vscodeFlagStub.returns(false);
    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );

    const telemetryEnabled = await telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(false);

    telemetryService.sendCommandEvent('create_apex_class_command', [0, 678]);
    assert.notCalled(reporter);
    expect(teleStub.firstCall.args).to.eql([false]);
  });

  xit('Should send correct data format on sendExtensionActivationEvent', async () => {
    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );

    telemetryService.sendExtensionActivationEvent([0, 678]);
    assert.calledOnce(reporter);

    const expectedProps = {
      extensionName
    };
    const expectedMeasures = match({ startupTime: match.number });
    assert.calledWith(
      reporter,
      'activationEvent',
      expectedProps,
      expectedMeasures
    );
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('Should send correct data format on sendExtensionDeactivationEvent', async () => {
    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );

    telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(reporter);

    const expectedData = {
      extensionName
    };
    assert.calledWith(reporter, 'deactivationEvent', expectedData);
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('Should send correct data format on sendCommandEvent', async () => {
    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );

    telemetryService.sendCommandEvent('create_apex_class_command', [0, 678]);
    assert.calledOnce(reporter);

    const expectedProps = {
      extensionName,
      commandName: 'create_apex_class_command'
    };
    const expectedMeasures = { executionTime: match.number };
    assert.calledWith(
      reporter,
      'commandExecution',
      expectedProps,
      match(expectedMeasures)
    );
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('Should send correct data format on sendCommandEvent with additional props', async () => {
    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );
    const additionalProps = {
      dirType: 'testDirectoryType',
      secondParam: 'value'
    };

    telemetryService.sendCommandEvent(
      'create_apex_class_command',
      [0, 678],
      additionalProps
    );
    assert.calledOnce(reporter);

    const expectedProps = {
      extensionName,
      commandName: 'create_apex_class_command',
      dirType: 'testDirectoryType',
      secondParam: 'value'
    };
    const expectedMeasures = { executionTime: match.number };
    assert.calledWith(
      reporter,
      'commandExecution',
      expectedProps,
      match(expectedMeasures)
    );
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('Should send correct data format on sendCommandEvent with additional measurements', async () => {
    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );
    const additionalMeasures = {
      value: 3,
      count: 10
    };

    telemetryService.sendCommandEvent(
      'create_apex_class_command',
      [0, 678],
      undefined,
      additionalMeasures
    );
    assert.calledOnce(reporter);

    const expectedProps = {
      extensionName,
      commandName: 'create_apex_class_command'
    };
    const expectedMeasures = {
      executionTime: match.number,
      value: 3,
      count: 10
    };
    assert.calledWith(
      reporter,
      'commandExecution',
      expectedProps,
      match(expectedMeasures)
    );
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('should send correct data format on sendEventData', async () => {
    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );

    const eventName = 'eventName';
    const property = { property: 'property for event' };
    const measure = { measure: 123456 };
    telemetryService.sendEventData(eventName, property, measure);

    assert.calledWith(reporter, eventName, property, measure);
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('Should send data sendExceptionEvent', async () => {
    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );

    telemetryService.sendException(
      'error_name',
      'this is a test error message'
    );
    assert.calledOnce(exceptionEvent);

    assert.calledWith(
      exceptionEvent,
      'error_name',
      'this is a test error message'
    );
  });

  xit('Should not send telemetry data when CLI telemetry is disabled', async () => {
    cliStub.returns(Promise.resolve(false));
    vscodeFlagStub.returns(false);
    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );

    const telemetryEnabled = await telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(false);

    telemetryService.sendCommandEvent('create_apex_class_command', [0, 123]);
    assert.notCalled(reporter);
    expect(teleStub.firstCall.args).to.eql([false]);
  });

  xit('Should show telemetry info message', async () => {
    // create vscode extensionContext in which telemetry msg has never been previously shown
    mockExtensionContext = new MockExtensionContext(false);

    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );

    const telemetryEnabled = telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(true);

    telemetryService.showTelemetryMessage();
    assert.calledOnce(mShowInformation);
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('Should not show telemetry info message', async () => {
    // create vscode extensionContext in which telemetry msg has been previously shown
    mockExtensionContext = new MockExtensionContext(true);

    await telemetryService.initializeService(
      mockExtensionContext,
      extensionName
    );

    const telemetryEnabled = telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(true);

    telemetryService.showTelemetryMessage();
    assert.notCalled(mShowInformation);
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  it('should build TelemetryBuilder object with a property set', () => {
    telemetryBuilder.addProperty('test', 'a');

    expect(telemetryBuilder.build()).to.deep.equal(
      Object({
        properties: { test: 'a' },
        measurements: undefined
      })
    );
  });

  it('should build TelemetryBuilder object with a measurement set', () => {
    telemetryBuilder.addMeasurement('test', 10);

    expect(telemetryBuilder.build()).to.deep.equal(
      Object({
        properties: undefined,
        measurements: { test: 10 }
      })
    );
  });

  it('should build TelemetryBuilder object with multiple set', () => {
    telemetryBuilder.addProperty('prop1', 'a');
    telemetryBuilder.addProperty('prop2', 'b');
    telemetryBuilder.addMeasurement('measure1', 1);
    telemetryBuilder.addMeasurement('measure2', 2);

    expect(telemetryBuilder.build()).to.deep.equal(
      Object({
        properties: { prop1: 'a', prop2: 'b' },
        measurements: { measure1: 1, measure2: 2 }
      })
    );
  });
});
