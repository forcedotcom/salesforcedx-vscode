/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { ForceConfigGet, SfdxCommandBuilder } from '../../../src/cli';
import childProcess = require('child_process');

describe('force:config:get', () => {
  const mockSpawn = require('mock-spawn');
  let command: ForceConfigGet;
  let origSpawn: any;
  let mySpawn: any;
  let cmdWithArgSpy: sinon.SinonSpy;
  let cmdJsonSpy: sinon.SinonSpy;
  let cmdBuildSpy: sinon.SinonSpy;

  beforeEach(() => {
    command = new ForceConfigGet();
    origSpawn = childProcess.spawn;
    mySpawn = mockSpawn();
    childProcess.spawn = mySpawn;
    cmdWithArgSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withArg');
    cmdJsonSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withJson');
    cmdBuildSpy = sinon.spy(SfdxCommandBuilder.prototype, 'build');
  });

  afterEach(() => {
    childProcess.spawn = origSpawn;
    cmdWithArgSpy.restore();
    cmdJsonSpy.restore();
    cmdBuildSpy.restore();
  });

  it('Should return config successfully', async () => {
    const response = new Array<any>();
    response.push({ key: 'key1', value: 'val1' });
    response.push({ key: 'key2', value: 'val2' });
    mySpawn.setDefault(
      mySpawn.simple(0, `{ "status": 0, "result": ${JSON.stringify(response)}}`)
    );

    const cmdOutput = await command.getConfig('foo', 'key1', 'key2');

    expect(cmdOutput.get('key1')).to.equal('val1');
    expect(cmdOutput.get('key2')).to.equal('val2');
    expect(cmdWithArgSpy.callCount).to.equal(3);
    expect(cmdWithArgSpy.getCall(0).args).to.have.same.members([
      'force:config:get'
    ]);
    expect(cmdWithArgSpy.getCall(1).args).to.have.same.members(['key1']);
    expect(cmdWithArgSpy.getCall(2).args).to.have.same.members(['key2']);
    expect(cmdJsonSpy.calledOnce).to.equal(true);
    expect(cmdBuildSpy.calledOnce).to.equal(true);
  });

  it('Should reject with command error', async () => {
    mySpawn.setDefault(mySpawn.simple(1, '', 'There was an error'));

    try {
      await command.getConfig('foo');
    } catch (error) {
      expect(error).to.equal('There was an error');
    }
  });

  it('Should reject with unparseable command output', async () => {
    mySpawn.setDefault(mySpawn.simple(0, '{ not valid JSON'));

    try {
      await command.getConfig('foo');
      expect(false).to.equal('should not reach this point!');
    } catch (error) {
      // good
    }
  });
});
