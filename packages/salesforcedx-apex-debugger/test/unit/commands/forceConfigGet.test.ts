/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxCommandBuilder } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ForceConfigGet } from '../../../src/commands/forceConfigGet';
import childProcess = require('child_process');

describe('force:config:get', () => {
  const mockSpawn = require('mock-spawn');
  let command: ForceConfigGet;
  let origSpawn: any, mySpawn: any;
  let cmdWithArgSpy: sinon.SinonSpy, cmdBuildSpy: sinon.SinonSpy;

  beforeEach(() => {
    command = new ForceConfigGet();
    origSpawn = childProcess.spawn;
    mySpawn = mockSpawn();
    childProcess.spawn = mySpawn;
    cmdWithArgSpy = sinon.spy(SfdxCommandBuilder.prototype, 'withArg');
    cmdBuildSpy = sinon.spy(SfdxCommandBuilder.prototype, 'build');
  });

  afterEach(() => {
    childProcess.spawn = origSpawn;
    cmdWithArgSpy.restore();
    cmdBuildSpy.restore();
  });

  it('Should return config successfully', async () => {
    const config = {
      key1: 'val1',
      key2: 'key2'
    };
    mySpawn.setDefault(
      mySpawn.simple(0, `{ "status": 0, "result": ${JSON.stringify(config)}}`)
    );

    const cmdOutput = await command.getConfig('foo', 'key1', 'key2');

    expect(cmdOutput).to.deep.equal(config);
    expect(cmdWithArgSpy.calledTwice).to.equal(true);
    expect(cmdWithArgSpy.getCall(0).args).to.have.same.members([
      'force:config:get'
    ]);
    expect(cmdWithArgSpy.getCall(1).args).to.have.same.members(['key1']);
    expect(cmdWithArgSpy.getCall(2).args).to.have.same.members(['key2']);
    expect(cmdWithArgSpy.getCall(3).args).to.have.same.members(['--json']);
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
    } catch (error) {
      expect(error).to.equal('{ not valid JSON');
    }
  });
});
