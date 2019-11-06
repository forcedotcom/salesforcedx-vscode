import {
  CliCommandExecutor,
  Command,
  CommandExecution
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import { Subject } from 'rxjs/Subject';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { lwcDevServerBaseUrl } from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import {
  forceLightningLwcStart,
  ForceLightningLwcStartExecutor
} from '../../../src/commands/forceLightningLwcStart';
import { nls } from '../../../src/messages';
import { DevServerService } from '../../../src/service/devServerService';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  taskViewService,
  notificationService,
  SfdxCommandlet
} = sfdxCoreExports;

class FakeExecution implements CommandExecution {
  public command: Command;
  public processExitSubject: Subject<number>;
  public processErrorSubject: Subject<Error>;
  public stdoutSubject: Subject<string>;
  public stderrSubject: Subject<string>;

  constructor(command: Command) {
    this.command = command;
    this.processExitSubject = new Subject<number>();
    this.processErrorSubject = new Subject<Error>();
    this.stdoutSubject = new Subject<string>();
    this.stderrSubject = new Subject<string>();
  }
}

describe('forceLightningLwcStart', () => {
  describe('ForceLightningLwcStartExecutor', () => {
    describe('build', () => {
      it('returns a command with the correct params', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const command = executor.build();
        expect(command.toCommand()).to.equal(`sfdx force:lightning:lwc:start`);
      });

      it('returns a command with the correct description', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const command = executor.build();
        expect(command.description).to.equal(
          nls.localize('force_lightning_lwc_start_text')
        );
      });

      it('returns a command with the correct logName', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const command = executor.build();
        expect(command.logName).to.equal('force_lightning_lwc_start');
      });
    });

    describe('execute', () => {
      let sandbox: SinonSandbox;
      let channelServiceStubs: { [key: string]: SinonStub };
      let taskViewServiceStubs: { [key: string]: SinonStub };
      let notificationServiceStubs: { [key: string]: SinonStub };
      let devServiceStub: any;
      let openBrowserStub: SinonStub;
      let cliCommandExecutorStub: SinonStub;

      beforeEach(() => {
        sandbox = sinon.sandbox.create();

        openBrowserStub = sandbox.stub(commandUtils, 'openBrowser');

        devServiceStub = sinon.createStubInstance(DevServerService);
        sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);

        cliCommandExecutorStub = sandbox.stub(
          CliCommandExecutor.prototype,
          'execute'
        );

        channelServiceStubs = {};
        taskViewServiceStubs = {};
        notificationServiceStubs = {};

        channelServiceStubs.appendLineStub = sandbox.stub(
          channelService,
          'appendLine'
        );
        channelServiceStubs.streamCommandOutputStub = sandbox.stub(
          channelService,
          'streamCommandOutput'
        );
        channelServiceStubs.showChannelOutputStub = sandbox.stub(
          channelService,
          'showChannelOutput'
        );
        taskViewServiceStubs.addCommandExecutionStub = sandbox.stub(
          taskViewService,
          'addCommandExecution'
        );
        taskViewServiceStubs.removeTaskStub = sandbox.stub(
          taskViewService,
          'removeTask'
        );
        notificationServiceStubs.reportExecutionErrorStub = sandbox.stub(
          notificationService,
          'reportExecutionError'
        );
        notificationServiceStubs.showErrorMessageStub = sandbox.stub(
          notificationService,
          'showErrorMessage'
        );
        notificationServiceStubs.showWarningMessageStub = sandbox.stub(
          notificationService,
          'showWarningMessage'
        );
        notificationServiceStubs.showSuccessfulExecutionStub = sandbox.stub(
          notificationService,
          'showSuccessfulExecution'
        );
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('calls execute on the CliCommandExecutor', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });

        sinon.assert.calledOnce(cliCommandExecutorStub);
      });

      it('registers the server with DevServerService', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });

        sinon.assert.calledOnce(devServiceStub.registerServerHandler);
      });

      it('shows the success message once server is started', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('foo');
        fakeExecution.stdoutSubject.next('bar');
        fakeExecution.stdoutSubject.next('Server up');

        sinon.assert.calledOnce(
          notificationServiceStubs.showSuccessfulExecutionStub
        );
      });

      it('opens the browser once server is started', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('Server up');

        sinon.assert.calledOnce(openBrowserStub);
        sinon.assert.calledWith(
          openBrowserStub,
          sinon.match(lwcDevServerBaseUrl)
        );
      });

      it('shows an error when the plugin is not installed', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('foo');
        fakeExecution.processExitSubject.next(127);

        const commandName = nls.localize(`force_lightning_lwc_start_text`);

        sinon.assert.calledOnce(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', commandName))
        );

        sinon.assert.calledOnce(channelServiceStubs.appendLineStub);
        sinon.assert.calledWith(
          channelServiceStubs.appendLineStub,
          sinon.match(nls.localize('force_lightning_lwc_start_not_found'))
        );
      });

      it('shows an error message when the process exists before server startup', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('foo');
        fakeExecution.processExitSubject.next(0);

        const commandName = nls.localize(`force_lightning_lwc_start_text`);

        sinon.assert.calledOnce(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', commandName))
        );

        sinon.assert.calledOnce(channelServiceStubs.appendLineStub);
        sinon.assert.calledWith(
          channelServiceStubs.appendLineStub,
          sinon.match(nls.localize('force_lightning_lwc_start_failed'))
        );
      });
    });
  });

  describe('forceLightningLwcStart function', () => {
    let sandbox: SinonSandbox;
    let showWarningStub: SinonStub;
    let devServiceStub: any;
    let openBrowserStub: SinonStub;
    let commandletStub: SinonStub;

    beforeEach(() => {
      sandbox = sinon.sandbox.create();

      devServiceStub = sinon.createStubInstance(DevServerService);
      sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);

      commandletStub = sandbox.stub(SfdxCommandlet.prototype, 'run');
      openBrowserStub = sandbox.stub(commandUtils, 'openBrowser');
      showWarningStub = sandbox.stub(notificationService, 'showWarningMessage');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('calls run on the commandlet', async () => {
      await forceLightningLwcStart();
      sinon.assert.calledOnce(commandletStub);
    });

    it('shows a warning message when the server is already running', async () => {
      devServiceStub.isServerHandlerRegistered.returns(true);
      showWarningStub.resolves();

      await forceLightningLwcStart();

      sinon.assert.calledOnce(showWarningStub);
      sinon.assert.calledWith(
        showWarningStub,
        nls.localize('force_lightning_lwc_start_already_running')
      );
    });
  });
});
