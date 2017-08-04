/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandExecution,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SessionService } from '../../../src/core/sessionService';
import { CommandOutput } from '../../../src/utils/commandOutput';

describe('Debugger session service', () => {
  let service: SessionService;
  const cmdWithArgSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withArg');
  const cmdWithFlagSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withFlag');
  const cmdBuildSpy = sinon.spy(SfdxCommandBuilder.prototype, 'build');

  beforeEach(() => {
    service = new SessionService();
  });

  describe('Helpers', () => {
    it('Should detect an Apex Debugger session ID', () => {
      expect(service.isApexDebuggerSessionId('07aFAKE')).to.equal(true);
    });

    it('Should not detect an Apex Debugger session ID', () => {
      expect(service.isApexDebuggerSessionId('FAKE')).to.equal(false);
    });
  });

  describe('Start', () => {
    let origSpawn: any, mySpawn: any;
    const childProcess = require('child_process');
    const mockSpawn = require('mock-spawn');

    beforeEach(() => {
      origSpawn = childProcess.spawn;
      mySpawn = mockSpawn();
      childProcess.spawn = mySpawn;
    });

    afterEach(() => {
      childProcess.spawn = origSpawn;
      cmdWithArgSpy.reset();
      cmdWithFlagSpy.reset();
      cmdBuildSpy.reset();
    });

    it('Should start successfully', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"07aFAKE"}}'));

      const cmdOutput: CommandOutput = await service.start();

      expect(cmdOutput.getStdOut()).to.equal('{"result":{"id":"07aFAKE"}}');
      expect(cmdOutput.getId()).to.equal('07aFAKE');
      expect(service.isConnected()).to.equal(true);
      expect(service.getSessionId()).to.equal('07aFAKE');
    });

    it('Should build command', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"07aFAKE"}}'));

      await service
        .forProject('project')
        .withUserFilter('user')
        .withRequestFilter('request')
        .withEntryFilter('entry')
        .start();

      expect(cmdWithArgSpy.getCall(0).args).to.have.same.members([
        'force:data:record:create'
      ]);
      expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
        '--sobjecttype',
        'ApexDebuggerSession'
      ]);
      expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
        '--values',
        "UserIdFilter='user' EntryPointFilter='entry' RequestTypeFilter='request'"
      ]);
      expect(cmdWithArgSpy.getCall(1).args).to.have.same.members([
        '--usetoolingapi'
      ]);
      expect(cmdWithArgSpy.getCall(2).args).to.have.same.members(['--json']);
      expect(cmdBuildSpy.calledOnce).to.equal(true);
    });

    it('Should not start successfully with wrong ID', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"FAKE"}}'));

      const cmdOutput: CommandOutput = await service
        .forProject('project')
        .withUserFilter('user')
        .withRequestFilter('request')
        .withEntryFilter('entrypoint')
        .start();

      expect(cmdOutput.getStdOut()).to.equal('{"result":{"id":"FAKE"}}');
      expect(cmdOutput.getId()).to.equal('FAKE');
      expect(service.isConnected()).to.equal(false);
      expect(service.getSessionId()).to.equal('');
    });

    it('Should not start successfully with unexpected response format', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"notid":"FAKE"}}'));

      const cmdOutput: CommandOutput = await service.start();

      expect(cmdOutput.getStdOut()).to.equal('{"result":{"notid":"FAKE"}}');
      expect(cmdOutput.getId()).to.an('undefined');
      expect(service.isConnected()).to.equal(false);
      expect(service.getSessionId()).to.equal('');
    });

    it('Should not start successfully with error message & action', async () => {
      mySpawn.setDefault(
        mySpawn.simple(
          1,
          '',
          '{"message":"There was an error", "action":"Try again"}'
        )
      );

      const cmdOutput: CommandOutput = await service.start();

      expect(cmdOutput.getStdErr()).to.equal(
        '{"message":"There was an error", "action":"Try again"}'
      );
      expect(cmdOutput.getCmdMsg()).to.equal('There was an error');
      expect(cmdOutput.getCmdAction()).to.equal('Try again');
      expect(service.isConnected()).to.equal(false);
      expect(service.getSessionId()).to.equal('');
    });
  });

  describe('Stop', () => {
    let origSpawn: any, mySpawn: any;
    const childProcess = require('child_process');
    const mockSpawn = require('mock-spawn');
    const cmd: Command = new SfdxCommandBuilder().build();

    beforeEach(() => {
      origSpawn = childProcess.spawn;
      mySpawn = mockSpawn();
      childProcess.spawn = mySpawn;
    });

    afterEach(() => {
      childProcess.spawn = origSpawn;
      cmdWithArgSpy.reset();
      cmdWithFlagSpy.reset();
      cmdBuildSpy.reset();
    });

    it('Should stop successfully', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"07aFAKE"}}'));

      const cmdOutput: CommandOutput = await service.stop();

      expect(cmdOutput.getStdOut()).to.equal('{"result":{"id":"07aFAKE"}}');
      expect(cmdOutput.getId()).to.equal('07aFAKE');
      expect(service.isConnected()).to.equal(false);
      expect(service.getSessionId()).to.equal('');
    });

    it('Should build command', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"07aFAKE"}}'));

      await service.start();
      cmdWithArgSpy.reset();
      cmdWithFlagSpy.reset();
      cmdBuildSpy.reset();
      await service.stop();

      expect(cmdWithArgSpy.getCall(0).args).to.have.same.members([
        'force:data:record:update'
      ]);
      expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
        '--sobjecttype',
        'ApexDebuggerSession'
      ]);
      expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
        '--sobjectid',
        '07aFAKE'
      ]);
      expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
        '--values',
        "Status='Detach'"
      ]);
      expect(cmdWithArgSpy.getCall(1).args).to.have.same.members([
        '--usetoolingapi'
      ]);
      expect(cmdWithArgSpy.getCall(2).args).to.have.same.members(['--json']);
      expect(cmdBuildSpy.calledOnce).to.equal(true);
    });

    it('Should not stop successfully with wrong ID', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"FAKE"}}'));

      const cmdOutput: CommandOutput = await service.stop();

      expect(cmdOutput.getStdOut()).to.equal('{"result":{"id":"FAKE"}}');
      expect(cmdOutput.getId()).to.equal('FAKE');
      expect(service.isConnected()).to.equal(true);
      expect(service.getSessionId()).to.an('undefined');
    });

    it('Should not stop successfully with unexpected response format', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"notid":"FAKE"}}'));

      const cmdOutput: CommandOutput = await service.stop();

      expect(cmdOutput.getStdOut()).to.equal('{"result":{"notid":"FAKE"}}');
      expect(cmdOutput.getId()).to.an('undefined');
      expect(service.isConnected()).to.equal(true);
      expect(service.getSessionId()).to.an('undefined');
    });

    it('Should not stop successfully with error message & action', async () => {
      mySpawn.setDefault(
        mySpawn.simple(
          1,
          '',
          '{"message":"There was an error", "action":"Try again"}'
        )
      );

      const cmdOutput: CommandOutput = await service.stop();

      expect(cmdOutput.getStdErr()).to.equal(
        '{"message":"There was an error", "action":"Try again"}'
      );
      expect(cmdOutput.getCmdMsg()).to.equal('There was an error');
      expect(cmdOutput.getCmdAction()).to.equal('Try again');
      expect(service.isConnected()).to.equal(true);
      expect(service.getSessionId()).to.an('undefined');
    });
  });
});
