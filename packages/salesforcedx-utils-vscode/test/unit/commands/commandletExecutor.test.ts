/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { EOL } from 'os';
import * as proxyquire from 'proxyquire';
import { assert, createSandbox, SinonSandbox, SinonStub, stub } from 'sinon';
import { nls } from '../../../src/messages';
import { ContinueResponse } from '../../../src/types';

class MockChannel {
  public readonly name = 'MockChannel';
  public value = '';

  public append(value: string): void {
    this.value += value;
  }

  public appendLine(value: string): void {
    this.value += value;
    this.value += EOL;
  }

  public clear(): void {}
  public show(preserveFocus?: boolean | undefined): void;
  public show(column?: any, preserveFocus?: any): void {}
  public hide(): void {}
  public dispose(): void {}
}

const vscodeStub = {
  CancellationTokenSource: class {
    private listeners: any[] = [];
    public token = {
      isCancellationRequested: false,
      onCancellationRequested: (listener: any) => {
        this.listeners.push(listener);
        return {
          dispose: () => {
            this.listeners = [];
          }
        };
      }
    };
    public cancel = () => {
      this.listeners.forEach(listener => {
        listener.call();
      });
    };
    public dispose = () => {};
  },
  commands: stub(),
  Disposable: stub(),
  env: {
    machineId: '12345534'
  },
  Uri: {
    parse: stub()
  },
  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15
  },
  window: {
    showInformationMessage: () => {
      return Promise.resolve(null);
    },
    showWarningMessage: stub(),
    showErrorMessage: () => {
      return Promise.resolve(null);
    },
    setStatusBarMessage: () => {
      return Promise.resolve(null);
    },
    withProgress: () => {
      return Promise.resolve(true);
    },
    createOutputChannel: () => {
      return {
        show: () => {}
      };
    },
    OutputChannel: { show: () => {} }
  },
  workspace: {
    getConfiguration: () => {
      return {
        get: () => true,
        update: () => true
      };
    },
    onDidChangeConfiguration: stub()
  }
};

const { ChannelService } = proxyquire.noCallThru()(
  '../../../src/commands/index',
  {
    vscode: vscodeStub
  }
);

const { LibraryCommandletExecutor } = proxyquire.noCallThru()(
  '../../../src/index',
  {
    vscode: vscodeStub
  }
);

const { NotificationService } = proxyquire.noCallThru()(
  '../../../src/commands',
  {
    vscode: vscodeStub
  }
);

class TestExecutor extends LibraryCommandletExecutor<{ success: boolean }> {
  constructor(outputChannel: MockChannel, private error?: Error) {
    super('Test Command', 'test_command', new ChannelService(outputChannel));
  }

  public async run(response: ContinueResponse<{ success: boolean }>) {
    if (this.error) {
      throw this.error;
    }
    return response.data.success;
  }
}

describe('LibraryCommandletExecutor', () => {
  const executor = new TestExecutor(new MockChannel());
  let sb: SinonSandbox;

  beforeEach(() => {
    sb = createSandbox();

    sb.stub(NotificationService, 'getInstance');
    sb.stub(NotificationService.prototype, 'showFailedExecution');

    sb.stub(ChannelService, 'getInstance');

    const reporter = stub();
    const exceptionEvent = stub();
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
    const { TelemetryService } = proxyquire.noCallThru()('../../../src/index', {
      vscode: vscodeStub,
      './telemetryReporter': { default: telemetryReporterStub },
      '../cli/cliConfiguration': cliConfigurationStub
    });
    sb.stub(TelemetryService, 'getInstance');
  });

  afterEach(async () => {
    sb.restore();
  });

  it('should show successful execution notification if run returns true', async () => {
    const showInfoStub = sb
      .stub(vscodeStub.window, 'showInformationMessage')
      .resolves(nls.localize('notification_show_in_status_bar_button_text'));
    await executor.execute({ data: { success: true }, type: 'CONTINUE' });
    expect(showInfoStub.called).to.be.true;
  });

  it('should show failed execution notification if run returns false', async () => {
    const showErrStub = sb
      .stub(vscodeStub.window, 'showErrorMessage')
      .resolves(nls.localize('notification_unsuccessful_execution_text'));
    sb.stub(vscodeStub.window, 'withProgress').resolves(false);
    await executor.execute({ data: { success: true }, type: 'CONTINUE' });
    expect(showErrStub.called).to.be.true;
  });

  it('should log command event if there were no issues running', async () => {
    const processstub = sb.spy(process, 'hrtime');
    await executor.execute({ data: { success: false }, type: 'CONTINUE' });
    expect(processstub.called).to.be.true;
  });

  describe('Handling Unexpected Errors', () => {
    const error = new Error('Issues!');
    const errorExecutor = new TestExecutor(new MockChannel(), error);

    it('should show failed execution notification', async () => {
      const showErrStub = sb
        .stub(vscodeStub.window, 'showErrorMessage')
        .resolves(nls.localize('notification_unsuccessful_execution_text'));
      sb.stub(vscodeStub.window, 'withProgress').throws(new Error('Issues!'));

      try {
        await errorExecutor.execute({
          data: { success: false },
          type: 'CONTINUE'
        });
        assert.fail();
      } catch (e) {
        expect(showErrStub.called).to.be.true;
        expect(showErrStub.args[0]).to.eql(['Test Command failed to run']);
      }
    });

    it('should add channel output', async () => {
      sb.stub(vscodeStub.window, 'showErrorMessage');
      sb.stub(vscodeStub.window, 'withProgress').throws(new Error('Issues!'));
      const appendStub = sb.stub(MockChannel.prototype, 'appendLine');

      try {
        await errorExecutor.execute({
          data: { success: false },
          type: 'CONTINUE'
        });
        assert.fail();
      } catch (e) {
        expect(appendStub.called).to.be.true;
        expect(appendStub.args[1]).to.eql(['Issues!']);
      }
    });

    // TODO: W-8781071 Resolve issues with unit testing the telemetry service & add test here
    it('should log exception', async () => {});
  });
});
