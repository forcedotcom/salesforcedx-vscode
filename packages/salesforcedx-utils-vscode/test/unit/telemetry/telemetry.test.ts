/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import {
  assert,
  createSandbox,
  match,
  SinonSandbox,
  SinonStub,
  stub
} from 'sinon';
import { MockContext } from './MockContext';

const mShowInformation = stub();
mShowInformation.returns(Promise.resolve());
const vscodeStub = {
  commands: stub(),
  Disposable: stub(),
  env: {
    machineId: '12345534'
  },
  Uri: {
    parse: stub()
  },
  window: {
    createOutputChannel: () => {
      return {
        show: () => {}
      };
    },
    showInformationMessage: mShowInformation
  },
  workspace: {
    getConfiguration: () => {
      return {
        get: () => true
      };
    },
    onDidChangeConfiguration: stub()
  }
};

describe('Telemetry production mode', () => {
  const extensionName = 'salesforcedx-test';
  let telemetryService: any;
  let telemetryBuilder: any;
  let sb: SinonSandbox;
  let mockContext: MockContext;
  let teleStub: SinonStub;
  let cliStub: SinonStub;
  let vscodeFlagStub: SinonStub;
  let reporter: SinonStub;
  let exceptionEvent: SinonStub;

  beforeEach(() => {
    sb = createSandbox();
    reporter = sb.stub();
    exceptionEvent = sb.stub();
    const telemetryReporterStub = class MockReporter {
      public sendTelemetryEvent = reporter;
      public sendExceptionEvent = exceptionEvent;
      public dispose = stub();
    };

    const cliConfigurationStub = {
      disableCLITelemetry: stub(),
      isCLITelemetryAllowed: () => {
        return Promise.resolve(true);
      }
    };

    const { TelemetryService, TelemetryBuilder } = proxyquire.noCallThru()(
      '../../../src/index',
      {
        vscode: vscodeStub,
        TelemetryReporter: { default: telemetryReporterStub }
        // '../cli/cliConfiguration': cliConfigurationStub
      }
    );
    telemetryService = TelemetryService.getInstance();
    telemetryBuilder = new TelemetryBuilder();
    teleStub = sb.stub(telemetryService, 'setCliTelemetryEnabled');
    vscodeFlagStub = sb.stub(
      telemetryService,
      'isTelemetryExtensionConfigurationEnabled'
    );
    cliStub = sb.stub(telemetryService, 'checkCliTelemetry');
    // create vscode extensionContext
    mockContext = new MockContext(true);
    cliStub.returns(Promise.resolve(true));
    vscodeFlagStub.returns(true);
  });

  afterEach(() => {
    sb.restore();
  });

  xit('Should send telemetry data', async () => {
    await telemetryService.initializeService(mockContext, extensionName);

    await telemetryService.sendExtensionActivationEvent([0, 678]);
    assert.calledOnce(reporter);
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('Should not send telemetry data', async () => {
    cliStub.returns(Promise.resolve(false));
    vscodeFlagStub.returns(false);
    await telemetryService.initializeService(mockContext, extensionName);

    const telemetryEnabled = await telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(false);

    await telemetryService.sendCommandEvent('create_apex_class_command', [
      0,
      678
    ]);
    assert.notCalled(reporter);
    expect(teleStub.firstCall.args).to.eql([false]);
  });

  xit('Should send correct data format on sendExtensionActivationEvent', async () => {
    await telemetryService.initializeService(mockContext, extensionName);

    await telemetryService.sendExtensionActivationEvent([0, 678]);
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
    await telemetryService.initializeService(mockContext, extensionName);

    await telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(reporter);

    const expectedData = {
      extensionName
    };
    assert.calledWith(reporter, 'deactivationEvent', expectedData);
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('Should send correct data format on sendCommandEvent', async () => {
    await telemetryService.initializeService(mockContext, extensionName);

    await telemetryService.sendCommandEvent('create_apex_class_command', [
      0,
      678
    ]);
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
    await telemetryService.initializeService(mockContext, extensionName);
    const additionalProps = {
      dirType: 'testDirectoryType',
      secondParam: 'value'
    };

    await telemetryService.sendCommandEvent(
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
    await telemetryService.initializeService(mockContext, extensionName);
    const additionalMeasures = {
      value: 3,
      count: 10
    };

    await telemetryService.sendCommandEvent(
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
    await telemetryService.initializeService(mockContext, extensionName);

    const eventName = 'eventName';
    const property = { property: 'property for event' };
    const measure = { measure: 123456 };
    await telemetryService.sendEventData(eventName, property, measure);

    assert.calledWith(reporter, eventName, property, measure);
    expect(teleStub.firstCall.args).to.eql([true]);
  });

  xit('Should send data sendExceptionEvent', async () => {
    await telemetryService.initializeService(mockContext, extensionName);

    await telemetryService.sendException(
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
    await telemetryService.initializeService(mockContext, extensionName);

    const telemetryEnabled = await telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(false);

    await telemetryService.sendCommandEvent('create_apex_class_command', [
      0,
      123
    ]);
    assert.notCalled(reporter);
    expect(teleStub.firstCall.args).to.eql([false]);
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
