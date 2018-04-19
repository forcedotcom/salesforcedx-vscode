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
import childProcess = require('child_process');
import { RequestService } from '../../../src/commands/index';

describe('Debugger breakpoint service', () => {
  let service: BreakpointService;
  const mockSpawn = require('mock-spawn');
  const lineNumberMapping: Map<string, LineBreakpointsInTyperef[]> = new Map();
  const typerefMapping: Map<string, string> = new Map();
  lineNumberMapping.set('file:///foo.cls', [
    { typeref: 'foo', lines: [1, 2] },
    { typeref: 'foo$inner', lines: [3, 4] }
  ]);
  lineNumberMapping.set('file:///bar.cls', [{ typeref: 'bar', lines: [3, 4] }]);
  typerefMapping.set('foo', 'file:///foo.cls');
  typerefMapping.set('foo$inner', 'file:///foo.cls');
  typerefMapping.set('bar', 'file:///bar.cls');

  describe('Helpers', () => {
    beforeEach(() => {
      service = new BreakpointService(new RequestService());
    });

    it('Should detect an Apex Debugger breakpoint ID by key prefix', () => {
      expect(service.isApexDebuggerBreakpointId('07bFAKE')).to.equal(true);
    });

    it('Should not detect an Apex Debugger breakpoint ID by key prefix', () => {
      expect(service.isApexDebuggerBreakpointId('FAKE')).to.equal(false);
    });

    it('Should not have line number mapping', () => {
      expect(service.hasLineNumberMapping()).to.equal(false);
    });

    it('Should get valid typeref', () => {
      service.setValidLines(lineNumberMapping, typerefMapping);

      const actualTyperef = service.getTyperefFor('file:///foo.cls', 3);

      expect(actualTyperef).to.equal('foo$inner');
      expect(service.hasLineNumberMapping()).to.equal(true);
    });

    it('Should not get typeref', () => {
      service.setValidLines(lineNumberMapping, typerefMapping);

      const actualTyperef = service.getTyperefFor('file:///xyz.cls', 3);

      expect(actualTyperef).to.equal(undefined);
    });

    it('Should get valid uri from typeref', () => {
      service.setValidLines(lineNumberMapping, typerefMapping);

      const uri = service.getSourcePathFromTyperef('foo$inner');

      expect(uri).to.equal('file:///foo.cls');
    });

    it('Should not get uri from typeref', () => {
      service.setValidLines(lineNumberMapping, typerefMapping);

      const uri = service.getSourcePathFromTyperef('xyz');

      expect(uri).to.equal(undefined);
    });

    it('Should get valid uri from partial typeref', () => {
      service.setValidLines(lineNumberMapping, typerefMapping);

      const uri = service.getSourcePathFromPartialTyperef('inner');

      expect(uri).to.equal('file:///foo.cls');
    });

    it('Should not get uri from partial typeref', () => {
      service.setValidLines(lineNumberMapping, typerefMapping);

      const uri = service.getSourcePathFromPartialTyperef('xyz');

      expect(uri).to.equal(undefined);
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

      service.cacheLineBreakpoint('file:///foo.cls', 1, '07bFAKE1');
      service.cacheLineBreakpoint('file:///foo.cls', 2, '07bFAKE2');
      service.cacheLineBreakpoint('file:///bar.cls', 3, '07bFAKE3');

      expect(service.getLineBreakpointCache()).to.deep.equal(expectedCache);
    });

    it('Should clear cached breakpoints', () => {
      service.cacheLineBreakpoint('file:///foo.cls', 1, '07bFAKE1');
      service.getExceptionBreakpointCache().set('fooexception', '07bFAKE2');

      service.clearSavedBreakpoints();

      expect(service.getLineBreakpointCache().size).to.equal(0);
      expect(service.getExceptionBreakpointCache().size).to.equal(0);
    });

    it('Should find existing breakpoints', () => {
      service.cacheLineBreakpoint('file:///foo.cls', 1, '07bFAKE1');
      service.cacheLineBreakpoint('file:///foo.cls', 2, '07bFAKE2');
      service.cacheLineBreakpoint('file:///bar.cls', 3, '07bFAKE3');

      const savedBreakpoints = service.getBreakpointsFor('file:///foo.cls');
      expect(savedBreakpoints).to.have.all.keys([1, 2]);
    });

    it('Should not find existing breakpoints', () => {
      service.cacheLineBreakpoint('file:///foo.cls', 1, '07bFAKE1');
      service.cacheLineBreakpoint('file:///foo.cls', 2, '07bFAKE2');

      const savedBreakpoints = service.getBreakpointsFor('file:///bar.cls');
      expect(savedBreakpoints.size).to.equal(0);
    });
  });

  describe('Create line breakpoint', () => {
    let origSpawn: any, mySpawn: any;
    let cmdWithArgSpy: sinon.SinonSpy;
    let cmdWithFlagSpy: sinon.SinonSpy;
    let cmdBuildSpy: sinon.SinonSpy;

    beforeEach(() => {
      service = new BreakpointService(new RequestService());
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

      const cmdOutput = await service.createLineBreakpoint(
        'someProjectPath',
        '07aFAKE',
        'foo$inner',
        1
      );

      expect(cmdOutput).to.equal('07bFAKE');
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

  describe('Create exception breakpoint', () => {
    let origSpawn: any, mySpawn: any;
    let cmdWithArgSpy: sinon.SinonSpy;
    let cmdWithFlagSpy: sinon.SinonSpy;
    let cmdBuildSpy: sinon.SinonSpy;

    beforeEach(() => {
      service = new BreakpointService(new RequestService());
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

      const cmdOutput = await service.createExceptionBreakpoint(
        'someProjectPath',
        '07aFAKE',
        'fooexception'
      );

      expect(cmdOutput).to.equal('07bFAKE');
      expect(cmdWithArgSpy.getCall(0).args).to.have.same.members([
        'force:data:record:create'
      ]);
      expect(cmdWithFlagSpy.getCall(0).args).to.have.same.members([
        '--sobjecttype',
        'ApexDebuggerBreakpoint'
      ]);
      expect(cmdWithFlagSpy.getCall(1).args).to.have.same.members([
        '--values',
        "SessionId='07aFAKE' FileName='fooexception' IsEnabled='true' Type='Exception'"
      ]);
      expect(cmdWithArgSpy.getCall(1).args).to.have.same.members([
        '--usetoolingapi'
      ]);
      expect(cmdWithArgSpy.getCall(2).args).to.have.same.members(['--json']);
      expect(cmdBuildSpy.calledOnce).to.equal(true);
    });
  });

  describe('Delete breakpoint', () => {
    let origSpawn: any, mySpawn: any;
    let cmdWithArgSpy: sinon.SinonSpy;
    let cmdWithFlagSpy: sinon.SinonSpy;
    let cmdBuildSpy: sinon.SinonSpy;

    beforeEach(() => {
      service = new BreakpointService(new RequestService());
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

      const cmdOutput = await service.deleteBreakpoint(
        'someProjectPath',
        '07bFAKE'
      );

      expect(cmdOutput).to.equal('07bFAKE');
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
        await service.deleteBreakpoint('someProjectPath', '07bFAKE');
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal('{"result":{"id":"FAKE"}}');
      }
    });

    it('Should not delete breakpoint successfully with unexpected response format', async () => {
      mySpawn.setDefault(mySpawn.simple(0, '{"result":{"notid":"FAKE"}}'));

      try {
        await service.deleteBreakpoint('someProjectPath', '07bFAKE');
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
        await service.deleteBreakpoint('someProjectPath', '07bFAKE');
        expect.fail('Should have failed');
      } catch (error) {
        expect(error).to.equal(
          '{"message":"There was an error", "action":"Try again"}'
        );
      }
    });
  });

  describe('Reconcile', () => {
    let addLineBreakpointSpy: sinon.SinonStub;
    let addExceptionBreakpointSpy: sinon.SinonStub;
    let deleteBreakpointSpy: sinon.SinonStub;
    let getTyperefForSpy: sinon.SinonStub;

    beforeEach(() => {
      service = new BreakpointService(new RequestService());
      service.cacheLineBreakpoint('file:///foo.cls', 3, '07bFAKE3');
      service.cacheLineBreakpoint('file:///foo.cls', 4, '07bFAKE4');
      service.cacheLineBreakpoint('file:///foo.cls', 5, '07bFAKE5');
      service.cacheLineBreakpoint('file:///bar.cls', 1, '07bFAKE6');
      service.getExceptionBreakpointCache().set('fooexception', '07bFAKE7');
    });

    afterEach(() => {
      if (addLineBreakpointSpy) {
        addLineBreakpointSpy.restore();
      }
      if (addExceptionBreakpointSpy) {
        addExceptionBreakpointSpy.restore();
      }
      if (deleteBreakpointSpy) {
        deleteBreakpointSpy.restore();
      }
      if (getTyperefForSpy) {
        getTyperefForSpy.restore();
      }
    });

    it('Should reconcile line breakpoints for client to create and server to delete', async () => {
      getTyperefForSpy = sinon
        .stub(BreakpointService.prototype, 'getTyperefFor')
        .returns('foo');
      addLineBreakpointSpy = sinon
        .stub(BreakpointService.prototype, 'createLineBreakpoint')
        .onFirstCall()
        .returns(Promise.resolve('07bFAKE1'))
        .onSecondCall()
        .returns(Promise.resolve('07bFAKE2'));
      deleteBreakpointSpy = sinon
        .stub(BreakpointService.prototype, 'deleteBreakpoint')
        .onFirstCall()
        .returns(Promise.resolve('07bFAKE4'))
        .onSecondCall()
        .returns(Promise.resolve('07bFAKE5'));
      const expectedCache: Map<string, ApexBreakpointLocation[]> = new Map();
      expectedCache.set('file:///foo.cls', [
        { line: 3, breakpointId: '07bFAKE3' },
        { line: 1, breakpointId: '07bFAKE1' },
        { line: 2, breakpointId: '07bFAKE2' }
      ]);
      expectedCache.set('file:///bar.cls', [
        { line: 1, breakpointId: '07bFAKE6' }
      ]);

      const bpsToCreate = await service.reconcileLineBreakpoints(
        'someProjectPath',
        'file:///foo.cls',
        '07aFAKE',
        [1, 2, 3]
      );

      expect(bpsToCreate).to.have.all.keys([1, 2, 3]);
      expect(addLineBreakpointSpy.calledTwice).to.equal(true);
      expect(addLineBreakpointSpy.getCall(0).args).to.have.same.members([
        'someProjectPath',
        '07aFAKE',
        'foo',
        1
      ]);
      expect(addLineBreakpointSpy.getCall(1).args).to.have.same.members([
        'someProjectPath',
        '07aFAKE',
        'foo',
        2
      ]);
      expect(deleteBreakpointSpy.calledTwice).to.equal(true);
      expect(deleteBreakpointSpy.getCall(0).args).to.have.same.members([
        'someProjectPath',
        '07bFAKE5'
      ]);
      expect(deleteBreakpointSpy.getCall(1).args).to.have.same.members([
        'someProjectPath',
        '07bFAKE4'
      ]);
      expect(service.getLineBreakpointCache()).to.deep.equal(expectedCache);
    });

    it('Should not create line breakpoints without known typeref', async () => {
      getTyperefForSpy = sinon
        .stub(BreakpointService.prototype, 'getTyperefFor')
        .returns(undefined);
      addLineBreakpointSpy = sinon.stub(
        BreakpointService.prototype,
        'createLineBreakpoint'
      );
      deleteBreakpointSpy = sinon
        .stub(BreakpointService.prototype, 'deleteBreakpoint')
        .onFirstCall()
        .returns(Promise.resolve('07bFAKE4'))
        .onSecondCall()
        .returns(Promise.resolve('07bFAKE5'));
      const expectedCache: Map<string, ApexBreakpointLocation[]> = new Map();
      expectedCache.set('file:///foo.cls', [
        { line: 3, breakpointId: '07bFAKE3' }
      ]);
      expectedCache.set('file:///bar.cls', [
        { line: 1, breakpointId: '07bFAKE6' }
      ]);

      const bpsToCreate = await service.reconcileLineBreakpoints(
        'someProjectPath',
        'file:///foo.cls',
        '07aFAKE',
        [1, 2, 3]
      );

      expect(bpsToCreate).to.have.all.keys([3]);
      expect(addLineBreakpointSpy.called).to.equal(false);
      expect(deleteBreakpointSpy.calledTwice).to.equal(true);
      expect(deleteBreakpointSpy.getCall(0).args).to.have.same.members([
        'someProjectPath',
        '07bFAKE5'
      ]);
      expect(deleteBreakpointSpy.getCall(1).args).to.have.same.members([
        'someProjectPath',
        '07bFAKE4'
      ]);
      expect(service.getLineBreakpointCache()).to.deep.equal(expectedCache);
    });

    it('Should create new exception breakpoint', async () => {
      addExceptionBreakpointSpy = sinon
        .stub(BreakpointService.prototype, 'createExceptionBreakpoint')
        .returns('07bFAKE8');

      await service.reconcileExceptionBreakpoints(
        'someProjectPath',
        '07aFAKE',
        {
          breakMode: 'always',
          typeref: 'barexception',
          label: 'barexception'
        }
      );

      expect(addExceptionBreakpointSpy.calledOnce).to.equal(true);
      expect(addExceptionBreakpointSpy.getCall(0).args).to.have.same.members([
        'someProjectPath',
        '07aFAKE',
        'barexception'
      ]);
      expect(
        service.getExceptionBreakpointCache().has('barexception')
      ).to.equal(true);
    });

    it('Should not create existing exception breakpoint', async () => {
      addExceptionBreakpointSpy = sinon
        .stub(BreakpointService.prototype, 'createExceptionBreakpoint')
        .returns('07bFAKE7');

      await service.reconcileExceptionBreakpoints(
        'someProjectPath',
        '07aFAKE',
        {
          breakMode: 'always',
          typeref: 'fooexception',
          label: 'fooexception'
        }
      );

      expect(addExceptionBreakpointSpy.called).to.equal(false);
      expect(
        service.getExceptionBreakpointCache().has('fooexception')
      ).to.equal(true);
    });

    it('Should delete existing exception breakpoint', async () => {
      deleteBreakpointSpy = sinon
        .stub(BreakpointService.prototype, 'deleteBreakpoint')
        .returns(Promise.resolve('07bFAKE7'));

      await service.reconcileExceptionBreakpoints(
        'someProjectPath',
        '07aFAKE',
        {
          breakMode: 'never',
          typeref: 'fooexception',
          label: 'fooexception'
        }
      );

      expect(deleteBreakpointSpy.calledOnce).to.equal(true);
      expect(deleteBreakpointSpy.getCall(0).args).to.have.same.members([
        'someProjectPath',
        '07bFAKE7'
      ]);
      expect(
        service.getExceptionBreakpointCache().has('fooexception')
      ).to.equal(false);
    });

    it('Should not delete unknown exception breakpoint', async () => {
      deleteBreakpointSpy = sinon
        .stub(BreakpointService.prototype, 'deleteBreakpoint')
        .returns(Promise.resolve('07bFAKE8'));

      await service.reconcileExceptionBreakpoints(
        'someProjectPath',
        '07aFAKE',
        {
          breakMode: 'never',
          typeref: 'barexception',
          label: 'barexception'
        }
      );

      expect(deleteBreakpointSpy.called).to.equal(false);
      expect(
        service.getExceptionBreakpointCache().has('barexception')
      ).to.equal(false);
    });
  });
});
