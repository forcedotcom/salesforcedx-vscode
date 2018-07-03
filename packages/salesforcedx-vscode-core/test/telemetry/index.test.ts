import { expect } from 'chai';
import * as path from 'path';
import { assert, SinonStub, stub } from 'sinon';
import { ExtensionContext, Memento, window } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { SfdxCoreSettings } from '../../src/settings/sfdxCoreSettings';
import { TelemetryService } from '../../src/telemetry/telemetry';

class MockMemento implements Memento {
  private telemetryGS: boolean;

  constructor(setGlobalState: boolean) {
    this.telemetryGS = setGlobalState;
  }

  public get(key: string): any {
    if (this.telemetryGS === true) {
      return true;
    }
    return undefined;
  }

  public update(key: string, value: any): Promise<void> {
    return Promise.resolve();
  }
}

class MockContext implements ExtensionContext {
  constructor(mm: boolean) {
    this.globalState = new MockMemento(mm);
  }
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
  let mShowInformation: SinonStub;
  let settings: SinonStub;
  let mockContext: MockContext;
  let reporter: SinonStub;

  beforeEach(() => {
    mShowInformation = stub(window, 'showInformationMessage').returns(
      Promise.resolve(null)
    );
    settings = stub(SfdxCoreSettings.prototype, 'getTelemetryEnabled').returns(
      true
    );
    reporter = stub(TelemetryReporter.prototype, 'sendTelemetryEvent').returns(
      Promise.resolve(null)
    );
  });

  afterEach(() => {
    mShowInformation.restore();
    settings.restore();
    reporter.restore();
  });

  it('Should show telemetry info message', async () => {
    // create vscode extensionContext in which telemetry msg has never been previously shown
    mockContext = new MockContext(false);

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext);

    const telemetryEnabled = telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(true);

    telemetryService.showTelemetryMessage();
    assert.calledOnce(mShowInformation);
  });

  it('Should not show telemetry info message', async () => {
    // create vscode extensionContext in which telemetry msg has been previously shown
    mockContext = new MockContext(true);

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext);

    const telemetryEnabled = telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(true);

    telemetryService.showTelemetryMessage();
    assert.notCalled(mShowInformation);
  });

  it('reporter is sending event data', async () => {
    // create vscode extensionContext in which telemetry msg has been previously shown
    mockContext = new MockContext(true);

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext);

    telemetryService.sendExtensionActivationEvent();
    assert.calledOnce(reporter);
  });

  it('reporter should not send data', async () => {
    // create vscode extensionContext
    mockContext = new MockContext(true);
    // user has updated settings for not sending telemetry data.
    settings.restore();
    settings = stub(SfdxCoreSettings.prototype, 'getTelemetryEnabled').returns(
      false
    );

    const telemetryService = TelemetryService.getInstance();
    telemetryService.initializeService(mockContext);

    const telemetryEnabled = telemetryService.isTelemetryEnabled();
    expect(telemetryEnabled).to.be.eql(false);

    telemetryService.sendCommandEvent('create_apex_class_command');
    assert.notCalled(reporter);
  });
});
