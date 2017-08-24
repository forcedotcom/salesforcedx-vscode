/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxCommandBuilder } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  ApexBreakpointLocation,
  LineBreakpointsInTyperef
} from '../../../src/breakpoints/lineBreakpoint';
import { BreakpointService } from '../../../src/core/breakpointService';
import { CommandOutput } from '../../../src/utils/commandOutput';
import childProcess = require('child_process');

describe('Debugger breakpoint service', () => {
  let service: BreakpointService;
  const mockSpawn = require('mock-spawn');

  describe('Helpers', () => {
    beforeEach(() => {
      service = new BreakpointService();
    });

    it('Should detect an Apex Debugger breakpoint ID by key prefix', () => {
      expect(service.isApexDebuggerBreakpointId('07bFAKE')).to.equal(true);
    });

    it('Should not detect an Apex Debugger breakpoint ID by key prefix', () => {
      expect(service.isApexDebuggerBreakpointId('FAKE')).to.equal(false);
    });

    it('Should get valid typeref', () => {
      const lineNumberMapping: Map<
        string,
        LineBreakpointsInTyperef[]
      > = new Map();
      lineNumberMapping.set('file:///foo.cls', [
        { typeref: 'foo', lines: [1, 2] },
        { typeref: 'foo$inner', lines: [3, 4] }
      ]);
      lineNumberMapping.set('file:///bar.cls', [
        { typeref: 'bar', lines: [3, 4] }
      ]);
      service.setValidLines(lineNumberMapping);

      const actualTyperef = service.getTyperefFor('file:///foo.cls', 3);

      expect(actualTyperef).to.equal('foo$inner');
    });

    it('Should not get typeref', () => {
      const lineNumberMapping: Map<
        string,
        LineBreakpointsInTyperef[]
      > = new Map();
      lineNumberMapping.set('file:///foo.cls', [
        { typeref: 'foo', lines: [1, 2] },
        { typeref: 'foo$inner', lines: [3, 4] }
      ]);
      lineNumberMapping.set('file:///bar.cls', [
        { typeref: 'bar', lines: [3, 4] }
      ]);
      service.setValidLines(lineNumberMapping);

      const actualTyperef = service.getTyperefFor('file:///xyz.cls', 3);

      expect(actualTyperef).to.equal(undefined);
    });

    it('Should cache breakpoint', () => {
      const expectedCache: Map<string, ApexBreakpointLocation[]> = new Map();
      expectedCache.set('file:///foo.cls', [
        { line: 1, breakpointId: '07bFAKE1' },
        { line: 2, breakpointId: '07bFAKE2' }
      ]);
      expectedCache.set('file:///bar.cls', [
        { line: 3, breakpointId: '07bFAKE3' }
      ]);

      service.cacheBreakpoint('file:///foo.cls', 1, '07bFAKE1');
      service.cacheBreakpoint('file:///foo.cls', 2, '07bFAKE2');
      service.cacheBreakpoint('file:///bar.cls', 3, '07bFAKE3');

      expect(service.getBreakpointCache()).to.deep.equal(expectedCache);
    });

    it('Should clear cached breakpoints', () => {
      service.cacheBreakpoint('file:///foo.cls', 1, '07bFAKE1');

      service.clearSavedBreakpoints();

      expect(service.getBreakpointCache().size).to.equal(0);
    });

    it('Should find existing breakpoints', () => {
      service.cacheBreakpoint('file:///foo.cls', 1, '07bFAKE1');
      service.cacheBreakpoint('file:///foo.cls', 2, '07bFAKE2');
      service.cacheBreakpoint('file:///bar.cls', 3, '07bFAKE3');

      const savedBreakpoints = service.getBreakpointsFor('file:///foo.cls');
      expect(savedBreakpoints).to.have.same.members([1, 2]);
    });

    it('Should not find existing breakpoints', () => {
      service.cacheBreakpoint('file:///foo.cls', 1, '07bFAKE1');
      service.cacheBreakpoint('file:///foo.cls', 2, '07bFAKE2');

      const savedBreakpoints = service.getBreakpointsFor('file:///bar.cls');
      expect(savedBreakpoints.length).to.equal(0);
    });
  });

  describe('Create line breakpoint', () => {
    let origSpawn: any, mySpawn: any;
    let cmdWithArgSpy: sinon.SinonSpy;
    let cmdWithFlagSpy: sinon.SinonSpy;
    let cmdBuildSpy: sinon.SinonSpy;

    beforeEach(() => {
      service = new BreakpointService();
      origSpawn = childProcess.spawn;
      mySpawn = mockSpawn();
      childProcess.spawn = mySpawn;
      cmdWithArgSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withArg');
      cmdWithFlagSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withFlag');
      cmdBuildSpy = sinon.spy(SfdxCommandBuilder.prototype, 'build');
    });

    afterEach(() => {
      childProcess.spawn = origSpawn;
      cmdWithArgSpy.restore();
      cmdWithFlagSpy.restore();
      cmdBuildSpy.restore();
    });

    it('Should create successfully', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"07bFAKE"}}'));

      const cmdOutput: CommandOutput = await service.createLineBreakpoint(
        'someProjectPath',
        '07aFAKE',
        'foo$inner',
        1
      );

      expect(cmdOutput.getStdOut()).to.equal('{"result":{"id":"07bFAKE"}}');
      expect(cmdOutput.getId()).to.equal('07bFAKE');
      expect(cmdWithArgSpy.getCall(0).args).to.have.same.members([
        'force:data:record:create'
      ]);
      expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
        '--sobjecttype',
        'ApexDebuggerBreakpoint'
      ]);
      expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
        '--values',
        "SessionId='07aFAKE' FileName='foo$inner' Line=1 IsEnabled='true' Type='Line'"
      ]);
      expect(cmdWithArgSpy.getCall(1).args).to.have.same.members([
        '--usetoolingapi'
      ]);
      expect(cmdWithArgSpy.getCall(2).args).to.have.same.members(['--json']);
      expect(cmdBuildSpy.calledOnce).to.equal(true);
    });

    it('Should not create breakpoint successfully with wrong ID', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"FAKE"}}'));

      try {
        await service.createLineBreakpoint(
          'someProjectPath',
          '07aFAKE',
          'foo$inner',
          1
        );
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal('{"result":{"id":"FAKE"}}');
      }
    });

    it('Should not create breakpoint successfully with unexpected response format', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"notid":"FAKE"}}'));

      try {
        await service.createLineBreakpoint(
          'someProjectPath',
          '07aFAKE',
          'foo$inner',
          1
        );
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal('{"result":{"notid":"FAKE"}}');
      }
    });

    it('Should not create breakpoint successfully with error message & action', async () => {
      mySpawn.setDefault(
        mySpawn.simple(
          1,
          '',
          '{"message":"There was an error", "action":"Try again"}'
        )
      );

      try {
        await service.createLineBreakpoint(
          'someProjectPath',
          '07aFAKE',
          'foo$inner',
          1
        );
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal(
          '{"message":"There was an error", "action":"Try again"}'
        );
      }
    });
  });

  describe('Delete line breakpoint', () => {
    let origSpawn: any, mySpawn: any;
    let cmdWithArgSpy: sinon.SinonSpy;
    let cmdWithFlagSpy: sinon.SinonSpy;
    let cmdBuildSpy: sinon.SinonSpy;

    beforeEach(() => {
      service = new BreakpointService();
      origSpawn = childProcess.spawn;
      mySpawn = mockSpawn();
      childProcess.spawn = mySpawn;
      cmdWithArgSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withArg');
      cmdWithFlagSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withFlag');
      cmdBuildSpy = sinon.spy(SfdxCommandBuilder.prototype, 'build');
    });

    afterEach(() => {
      childProcess.spawn = origSpawn;
      cmdWithArgSpy.restore();
      cmdWithFlagSpy.restore();
      cmdBuildSpy.restore();
    });

    it('Should delete successfully', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"07bFAKE"}}'));

      const cmdOutput: CommandOutput = await service.deleteLineBreakpoint(
        'someProjectPath',
        '07bFAKE'
      );

      expect(cmdOutput.getStdOut()).to.equal('{"result":{"id":"07bFAKE"}}');
      expect(cmdOutput.getId()).to.equal('07bFAKE');
      expect(cmdWithArgSpy.getCall(0).args).to.have.same.members([
        'force:data:record:delete'
      ]);
      expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
        '--sobjecttype',
        'ApexDebuggerBreakpoint'
      ]);
      expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
        '--sobjectid',
        '07bFAKE'
      ]);
      expect(cmdWithArgSpy.getCall(1).args).to.have.same.members([
        '--usetoolingapi'
      ]);
      expect(cmdWithArgSpy.getCall(2).args).to.have.same.members(['--json']);
      expect(cmdBuildSpy.calledOnce).to.equal(true);
    });

    it('Should not delete breakpoint successfully with wrong ID', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"id":"FAKE"}}'));

      try {
        await service.deleteLineBreakpoint('someProjectPath', '07bFAKE');
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal('{"result":{"id":"FAKE"}}');
      }
    });

    it('Should not delete breakpoint successfully with unexpected response format', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"notid":"FAKE"}}'));

      try {
        await service.deleteLineBreakpoint('someProjectPath', '07bFAKE');
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal('{"result":{"notid":"FAKE"}}');
      }
    });

    it('Should not delete breakpoint successfully with error message & action', async () => {
      mySpawn.setDefault(
        mySpawn.simple(
          1,
          '',
          '{"message":"There was an error", "action":"Try again"}'
        )
      );

      try {
        await service.deleteLineBreakpoint('someProjectPath', '07bFAKE');
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal(
          '{"message":"There was an error", "action":"Try again"}'
        );
      }
    });
  });

  describe('Reconcile', () => {
    let origSpawn: any, mySpawn: any;
    let deleteLineBreakpointSpy: sinon.SinonStub;

    beforeEach(() => {
      service = new BreakpointService();
      origSpawn = childProcess.spawn;
      mySpawn = mockSpawn();
      childProcess.spawn = mySpawn;
    });

    afterEach(() => {
      childProcess.spawn = origSpawn;
      deleteLineBreakpointSpy.restore();
    });

    it('Should not delete if there is no cached breakpoint', async () => {
      deleteLineBreakpointSpy = sinon
        .stub(BreakpointService.prototype, 'deleteLineBreakpoint')
        .returns(Promise.resolve(new CommandOutput()));

      const bpsToCreate = await service.reconcileBreakpoints(
        'someProjectPath',
        '07aFAKE',
        'file:///foo.cls',
        [1, 2]
      );

      expect(bpsToCreate).to.have.same.members([1, 2]);
      expect(deleteLineBreakpointSpy.called).to.equal(false);
    });

    it('Should find breakpoints for client to create and server to delete', async () => {
      deleteLineBreakpointSpy = sinon
        .stub(BreakpointService.prototype, 'deleteLineBreakpoint')
        .returns(Promise.resolve(new CommandOutput()));
      service.cacheBreakpoint('file:///foo.cls', 3, '07bFAKE3');
      service.cacheBreakpoint('file:///foo.cls', 4, '07bFAKE4');
      service.cacheBreakpoint('file:///foo.cls', 5, '07bFAKE5');
      service.cacheBreakpoint('file:///bar.cls', 1, '07bFAKE1');
      const expectedCache: Map<string, ApexBreakpointLocation[]> = new Map();
      expectedCache.set('file:///foo.cls', [
        { line: 3, breakpointId: '07bFAKE3' }
      ]);
      expectedCache.set('file:///bar.cls', [
        { line: 1, breakpointId: '07bFAKE1' }
      ]);

      const bpsToCreate = await service.reconcileBreakpoints(
        'someProjectPath',
        '07aFAKE',
        'file:///foo.cls',
        [1, 2, 3]
      );

      expect(bpsToCreate).to.have.same.members([1, 2]);
      expect(deleteLineBreakpointSpy.calledTwice).to.equal(true);
      expect(deleteLineBreakpointSpy.getCall(0).args).to.have.same.members([
        'someProjectPath',
        '07bFAKE4'
      ]);
      expect(deleteLineBreakpointSpy.getCall(1).args).to.have.same.members([
        'someProjectPath',
        '07bFAKE5'
      ]);
      expect(service.getBreakpointCache()).to.deep.equal(expectedCache);
    });
  });
});
