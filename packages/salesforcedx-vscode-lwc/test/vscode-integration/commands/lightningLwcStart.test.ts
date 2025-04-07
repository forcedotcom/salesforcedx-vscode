/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommandlet } from '@salesforce/salesforcedx-utils-vscode';
import { CliCommandExecutor, Command, CommandExecution } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { Subject } from 'rxjs';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { DEV_SERVER_DEFAULT_BASE_URL } from '../../../src/commands/commandConstants';
import * as commandUtils from '../../../src/commands/commandUtils';
import { errorHints, lightningLwcStart, LightningLwcStartExecutor } from '../../../src/commands/lightningLwcStart';
import { nls } from '../../../src/messages';
import { DevServerService } from '../../../src/service/devServerService';
import {
  CancellationToken,
  CliCommandExecution,
  ChannelService,
  notificationService
} from '@salesforce/salesforcedx-utils-vscode';

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

  public killExecution(signal?: string): Promise<void> {
    return Promise.resolve();
  }
}

describe('lightningLwcStart', () => {
  describe('LightningLwcStartExecutor', () => {
    describe('build', () => {
      it('returns a command with the correct params', () => {
        const executor = new LightningLwcStartExecutor();
        const command = executor.build();
        expect(command.toCommand()).to.equal(`sf force:lightning:lwc:start`);
      });

      it('returns a command with the correct description', () => {
        const executor = new LightningLwcStartExecutor();
        const command = executor.build();
        expect(command.description).to.equal(nls.localize('lightning_lwc_start_text'));
      });

      it('returns a command with the correct logName', () => {
        const executor = new LightningLwcStartExecutor();
        const command = executor.build();
        expect(command.logName).to.equal('lightning_lwc_start');
      });
    });

    describe('execute', () => {
      let sandbox: SinonSandbox;
      let appendLineStub: SinonStub;
      let notificationServiceStubs: any;
      let devServiceStub: any;
      let openBrowserStub: SinonStub<[string], Thenable<boolean>>;
      let cliCommandExecutorStub: SinonStub<[(CancellationToken | undefined)?], CliCommandExecution | FakeExecution>;

      beforeEach(() => {
        sandbox = sinon.createSandbox();

        openBrowserStub = sandbox.stub(commandUtils, 'openBrowser');

        devServiceStub = sinon.createStubInstance(DevServerService);
        sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);

        cliCommandExecutorStub = sandbox.stub(CliCommandExecutor.prototype, 'execute');

        notificationServiceStubs = {};

        appendLineStub = sandbox.stub(ChannelService.prototype, 'appendLine' as any);

        notificationServiceStubs.reportExecutionErrorStub = sandbox.stub(notificationService, 'reportExecutionError');
        notificationServiceStubs.showErrorMessageStub = sandbox.stub(notificationService, 'showErrorMessage');
        notificationServiceStubs.showWarningMessageStub = sandbox.stub(notificationService, 'showWarningMessage');
        notificationServiceStubs.showSuccessfulExecutionStub = sandbox
          .stub(notificationService, 'showSuccessfulExecution')
          .returns(Promise.resolve());
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('calls execute on the CliCommandExecutor', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });

        sinon.assert.calledOnce(cliCommandExecutorStub);
      });

      it('registers the server with DevServerService', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });

        sinon.assert.calledOnce(devServiceStub.registerServerHandler);
      });

      it('shows the success message once server is started', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });

        fakeExecution.stdoutSubject.next('foo');
        fakeExecution.stdoutSubject.next('bar');
        sinon.assert.notCalled(notificationServiceStubs.showSuccessfulExecutionStub);

        fakeExecution.stdoutSubject.next('Server up');
        sinon.assert.calledOnce(notificationServiceStubs.showSuccessfulExecutionStub);
      });

      it('shows the error message if server start up failed', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });

        fakeExecution.stderrSubject.next(errorHints.SERVER_STARTUP_FAILED);
        sinon.assert.notCalled(notificationServiceStubs.showSuccessfulExecutionStub);

        sinon.assert.calledTwice(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', nls.localize(`lightning_lwc_start_text`)))
        );

        sinon.assert.calledOnce(appendLineStub);
        sinon.assert.calledWith(appendLineStub, sinon.match(nls.localize('lightning_lwc_start_failed')));
      });

      it('opens the browser once server is started', () => {
        const executor = new LightningLwcStartExecutor();
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
        sinon.assert.calledWith(openBrowserStub, sinon.match(DEV_SERVER_DEFAULT_BASE_URL));
      });

      it('opens the browser at the correct port once server is started', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);
        devServiceStub.getBaseUrl.returns('http://localhost:3332');

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next(
          'Some details here\n Server up on http://localhost:3332 something\n More details here'
        );

        sinon.assert.calledWith(
          devServiceStub.setBaseUrlFromDevServerUpMessage,
          sinon.match('Some details here\n Server up on http://localhost:3332 something\n More details here')
        );
        sinon.assert.calledOnce(openBrowserStub);
        sinon.assert.calledWith(openBrowserStub, sinon.match('http://localhost:3332'));
      });

      it('opens the browser with default url when Server up message contains no url', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);
        devServiceStub.getBaseUrl.returns(DEV_SERVER_DEFAULT_BASE_URL);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('Some details here\n Server up on -no valid url here- \n More details here');

        sinon.assert.neverCalledWith(
          devServiceStub.setBaseUrlFromDevServerUpMessage,
          sinon.match('http://localhost:3333')
        );
        sinon.assert.calledOnce(openBrowserStub);
        sinon.assert.calledWith(openBrowserStub, sinon.match('http://localhost:3333'));
      });

      it('shows an error when the plugin is not installed', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('foo');
        fakeExecution.processExitSubject.next(127);

        const commandName = nls.localize(`lightning_lwc_start_text`);

        sinon.assert.calledTwice(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', commandName))
        );

        sinon.assert.calledOnce(appendLineStub);
        sinon.assert.calledWith(appendLineStub, sinon.match(nls.localize('lightning_lwc_start_not_found')));
      });

      it('shows an error when the address is already in use', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.processExitSubject.next(98);

        const commandName = nls.localize(`lightning_lwc_start_text`);

        sinon.assert.calledTwice(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', commandName))
        );

        sinon.assert.calledOnce(appendLineStub);
        sinon.assert.calledWith(appendLineStub, sinon.match(nls.localize('lightning_lwc_start_addr_in_use')));
      });

      it('shows an error when scratch org is inactive', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stderrSubject.next(errorHints.INACTIVE_SCRATCH_ORG);
        fakeExecution.processExitSubject.next(1);

        const commandName = nls.localize(`lightning_lwc_start_text`);

        sinon.assert.calledTwice(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', commandName))
        );

        sinon.assert.calledOnce(appendLineStub);
        sinon.assert.calledWith(appendLineStub, sinon.match(nls.localize('lightning_lwc_inactive_scratch_org')));
      });

      it('shows no error when server is stopping', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('Server up');
        fakeExecution.processExitSubject.next(0);

        sinon.assert.notCalled(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.notCalled(appendLineStub);
      });

      it('shows an error message when the process exists before server startup', () => {
        const executor = new LightningLwcStartExecutor();
        const fakeExecution = new FakeExecution(executor.build());
        cliCommandExecutorStub.returns(fakeExecution);

        executor.execute({ type: 'CONTINUE', data: {} });
        fakeExecution.stdoutSubject.next('foo');
        fakeExecution.processExitSubject.next(0);

        const commandName = nls.localize(`lightning_lwc_start_text`);

        sinon.assert.calledTwice(notificationServiceStubs.showErrorMessageStub);
        sinon.assert.calledWith(
          notificationServiceStubs.showErrorMessageStub,
          sinon.match(nls.localize('command_failure', commandName))
        );

        sinon.assert.calledOnce(appendLineStub);
        sinon.assert.calledWith(appendLineStub, sinon.match(nls.localize('lightning_lwc_start_failed')));
      });
    });
  });

  describe('lightningLwcStart function', () => {
    let sandbox: SinonSandbox;
    let showWarningStub: SinonStub<[string, ...string[]], Thenable<string | undefined>>;
    let devServiceStub: any;
    let commandletStub: SinonStub<[], Promise<void>>;

    beforeEach(() => {
      sandbox = sinon.createSandbox();

      devServiceStub = sinon.createStubInstance(DevServerService);
      sandbox.stub(DevServerService, 'instance').get(() => devServiceStub);

      sandbox.stub(commandUtils, 'openBrowser');
      commandletStub = sandbox.stub(SfCommandlet.prototype, 'run');
      showWarningStub = sandbox.stub(notificationService, 'showWarningMessage');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('calls run on the commandlet', async () => {
      await lightningLwcStart();
      sinon.assert.calledOnce(commandletStub);
    });

    it('shows a warning message when the server is already running', async () => {
      devServiceStub.isServerHandlerRegistered.returns(true);
      showWarningStub.resolves();

      await lightningLwcStart();

      sinon.assert.calledOnce(showWarningStub);
      sinon.assert.calledWith(showWarningStub, nls.localize('lightning_lwc_start_already_running'));
    });
  });
});
