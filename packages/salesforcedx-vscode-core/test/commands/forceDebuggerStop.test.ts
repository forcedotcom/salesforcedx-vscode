/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../../src/commands/commands';
import {
  DebuggerSessionDetachExecutor,
  IdGatherer,
  IdSelection,
  StopActiveDebuggerSessionExecutor
} from '../../src/commands/forceDebuggerStop';
import { nls } from '../../src/messages';
import { notificationService } from '../../src/notifications';
import childProcess = require('child_process');

describe('Debugger stop command', () => {
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
      childProcess.spawn = mySpawn;
      workspaceCheckerStub = sinon
        .stub(SfdxWorkspaceChecker.prototype, 'check')
        .returns(true);
      idGathererStub = sinon
        .stub(IdGatherer.prototype, 'gather')
        .returns({ type: 'CONTINUE' });
      detachExecutorSpy = sinon.spy(
        DebuggerSessionDetachExecutor.prototype,
        'execute'
      );
      sessionDetachRunSpy = sinon.spy(SfdxCommandlet.prototype, 'run');
      executor = new StopActiveDebuggerSessionExecutor();
      infoSpy = sinon.stub(notificationService, 'showInformationMessage');
    });

    afterEach(() => {
      childProcess.spawn = origSpawn;
      workspaceCheckerStub.restore();
      idGathererStub.restore();
      detachExecutorSpy.restore();
      sessionDetachRunSpy.restore();
      infoSpy.restore();
    });

    it('Should build query command', () => {
      const command = executor.build({});

      expect(command.toCommand()).to.equal(
        "sfdx force:data:soql:query --query SELECT Id FROM ApexDebuggerSession WHERE Status = 'Active' LIMIT 1 --usetoolingapi --json --loglevel fatal"
      );
      expect(command.description).to.equal(
        nls.localize('force_debugger_query_session_text')
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
        nls.localize('force_debugger_stop_none_found_text')
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
        'sfdx force:data:record:update --sobjecttype ApexDebuggerSession --sobjectid 07aFAKE --values Status="Detach" --usetoolingapi'
      );
      expect(command.description).to.equal(
        nls.localize('force_debugger_stop_text')
      );
    });
  });
});
