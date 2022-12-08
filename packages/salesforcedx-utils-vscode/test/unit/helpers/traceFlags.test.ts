/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { fail } from 'assert';
import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { TraceFlags } from '../../../src/helpers';
import { nls } from '../../../src/messages';
import { vscodeStub } from '../commands/mocks';

// const { TraceFlags } = proxyquire.noCallThru()('../../../src/helpers', {
//   vscode: vscodeStub
// });

const $$ = testSetup();

describe('Trace Flags', () => {
  const testData = new MockTestOrgData();
  const USER_ID = 'abcd';
  let mockConnection: Connection;
  let sb: SinonSandbox;
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

  it("should verify that createTraceFlag() is called when a trace flag doesn't exist", async () => {
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');

    const traceFlags = new TraceFlags(mockConnection);
    const createTraceFlagSpy = sb.spy(
      TraceFlags.prototype as any,
      'createTraceFlag'
    );

    queryStub.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [{ Id: USER_ID }]
    });
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

    await traceFlags.ensureTraceFlags();
    expect(createTraceFlagSpy.callCount).to.equal(1);
  });

  it('should verify that createTraceFlag() is not called when a trace flag exist', async () => {
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');

    const traceFlags = new TraceFlags(mockConnection);
    const createTraceFlagSpy = sb.spy(
      TraceFlags.prototype as any,
      'createTraceFlag'
    );

    queryStub.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [{ Id: USER_ID }]
    });
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
          DebugLevel: {
            ApexCode: '',
            VisualForce: ''
          }
        }
      ]
    });
    toolingUpdateStub
      .onFirstCall()
      .resolves({ success: true })
      .onSecondCall()
      .resolves({ success: true });

    await traceFlags.ensureTraceFlags();
    expect(createTraceFlagSpy.callCount).to.equal(0);
  });

  it('should raise error for missing username', async () => {
    const traceFlags = new TraceFlags(mockConnection);
    sb.stub(mockConnection, 'getUsername').returns(undefined);

    try {
      await traceFlags.ensureTraceFlags();
      fail('Expected an error');
    } catch (err) {
      if (err instanceof Error) {
        expect(err.message).to.equal(nls.localize('error_no_default_username'));
      } else {
        fail('Expected an error');
      }
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
      if (err instanceof Error) {
        expect(err.message).to.equal(nls.localize('trace_flags_unknown_user'));
      } else {
        fail('Expected an error');
      }
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
      if (err instanceof Error) {
        expect(err.message).to.equal(
          nls.localize('trace_flags_failed_to_create_debug_level')
        );
      } else {
        fail('Expected an error');
      }
    }
  });
});
