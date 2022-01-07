/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { fail } from 'assert';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as proxyquire from 'proxyquire';
import { vscodeStub } from './mocks';
import { nls } from '../../../src/messages';

const { TraceFlags } = proxyquire.noCallThru()(
  '../../../src/commands',
  {
    vscode: vscodeStub
  }
);

const $$ = testSetup();

describe('Trace Flags', () => {
  const testData = new MockTestOrgData();
  const USER_ID = 'abcd';
  let sb: SinonSandbox;

  let mockConnection: Connection;
  let queryStub: SinonStub;
  let toolingCreateStub: SinonStub;
  let toolingQueryStub: SinonStub;
  let toolingUpdateStub: SinonStub;

  beforeEach(async () => {
    sb = createSandbox();

    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });

    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });

    sb.stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);
  });

  afterEach(() => {
    sb.restore();
  });

  it('should validate an existing trace flag', async () => {
    const currDate = new Date().valueOf();
    const traceFlags = new TraceFlags(mockConnection);

    queryStub = sb.stub(mockConnection, 'query');
    queryStub
      .onFirstCall()
      .resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: USER_ID
          }
        ]
      });

    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');

    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingQueryStub
      .onFirstCall()
      .resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: '1234',
            DebugLevelId: '00A123456',
            LogType: 'developer_log',
            StartDate: null,
            ExpirationDate: null,
            DebugLevel: { ApexCode: '', VisualForce: '' }
          }
        ]
      });

    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');
    toolingUpdateStub
      .onFirstCall()
      .resolves({
        success: true
      })
      .onSecondCall()
      .resolves({
        success: true
      });

    const ensure = await traceFlags.ensureTraceFlags();
    expect(ensure).to.equal(true);
    expect(queryStub.callCount, 'Query stub called').to.equal(1);
    expect(toolingQueryStub.callCount, 'Tooling stub called').to.equal(1);
    const queryArgs = toolingQueryStub.getCall(0).args;
    expect(queryArgs[0]).to.contain(`TracedEntityId='${USER_ID}'`);

    expect(toolingUpdateStub.callCount, 'Tooling update').to.equal(2);

    let updateArgs = toolingUpdateStub.getCall(0).args;
    expect(updateArgs[0]).to.equal('DebugLevel');
    expect(updateArgs[1].Id).to.equal('00A123456');
    expect(updateArgs[1].ApexCode).to.equal('FINEST');
    expect(updateArgs[1].Visualforce).to.equal('FINER');

    updateArgs = toolingUpdateStub.getCall(1).args;
    expect(updateArgs[0]).to.equal('TraceFlag');
    expect(updateArgs[1].Id).to.equal('1234');
    expect(updateArgs[1].StartDate).to.not.equal('');
    const expDate = new Date(updateArgs[1].ExpirationDate);
    expect(expDate.getTime() - currDate).to.be.greaterThan(60000 * 29);

    expect(toolingCreateStub.called).to.equal(false);
  });

  it('should create a new trace flag', async () => {
    const currDate = new Date().valueOf();
    const traceFlags = new TraceFlags(mockConnection);

    queryStub = sb.stub(mockConnection, 'query');
    queryStub
      .onFirstCall()
      .resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: USER_ID
          }
        ]
      });

    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingCreateStub
      .onFirstCall()
      .resolves({
        success: true,
        id: 'aBcDeF'
      })
      .onSecondCall()
      .resolves({
        success: true,
        id: '01020304'
      });

    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingQueryStub
      .onFirstCall()
      .resolves({
        done: true,
        totalSize: 0,
        records: []
      });

    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');

    const ensure = await traceFlags.ensureTraceFlags();
    expect(ensure).to.equal(true);
    expect(queryStub.callCount, 'Query stub called').to.equal(1);
    expect(toolingQueryStub.callCount, 'Tooling stub called').to.equal(1);

    let createArgs = toolingCreateStub.getCall(0).args;
    expect(createArgs[0]).to.equal('DebugLevel');
    expect(createArgs[1].developerName).to.contain('ReplayDebugger');
    expect(createArgs[1].MasterLabel).to.contain('ReplayDebugger');
    expect(createArgs[1].ApexCode).to.equal('FINEST');
    expect(createArgs[1].Visualforce).to.equal('FINER');

    createArgs = toolingCreateStub.getCall(1).args;
    expect(createArgs[0]).to.equal('TraceFlag');
    expect(createArgs[1].tracedentityid).to.equal(USER_ID);
    expect(createArgs[1].logtype).to.equal('developer_log');
    expect(createArgs[1].debuglevelid).to.equal('aBcDeF');
    expect(createArgs[1].StartDate).to.not.equal('');
    const expDate = new Date(createArgs[1].ExpirationDate);
    expect(expDate.getTime() - currDate).to.be.greaterThan(60000 * 29);
  });

  it('should raise error for missing username', async () => {
    const traceFlags = new TraceFlags(mockConnection);
    sb.stub(mockConnection, 'getUsername')
      .returns(undefined);

    try {
      await traceFlags.ensureTraceFlags();
      fail('Expected an error');
    } catch (err) {
      expect(err.message).to.equal(nls.localize('error_no_default_username'));
    }
  });

  it('should raise error for unknown user', async () => {
    const traceFlags = new TraceFlags(mockConnection);
    sb.stub(mockConnection, 'query')
      .onFirstCall()
      .resolves({
        done: true,
        totalSize: 0,
        records: []
      });

    try {
      await traceFlags.ensureTraceFlags();
      fail('Expected an error');
    } catch (err) {
      expect(err.message).to.equal(nls.localize('trace_flags_unknown_user'));
    }
  });

  it('should raise error on failure to create debug level', async () => {
    const traceFlags = new TraceFlags(mockConnection);

    queryStub = sb.stub(mockConnection, 'query');
    queryStub
      .onFirstCall()
      .resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: USER_ID
          }
        ]
      });

    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingCreateStub
      .onFirstCall()
      .resolves({
        success: false,
        id: undefined
      });

    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingQueryStub
      .onFirstCall()
      .resolves({
        done: true,
        totalSize: 0,
        records: []
      });

    try {
      await traceFlags.ensureTraceFlags();
      fail('Expected to raise an error');
    } catch (err) {
      expect(err.message).to.equal(
        nls.localize('trace_flags_failed_to_create_debug_level')
      );
    }
  });
});









/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *

import { expect } from 'chai';
import { fail } from 'assert';
import * as proxyquire from 'proxyquire';
import { Subject } from 'rxjs/Subject';
import { assert, match, SinonStub, spy, stub } from 'sinon';
import {
  CliCommandExecutor,
  CommandExecution,
  SfdxCommandBuilder
} from '../../../src/cli';
import { nls } from '../../../src/messages';
import { vscodeStub } from './mocks';




import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { createSandbox, SinonSandbox } from 'sinon';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';



interface Progress<T> {
  report(value: T): void;
}



// import { TraceFlags } from '../../../src/commands';
const { TraceFlags } = proxyquire.noCallThru()(
  '../../../src/commands',
  {
    vscode: vscodeStub
  }
);


const $$ = testSetup();



describe('Trace Flags', () => {
  const mockTestOrgData = new MockTestOrgData();
  const USER_ID = 'abcd';

  let sb: SinonSandbox;


  let mockConnection: Connection;
  // let traceFlags;
  let queryStub: SinonStub;
  let toolingCreateStub: SinonStub;
  let toolingQueryStub: SinonStub;
  let toolingUpdateStub: SinonStub;



  beforeEach(async () => {
    sb = createSandbox();

    const config = await mockTestOrgData.getConfig();

    $$.setConfigStubContents('AuthInfoConfig', {
      contents: config
    });

    const authInfo = await AuthInfo.create({
      username: mockTestOrgData.username
    });

    mockConnection = await Connection.create({
      authInfo
    });

    sb.stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(mockTestOrgData.username);
  });

  afterEach(() => {
    sb.restore();
  });


  /*
  it('Should do something', async () => {
    mockConnection.getUsername = () => undefined;

    try {
      const traceFlags = new TraceFlags(mockConnection);
      const result = await traceFlags.ensureTraceFlags();
      throw new Error('ensureTraceFlags() did not throw an exception when the username is not present');
    } catch(e) {
      expect(e.message).to.equal(nls.localize('error_no_default_username'));
    }
  });
  */



  /*
  it('Should do something 2', async () => {
    queryStub = sb.stub(mockConnection, 'query');
    queryStub
      .onFirstCall()
      .resolves({
        done: true,
        totalSize: 0,
        records: []
      });

    try {
      const traceFlags = new TraceFlags(mockConnection);
      const result = await traceFlags.ensureTraceFlags();
      throw new Error('ensureTraceFlags() did not throw an exception when the user is unknown');
    } catch(e) {
      expect(e.message).to.equal(nls.localize('trace_flags_unknown_user'));
    }
  });
  */





  /*
  it('Should do something 3', async () => {

    // happy path

    debugger;

    queryStub = sb.stub(mockConnection, 'query');
    queryStub
      .onFirstCall()
      .resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: USER_ID
          }
        ]
      });

    // toolingCreateStub = sb.stub(mockConnection.tooling, 'create');

    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingQueryStub
      .onFirstCall()
      .resolves({
        done: true,
        totalSize: 1,
        records: [
          {
            Id: '1234',
            DebugLevelId: '00A123456',
            LogType: 'developer_log',
            StartDate: null,
            ExpirationDate: null,
            DebugLevel: {
              ApexCode: '',
              VisualForce: ''
            }
          }
        ]
      });

    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');
    toolingUpdateStub
      .onFirstCall()
      .resolves({ success: true })
      .onSecondCall()
      .resolves({ success: true });

    debugger;



    // try {
    //   const traceFlags = new TraceFlags(mockConnection);
    //   const result = await traceFlags.ensureTraceFlags();
    //   throw new Error('ensureTraceFlags() did not throw an exception when the user is unknown');
    // } catch(e) {
    //   expect(e.message).to.equal(nls.localize('trace_flags_unknown_user'));
    // }


    const traceFlags = new TraceFlags(mockConnection);
    const result = await traceFlags.ensureTraceFlags();
    expect(result).to.equal(true);



    // expect(1).to.equal(1);
  });
  *


  it('should validate an existing trace flag', async () => {
    const currDate = new Date().valueOf();
    const traceFlags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '1234',
          DebugLevelId: '00A123456',
          LogType: 'developer_log',
          StartDate: null,
          ExpirationDate: null,
          DebugLevel: { ApexCode: '', VisualForce: '' }
        }
      ]
    });
    toolingUpdateStub
      .onFirstCall()
      .resolves({ success: true })
      .onSecondCall()
      .resolves({ success: true });

    const ensure = await traceFlags.ensureTraceFlags();

    expect(ensure).to.equal(true);
    expect(queryStub.callCount, 'Query stub called').to.equal(1);
    expect(toolingQueryStub.callCount, 'Tooling stub called').to.equal(1);
    const queryArgs = toolingQueryStub.getCall(0).args;
    expect(queryArgs[0]).to.contain(`TracedEntityId='${USER_ID}'`);

    expect(toolingUpdateStub.callCount, 'Tooling update').to.equal(2);

    let updateArgs = toolingUpdateStub.getCall(0).args;
    expect(updateArgs[0]).to.equal('DebugLevel');
    expect(updateArgs[1].Id).to.equal('00A123456');
    expect(updateArgs[1].ApexCode).to.equal('FINEST');
    expect(updateArgs[1].Visualforce).to.equal('FINER');

    updateArgs = toolingUpdateStub.getCall(1).args;
    expect(updateArgs[0]).to.equal('TraceFlag');
    expect(updateArgs[1].Id).to.equal('1234');
    expect(updateArgs[1].StartDate).to.not.equal('');
    const expDate = new Date(updateArgs[1].ExpirationDate);
    expect(expDate.getTime() - currDate).to.be.greaterThan(60000 * 29);

    expect(toolingCreateStub.called).to.equal(false);
  });


  it('should create a new trace flag', async () => {
    const currDate = new Date().valueOf();
    const traceFlags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    });

    toolingCreateStub
      .onFirstCall()
      .resolves({ success: true, id: 'aBcDeF' })
      .onSecondCall()
      .resolves({ success: true, id: '01020304' });

    const ensure = await traceFlags.ensureTraceFlags();

    expect(ensure).to.equal(true);
    expect(queryStub.callCount, 'Query stub called').to.equal(1);
    expect(toolingQueryStub.callCount, 'Tooling stub called').to.equal(1);

    let createArgs = toolingCreateStub.getCall(0).args;
    expect(createArgs[0]).to.equal('DebugLevel');
    expect(createArgs[1].developerName).to.contain('ReplayDebugger');
    expect(createArgs[1].MasterLabel).to.contain('ReplayDebugger');
    expect(createArgs[1].ApexCode).to.equal('FINEST');
    expect(createArgs[1].Visualforce).to.equal('FINER');

    createArgs = toolingCreateStub.getCall(1).args;
    expect(createArgs[0]).to.equal('TraceFlag');
    expect(createArgs[1].tracedentityid).to.equal(USER_ID);
    expect(createArgs[1].logtype).to.equal('developer_log');
    expect(createArgs[1].debuglevelid).to.equal('aBcDeF');
    expect(createArgs[1].StartDate).to.not.equal('');
    const expDate = new Date(createArgs[1].ExpirationDate);
    expect(expDate.getTime() - currDate).to.be.greaterThan(60000 * 29);
  });

  it('should raise error for missing username', async () => {
    const traceFlags = new TraceFlags(mockConnection);
    sb.stub(mockConnection, 'getUsername').returns(undefined);

    try {
      await traceFlags.ensureTraceFlags();
      fail('Expected an error');
    } catch (err) {
      expect(err.message).to.equal(nls.localize('error_no_default_username'));
    }
  });

  it('should raise error for unknown user', async () => {
    const traceFlags = new TraceFlags(mockConnection);
    sb.stub(mockConnection, 'query')
      .onFirstCall()
      .resolves({ done: true, totalSize: 0, records: [] });

    try {
      await traceFlags.ensureTraceFlags();
      fail('Expected an error');
    } catch (err) {
      expect(err.message).to.equal(nls.localize('trace_flags_unknown_user'));
    }
  });

  it('should raise error on failure to create debug level', async () => {
    const traceFlags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: USER_ID }] });
    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    });
    toolingCreateStub.onFirstCall().resolves({ success: false, id: undefined });

    try {
      await traceFlags.ensureTraceFlags();
      fail('Expected to raise an error');
    } catch (err) {
      expect(err.message).to.equal(
        nls.localize('trace_flags_failed_to_create_debug_level')
      );
    }
  });

});
*/