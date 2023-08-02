/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { fail } from 'assert';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { TraceFlagsRemover } from '../../../src';

describe('Trace Flags Remover', () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sb: SinonSandbox;

  beforeEach(async () => {
    sb = $$.SANDBOX;
    console.log('....after sb.....');
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    await $$.stubAliases({ myAlias: testData.username });
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

  it('should validate that a connection must be present when created', () => {
    console.log('within first.....');
    try {
      TraceFlagsRemover.resetInstance();
      // here we're testing an unreachable state as it won't compile without the cast to any
      TraceFlagsRemover.getInstance(undefined as any);
      expect.fail(
        'TraceFlagsRemover.getInstance() should have thrown an error'
      );
    } catch (err) {
      if (err instanceof Error) {
        expect(err.message).to.equal(
          'connection passed to TraceFlagsRemover is invalid'
        );
      } else {
        fail('Expected an error');
      }
    }
  });

  it('should validate that an instance is created when a connection is passed', () => {
    TraceFlagsRemover.resetInstance();
    const instance = TraceFlagsRemover.getInstance(mockConnection);
    expect(instance).to.not.equal(undefined);
  });

  it('should validate that connection.tooling.delete is called when a new trace flag is added', async () => {
    let toolingDeleteStub: SinonStub;
    toolingDeleteStub = sb.stub(mockConnection.tooling, 'delete');

    TraceFlagsRemover.resetInstance();
    const instance = TraceFlagsRemover.getInstance(mockConnection);
    instance.addNewTraceFlagId('123');

    await instance.removeNewTraceFlags();

    expect(toolingDeleteStub.called).to.equal(true);
  });

  it('should validate that connection.tooling.delete is not called when a trace flag already exists', async () => {
    let toolingDeleteStub: SinonStub;
    toolingDeleteStub = sb.stub(mockConnection.tooling, 'delete');

    // Create an instance, but don't add any records.
    TraceFlagsRemover.resetInstance();
    const instance = TraceFlagsRemover.getInstance(mockConnection);

    await instance.removeNewTraceFlags();

    // Now validate that since no records were added, that connection.tooling.delete was not called.
    expect(toolingDeleteStub.called).to.equal(false);
  });

  it('should delete multiple trace flags', async () => {
    let toolingDeleteStub: SinonStub;
    toolingDeleteStub = sb.stub(mockConnection.tooling, 'delete');

    TraceFlagsRemover.resetInstance();
    const instance = TraceFlagsRemover.getInstance(mockConnection);
    instance.addNewTraceFlagId('123');
    instance.addNewTraceFlagId('456');
    instance.addNewTraceFlagId('789');

    await instance.removeNewTraceFlags();

    expect(toolingDeleteStub.called).to.equal(true);
  });
});
