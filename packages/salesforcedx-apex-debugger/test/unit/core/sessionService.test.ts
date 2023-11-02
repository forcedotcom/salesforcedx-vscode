/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  RequestService,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils';
import { expect } from 'chai';
import * as childProcess from 'child_process';
import { createSandbox, SinonSandbox, SinonSpy } from 'sinon';
import { SessionService } from '../../../src/core/sessionService';

describe('Debugger session service', () => {
  let service: SessionService;
  const mockSpawn = require('mock-spawn');

  beforeEach(() => {
    service = new SessionService(new RequestService());
  });

  describe('Helpers', () => {
    it('Should detect an Apex Debugger session ID by key prefix', () => {
      expect(service.isApexDebuggerSessionId('07aFAKE')).to.equal(true);
    });

    it('Should not detect an Apex Debugger session ID by key prefix', () => {
      expect(service.isApexDebuggerSessionId('FAKE')).to.equal(false);
    });
  });

  describe('Start', () => {
    let sandboxStub: SinonSandbox;
    let origSpawn: any;
    let mySpawn: any;
    let cmdWithArgSpy: SinonSpy;
    let cmdWithFlagSpy: SinonSpy;
    let cmdWithJsonSpy: SinonSpy;
    let cmdBuildSpy: SinonSpy;

    beforeEach(() => {
      origSpawn = childProcess.spawn;
      mySpawn = mockSpawn();
      sandboxStub = createSandbox();
      (childProcess as any).spawn = mySpawn;
      cmdWithArgSpy = sandboxStub.spy(SfdxCommandBuilder.prototype, 'withArg');
      cmdWithFlagSpy = sandboxStub.spy(
        SfdxCommandBuilder.prototype,
        'withFlag'
      );
      cmdWithJsonSpy = sandboxStub.spy(
        SfdxCommandBuilder.prototype,
        'withJson'
      );
      cmdBuildSpy = sandboxStub.spy(SfdxCommandBuilder.prototype, 'build');
    });

    afterEach(() => {
      (childProcess as any).spawn = origSpawn;
      sandboxStub.restore();
    });

    it('Should start successfully', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"07aFAKE"}}'));

      const cmdOutput = await service.start();

      expect(cmdOutput).to.equal('07aFAKE');
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
        'data:create:record'
      ]);
      expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
        '--sobject',
        'ApexDebuggerSession'
      ]);
      expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
        '--values',
        "UserIdFilter='user' EntryPointFilter='entry' RequestTypeFilter='request'"
      ]);
      expect(cmdWithArgSpy.getCall(1).args).to.have.same.members([
        '--use-tooling-api'
      ]);
      expect(cmdWithJsonSpy.calledOnce).to.equal(true);
      expect(cmdBuildSpy.calledOnce).to.equal(true);
    });

    it('Should not start successfully with wrong ID', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"FAKE"}}'));

      try {
        await service
          .forProject('project')
          .withUserFilter('user')
          .withRequestFilter('request')
          .withEntryFilter('entrypoint')
          .start();
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal('{"result":{"id":"FAKE"}}');
        expect(service.isConnected()).to.equal(false);
        expect(service.getSessionId()).to.equal('');
      }
    });

    it('Should not start successfully with unexpected response format', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"notid":"FAKE"}}'));

      try {
        await service.start();
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal('{"result":{"notid":"FAKE"}}');
        expect(service.isConnected()).to.equal(false);
        expect(service.getSessionId()).to.equal('');
      }
    });

    it('Should not start successfully with error message & action', async () => {
      mySpawn.setDefault(
        mySpawn.simple(
          1,
          '',
          '{"message":"There was an error", "action":"Try again"}'
        )
      );

      try {
        await service.start();
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal(
          '{"message":"There was an error", "action":"Try again"}'
        );
        expect(service.isConnected()).to.equal(false);
        expect(service.getSessionId()).to.an('undefined');
      }
    });
  });

  describe('Stop', () => {
    let origSpawn: any;
    let mySpawn: any;
    let sandboxStub: SinonSandbox;
    let cmdWithArgSpy: SinonSpy;
    let cmdWithFlagSpy: SinonSpy;
    let cmdWithJsonSpy: SinonSpy;
    let cmdBuildSpy: SinonSpy;

    beforeEach(() => {
      sandboxStub = createSandbox();
      origSpawn = childProcess.spawn;
      mySpawn = mockSpawn();
      (childProcess as any).spawn = mySpawn;
      cmdWithArgSpy = sandboxStub.spy(SfdxCommandBuilder.prototype, 'withArg');
      cmdWithFlagSpy = sandboxStub.spy(
        SfdxCommandBuilder.prototype,
        'withFlag'
      );
      cmdWithJsonSpy = sandboxStub.spy(
        SfdxCommandBuilder.prototype,
        'withJson'
      );
      cmdBuildSpy = sandboxStub.spy(SfdxCommandBuilder.prototype, 'build');
    });

    afterEach(() => {
      (childProcess as any).spawn = origSpawn;
      sandboxStub.restore();
    });

    it('Should stop successfully', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"07aFAKE"}}'));

      const cmdOutput = await service.stop();

      expect(cmdOutput).to.equal('07aFAKE');
      expect(service.isConnected()).to.equal(false);
      expect(service.getSessionId()).to.equal('');
    });

    it('Should build command', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"07aFAKE"}}'));
      await service.stop();

      expect(cmdWithArgSpy.calledTwice).to.equal(true);
      expect(cmdWithArgSpy.getCall(0).args).to.have.same.members([
        'data:update:record'
      ]);
      expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
        '--sobject',
        'ApexDebuggerSession'
      ]);
      /* TODO: this is throwing an undefined on --record-id
      expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
        '--record-id',
        '07aFAKE'
      ]); */
      expect(cmdWithFlagSpy.getCall(2).args).to.have.same.members([
        '--values',
        "Status='Detach'"
      ]);
      expect(cmdWithArgSpy.getCall(1).args).to.have.same.members([
        '--use-tooling-api'
      ]);
      expect(cmdWithJsonSpy.calledOnce).to.equal(true);
      expect(cmdBuildSpy.calledOnce).to.equal(true);
    });

    it('Should not stop successfully with wrong ID', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"FAKE"}}'));

      try {
        await service.stop();
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal('{"result":{"id":"FAKE"}}');
        expect(service.isConnected()).to.equal(true);
        expect(service.getSessionId()).to.an('undefined');
      }
    });

    it('Should not stop successfully with unexpected response format', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"notid":"FAKE"}}'));

      try {
        await service.stop();
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal('{"result":{"notid":"FAKE"}}');
        expect(service.isConnected()).to.equal(true);
        expect(service.getSessionId()).to.an('undefined');
      }
    });

    it('Should not stop successfully with error message & action', async () => {
      mySpawn.setDefault(
        mySpawn.simple(
          1,
          '',
          '{"message":"There was an error", "action":"Try again"}'
        )
      );

      try {
        await service.stop();
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal(
          '{"message":"There was an error", "action":"Try again"}'
        );
        expect(service.isConnected()).to.equal(false);
        expect(service.getSessionId()).to.an('undefined');
      }
    });

    it('Should reset connected status if forced to stop', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"07aFAKE"}}'));

      await service.start();
      service.forceStop();

      expect(service.isConnected()).to.equal(false);
      expect(service.getSessionId()).to.equal('');
    });
  });
});
