/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as childProcess from 'child_process';
import * as sinon from 'sinon';
import {
  DebuggerSessionDetachExecutor,
  IdGatherer,
  IdSelection,
  StopActiveDebuggerSessionExecutor
} from '../../../src/commands';
import { SfCommandlet, SfWorkspaceChecker } from '../../../src/commands/util';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';

describe('Debugger stop command', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mockSpawn = require('mock-spawn');

  describe('Session query', () => {
    let origSpawn: any;
    let mySpawn: any;
    let workspaceCheckerStub: sinon.SinonStub;
    let idGathererStub: sinon.SinonStub;
    let detachExecutorSpy: sinon.SinonSpy;
    let sessionDetachRunSpy: sinon.SinonSpy;
    let executor: StopActiveDebuggerSessionExecutor;
    let infoSpy: sinon.SinonSpy;

    beforeEach(() => {
      origSpawn = childProcess.spawn;
      mySpawn = mockSpawn();
      (childProcess as any).spawn = mySpawn;
      workspaceCheckerStub = sinon
        .stub(SfWorkspaceChecker.prototype, 'check')
        .returns(true);
      idGathererStub = sinon
        .stub(IdGatherer.prototype, 'gather')
        .returns({ type: 'CONTINUE' });
      detachExecutorSpy = sinon.spy(
        DebuggerSessionDetachExecutor.prototype,
        'execute'
      );
      sessionDetachRunSpy = sinon.spy(SfCommandlet.prototype, 'run');
      executor = new StopActiveDebuggerSessionExecutor();
      infoSpy = sinon.stub(notificationService, 'showInformationMessage');
    });

    afterEach(() => {
      (childProcess as any).spawn = origSpawn;
      workspaceCheckerStub.restore();
      idGathererStub.restore();
      detachExecutorSpy.restore();
      sessionDetachRunSpy.restore();
      infoSpy.restore();
    });

    it('Should build query command', () => {
      const command = executor.build({});

      expect(command.toCommand()).to.equal(
        "sf data:query --query SELECT Id FROM ApexDebuggerSession WHERE Status = 'Active' LIMIT 1 --use-tooling-api --json"
      );
      expect(command.description).to.equal(
        nls.localize('debugger_query_session_text')
      );
    });

    it('Should query & stop', async () => {
      mySpawn.sequence.add(
        mySpawn.simple(
          0,
          '{"status":0,"result":{"size":1,"records":[{"Id":"07aFAKE"}]}}'
        )
      );
      mySpawn.sequence.add(mySpawn.simple(0, '{}'));

      await executor.execute({} as ContinueResponse<{}>);

      expect(workspaceCheckerStub.calledOnce).to.equal(true);
      expect(idGathererStub.calledOnce).to.equal(true);
      expect(detachExecutorSpy.calledOnce).to.equal(true);
      expect(sessionDetachRunSpy.calledOnce).to.equal(true);
    });

    it('Should handle zero query result', async () => {
      mySpawn.sequence.add(
        mySpawn.simple(0, '{"status":0,"result":{"size":0,"records":[]}}')
      );

      await executor.execute({} as ContinueResponse<{}>);

      expect(workspaceCheckerStub.calledOnce).to.equal(false);
      expect(idGathererStub.called).to.equal(false);
      expect(detachExecutorSpy.called).to.equal(false);
      expect(sessionDetachRunSpy.calledOnce).to.equal(false);
      expect(infoSpy.calledOnce).to.equal(true);
      expect(infoSpy.getCall(0).args).to.have.same.members([
        nls.localize('debugger_stop_none_found_text')
      ]);
    });

    it('Should handle unexpected Apex Debugger session ID', async () => {
      mySpawn.sequence.add(
        mySpawn.simple(
          0,
          '{"status":0,"result":{"size":1,"records":[{"Id":"foo"}]}}'
        )
      );

      await executor.execute({} as ContinueResponse<{}>);

      expect(workspaceCheckerStub.calledOnce).to.equal(false);
      expect(idGathererStub.called).to.equal(false);
      expect(detachExecutorSpy.called).to.equal(false);
      expect(sessionDetachRunSpy.calledOnce).to.equal(false);
    });

    it('Should handle JSON parse error', async () => {
      mySpawn.sequence.add(mySpawn.simple(0, 'error'));

      await executor.execute({} as ContinueResponse<{}>);

      expect(workspaceCheckerStub.calledOnce).to.equal(false);
      expect(idGathererStub.called).to.equal(false);
      expect(detachExecutorSpy.called).to.equal(false);
      expect(sessionDetachRunSpy.calledOnce).to.equal(false);
    });

    it('Should handle process error', async () => {
      mySpawn.sequence.add(mySpawn.simple(1, '', 'error'));

      await executor.execute({} as ContinueResponse<{}>);

      expect(workspaceCheckerStub.calledOnce).to.equal(false);
      expect(idGathererStub.called).to.equal(false);
      expect(detachExecutorSpy.called).to.equal(false);
      expect(sessionDetachRunSpy.calledOnce).to.equal(false);
    });
  });

  describe('Session detach', () => {
    it('Should build update command', () => {
      const executor = new DebuggerSessionDetachExecutor();

      const command = executor.build({ id: '07aFAKE' } as IdSelection);

      expect(command.toCommand()).to.equal(
        'sf data:update:record --sobject ApexDebuggerSession --record-id 07aFAKE --values Status="Detach" --use-tooling-api'
      );
      expect(command.description).to.equal(nls.localize('debugger_stop_text'));
    });
  });
});
