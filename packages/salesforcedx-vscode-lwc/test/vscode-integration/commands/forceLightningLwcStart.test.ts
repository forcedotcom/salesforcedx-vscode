/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
import { DEV_SERVER_DEFAULT_BASE_URL } from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import {
  errorHints,
  forceLightningLwcStart,
  ForceLightningLwcStartExecutor
} from '../../../src/commands/forceLightningLwcStart';
import { nls } from '../../../src/messages';
import { DevServerService } from '../../../src/service/devServerService';
import { CancellationToken } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/commandExecutor';
import { CliCommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ChannelService } from '@salesforce/salesforcedx-utils-vscode/out/src/channels';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
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
  private readonly childProcessPid: any;

  constructor(command: Command) {
    this.command = command;
    this.processExitSubject = new Subject<number>();
    this.processErrorSubject = new Subject<Error>();
    this.stdoutSubject = new Subject<string>();
    this.stderrSubject = new Subject<string>();
    this.childProcessPid = '';
  }

  public killExecution(signal?: string): Promise<void> {
    return Promise.resolve();
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
      let appendLineStub: SinonStub;
      let taskViewServiceStubs: { [key: string]: SinonStub };
      let notificationServiceStubs: { [key: string]: SinonStub };
      let devServiceStub: any;
      let openBrowserStub: SinonStub<[string], Thenable<boolean>>;
      let cliCommandExecutorStub: SinonStub<
        [(CancellationToken | undefined)?],
        CliCommandExecution | FakeExecution
      >;

      beforeEach(() => {
        sandbox = sinon.createSandbox();

        openBrowserStub = sandbox.stub(commandUtils, 'openBrowser');

        devServiceStub = sinon.createStubInstance(DevServerService);
        sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);

        cliCommandExecutorStub = sandbox.stub(
          CliCommandExecutor.prototype,
          'execute'
        );

        taskViewServiceStubs = {};
        notificationServiceStubs = {};

        appendLineStub = sandbox.stub(
          ChannelService.prototype,
          'appendLine' as any
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
        sinon.assert.notCalled(
          notificationServiceStubs.showSuccessfulExecutionStub
        );

        fakeExecution.stdoutSubject.next('Server up');
        sinon.assert.calledOnce(
          notificationServiceStubs.showSuccessfulExecutionStub
        );
      });

      it('shows the error message if server start up failed', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });

        fakeExecution.stderrSubject.next(errorHints.SERVER_STARTUP_FALIED);
        sinon.assert.notCalled(
          notificationServiceStubs.showSuccessfulExecutionStub
        );

        sinon.assert.calledTwice(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(
            nls.localize(
              'command_failure',
              nls.localize(`force_lightning_lwc_start_text`)
            )
          )
        );

        sinon.assert.calledOnce(appendLineStub);
        sinon.assert.calledWith(
          appendLineStub,
          sinon.match(nls.localize('force_lightning_lwc_start_failed'))
        );
      });

      it('opens the browser once server is started', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);
        devServiceStub.getBaseUrl.returns('http://localhost:3333');

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('Server up on http://localhost:3333');

        sinon.assert.calledWith(
          devServiceStub.setBaseUrlFromDevServerUpMessage,
          sinon.match('Server up on http://localhost:3333')
        );
        sinon.assert.calledOnce(openBrowserStub);
        sinon.assert.calledWith(
          openBrowserStub,
          sinon.match(DEV_SERVER_DEFAULT_BASE_URL)
        );
      });

      it('opens the browser at the correct port once server is started', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);
        devServiceStub.getBaseUrl.returns('http://localhost:3332');

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next(
          'Some details here\n Server up on http://localhost:3332 something\n More details here'
        );

        sinon.assert.calledWith(
          devServiceStub.setBaseUrlFromDevServerUpMessage,
          sinon.match(
            'Some details here\n Server up on http://localhost:3332 something\n More details here'
          )
        );
        sinon.assert.calledOnce(openBrowserStub);
        sinon.assert.calledWith(
          openBrowserStub,
          sinon.match('http://localhost:3332')
        );
      });

      it('opens the browser with default url when Server up message contains no url', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);
        devServiceStub.getBaseUrl.returns(DEV_SERVER_DEFAULT_BASE_URL);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next(
          'Some details here\n Server up on -no valid url here- \n More details here'
        );

        sinon.assert.neverCalledWith(
          devServiceStub.setBaseUrlFromDevServerUpMessage,
          sinon.match('http://localhost:3333')
        );
        sinon.assert.calledOnce(openBrowserStub);
        sinon.assert.calledWith(
          openBrowserStub,
          sinon.match('http://localhost:3333')
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

        sinon.assert.calledTwice(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', commandName))
        );

        sinon.assert.calledOnce(appendLineStub);
        sinon.assert.calledWith(
          appendLineStub,
          sinon.match(nls.localize('force_lightning_lwc_start_not_found'))
        );
      });

      it('shows an error when the address is already in use', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.processExitSubject.next(98);

        const commandName = nls.localize(`force_lightning_lwc_start_text`);

        sinon.assert.calledTwice(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', commandName))
        );

        sinon.assert.calledOnce(appendLineStub);
        sinon.assert.calledWith(
          appendLineStub,
          sinon.match(nls.localize('force_lightning_lwc_start_addr_in_use'))
        );
      });

      it('shows an error when scratch org is inactive', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stderrSubject.next(errorHints.INACTIVE_SCRATCH_ORG);
        fakeExecution.processExitSubject.next(1);

        const commandName = nls.localize(`force_lightning_lwc_start_text`);

        sinon.assert.calledTwice(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', commandName))
        );

        sinon.assert.calledOnce(appendLineStub);
        sinon.assert.calledWith(
          appendLineStub,
          sinon.match(nls.localize('force_lightning_lwc_inactive_scratch_org'))
        );
      });

      it('shows no error when server is stopping', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('Server up');
        fakeExecution.processExitSubject.next(0);

        sinon.assert.notCalled(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.notCalled(appendLineStub);
      });

      it('shows an error message when the process exists before server startup', () => {
        const executor = new ForceLightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('foo');
        fakeExecution.processExitSubject.next(0);

        const commandName = nls.localize(`force_lightning_lwc_start_text`);

        sinon.assert.calledTwice(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', commandName))
        );

        sinon.assert.calledOnce(appendLineStub);
        sinon.assert.calledWith(
          appendLineStub,
          sinon.match(nls.localize('force_lightning_lwc_start_failed'))
        );
      });
    });
  });

  describe('forceLightningLwcStart function', () => {
    let sandbox: SinonSandbox;
    let showWarningStub: SinonStub<any[], any>;
    let devServiceStub: any;
    let commandletStub: SinonStub<any[], any>;

    beforeEach(() => {
      sandbox = sinon.createSandbox();

      devServiceStub = sinon.createStubInstance(DevServerService);
      sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);

      sandbox.stub(commandUtils, 'openBrowser');
      commandletStub = sandbox.stub(SfdxCommandlet.prototype, 'run');
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
