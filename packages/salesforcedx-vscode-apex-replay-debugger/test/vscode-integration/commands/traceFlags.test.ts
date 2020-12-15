/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { TraceFlags } from '../../../src/commands/traceFlags';

const $$ = testSetup();

describe('Trace Flags', () => {
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sb: SinonSandbox;
  let flags: TraceFlags;
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
    flags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: 'abcd' }] });
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

    const ensure = await flags.ensureTraceFlags();

    expect(ensure).to.equal(true);
    expect(queryStub.callCount, 'Query stub called').to.equal(1);
    expect(toolingQueryStub.callCount, 'Tooling stub called').to.equal(1);

    expect(toolingUpdateStub.callCount, 'Tooling update').to.equal(2);

    let updateArgs = toolingUpdateStub.getCall(0).args;
    expect(updateArgs[0]).to.equal('DebugLevel');
    expect(updateArgs[1].Id).to.equal('00A123456');
    expect(updateArgs[1].ApexCode).to.equal('FINEST');
    expect(updateArgs[1].Visualforce).to.equal('FINER');

    updateArgs = toolingUpdateStub.getCall(1).args;
    expect(updateArgs[0]).to.equal('TraceFlag');
    expect(updateArgs[1].Id).to.equal('1234');
    expect(updateArgs[1].StartDate).to.equal('');
    const expDate = new Date(updateArgs[1].ExpirationDate);
    expect(expDate.getTime() - currDate).to.be.greaterThan(60000 * 29);

    expect(toolingCreateStub.called).to.equal(false);
  });

  it('should create a new trace flag', async () => {
    const currDate = new Date().valueOf();
    flags = new TraceFlags(mockConnection);
    queryStub = sb.stub(mockConnection, 'query');
    toolingCreateStub = sb.stub(mockConnection.tooling, 'create');
    toolingQueryStub = sb.stub(mockConnection.tooling, 'query');
    toolingUpdateStub = sb.stub(mockConnection.tooling, 'update');

    queryStub
      .onFirstCall()
      .resolves({ done: true, totalSize: 1, records: [{ Id: 'abcd' }] });
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

    const ensure = await flags.ensureTraceFlags();

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
    expect(createArgs[1].tracedentityid).to.equal('abcd');
    expect(createArgs[1].logtype).to.equal('developer_log');
    expect(createArgs[1].debuglevelid).to.equal('aBcDeF');
    expect(createArgs[1].StartDate).to.equal('');
    const expDate = new Date(createArgs[1].ExpirationDate);
    expect(expDate.getTime() - currDate).to.be.greaterThan(60000 * 29);
  });
});
