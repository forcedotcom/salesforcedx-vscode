import * as path from 'path';
import { assert, SinonStub, stub } from 'sinon';
import { ExtensionContext, Memento } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { TelemetryService } from '../../../src/telemetry/telemetry';

class MockContext implements ExtensionContext {
  public subscriptions: Array<{ dispose(): any }> = [];
  public workspaceState: Memento;
  public globalState: Memento;
  public extensionPath: string = 'myExtensionPath';
  public asAbsolutePath(relativePath: string): string {
    return path.join('../../../package.json'); // this should point to the src/package.json
  }
  public storagePath: string = 'myStoragePath';
}

describe('Telemetry', () => {
  let mockContext: MockContext;
  let reporter: SinonStub;

  beforeEach(() => {
    reporter = stub(TelemetryReporter.prototype, 'sendTelemetryEvent');
  });

  afterEach(() => {
    reporter.restore();
  });

  it('Should send telemetry data', async () => {
    // create vscode extensionContext in which telemetry msg has been previously shown
    mockContext = new MockContext();

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext, true);

    telemetryService.sendExtensionActivationEvent();
    assert.calledOnce(reporter);
  });

  it('Should not send telemetry data', async () => {
    // create vscode extensionContext
    mockContext = new MockContext();

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext, false);

    telemetryService.sendCommandEvent('create_apex_class_command');
    assert.notCalled(reporter);
  });

  it('Check telemetry sendCommandEvent data format', async () => {
    // create vscode extensionContext
    mockContext = new MockContext();

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext, true);

    telemetryService.sendCommandEvent('create_apex_class_command');
    assert.calledOnce(reporter);

    const expectedData = { commandName: 'create_apex_class_command' };
    assert.calledWith(reporter, 'commandExecution', expectedData);
  });

  it('Check telemetry sendExtensionActivationEvent data format', async () => {
    // create vscode extensionContext
    mockContext = new MockContext();

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext, true);

    telemetryService.sendExtensionActivationEvent();
    assert.calledOnce(reporter);
    assert.calledWith(reporter, 'activationEvent');
  });

  it('Check telemetry sendExtensionDeactivationEvent data format', async () => {
    // create vscode extensionContext
    mockContext = new MockContext();

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext, true);

    telemetryService.sendExtensionDeactivationEvent();
    assert.calledOnce(reporter);
    assert.calledWith(reporter, 'deactivationEvent');
  });
});
