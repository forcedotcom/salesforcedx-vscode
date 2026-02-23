/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { assert, createSandbox, SinonSandbox } from 'sinon';
import { nls } from '../../src/i18n';
import { TestCategory, TestLevel, TestService } from '../../src/tests';
import * as utils from '../../src/tests/utils';

let mockConnection: Connection;
const testData = new MockTestOrgData();

describe('Build async payload', async () => {
  const $$ = new TestContext();

  let sandboxStub: SinonSandbox;
  let testService: TestService;
  beforeEach(async () => {
    sandboxStub = createSandbox();
    await $$.stubAuths(testData);
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    sandboxStub
      .stub(Connection.prototype, 'retrieveMaxApiVersion')
      .resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sandboxStub
      .stub(mockConnection, 'instanceUrl')
      .get(() => 'https://na139.salesforce.com');
    testService = new TestService(mockConnection);
  });

  afterEach(async () => {
    sandboxStub.restore();
  });

  it('should build async payload for tests without namespace', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      'myClass.myTest'
    );

    expect(payload).to.deep.equal({
      tests: [{ className: 'myClass', testMethods: ['myTest'] }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.calledOnce).to.be.true;
  });

  it('should build async payload for test with namespace when org returns 0 namespaces', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      'myNamespace.myClass'
    );

    expect(payload).to.deep.equal({
      tests: [{ className: 'myNamespace', testMethods: ['myClass'] }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.calledOnce).to.be.true;
  });

  it('should build async payload for tests with namespace', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([{ installedNs: false, namespace: 'myNamespace' }]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      'myNamespace.myClass'
    );

    expect(payload).to.deep.equal({
      tests: [
        {
          className: 'myNamespace.myClass'
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // Still queries namespaces to distinguish namespace.Class from Class.method
    expect(namespaceStub.calledOnce).to.be.true;
  });

  it('should build async payload for tests with namespace from installed package', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([{ installedNs: true, namespace: 'myNamespace' }]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      'myNamespace.myClass'
    );

    expect(payload).to.deep.equal({
      tests: [
        {
          className: 'myNamespace.myClass'
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // Still queries namespaces to distinguish namespace.Class from Class.method
    expect(namespaceStub.calledOnce).to.be.true;
  });

  it('should only query for namespaces once when multiple tests are specified', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([{ installedNs: false, namespace: 'myNamespace' }]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      'myNamespace.myClass,myNamespace.mySecondClass'
    );

    expect(payload).to.deep.equal({
      tests: [
        {
          className: 'myNamespace.myClass'
        },
        {
          className: 'myNamespace.mySecondClass'
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.calledOnce).to.be.true;
  });

  it('should build async payload for tests with 3 parts', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      'myNamespace.myClass.myTest'
    );

    expect(payload).to.deep.equal({
      tests: [
        {
          className: 'myNamespace.myClass',
          testMethods: ['myTest']
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should build async payload for tests with only classname', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      'myClass'
    );
    expect(payload).to.deep.equal({
      tests: [{ className: 'myClass' }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should build async payload for tests with only classid', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      '01p4x00000KWt3T'
    );
    expect(payload).to.deep.equal({
      tests: [{ classId: '01p4x00000KWt3T' }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should build async payload for class with only classname', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'myClass'
    );
    expect(payload).to.deep.equal({
      tests: [{ className: 'myClass' }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should build async payload for class specified by id', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      '01p4x00000KWt3TAAT'
    );
    expect(payload).to.deep.equal({
      tests: [{ classId: '01p4x00000KWt3TAAT' }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should build async payload for class specified by id with incorrect number of digits', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      '01p4x00000KWt3TAATP'
    );
    expect(payload).to.deep.equal({
      tests: [{ className: '01p4x00000KWt3TAATP' }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should build async payload for class with namespace', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([{ installedNs: false, namespace: 'myNamespace' }]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'myNamespace.myClass'
    );
    expect(payload).to.deep.equal({
      tests: [{ className: 'myNamespace.myClass' }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // No longer queries namespaces for class-only runs
    expect(namespaceStub.called).to.be.false;
  });

  it('should build async payload for suite', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      undefined,
      'mySuite'
    );
    expect(payload).to.deep.equal({
      suiteNames: 'mySuite',
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should include skipCodeCoverage in async payload when tests are provided', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      'myClass.myTest',
      undefined,
      undefined,
      undefined,
      true
    );

    expect(payload).to.deep.equal({
      tests: [{ className: 'myClass', testMethods: ['myTest'] }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: true
    });
    expect(namespaceStub.calledOnce).to.be.true;
  });

  it('should include skipCodeCoverage in async payload when classNames are provided', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'myClass',
      undefined,
      undefined,
      true
    );

    expect(payload).to.deep.equal({
      tests: [{ className: 'myClass' }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: true
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should include skipCodeCoverage in async payload when suiteNames are provided', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      undefined,
      'mySuite',
      undefined,
      true
    );

    expect(payload).to.deep.equal({
      suiteNames: 'mySuite',
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: true
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should include skipCodeCoverage as false in async payload when skipCodeCoverage is false', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      'myClass.myTest',
      undefined,
      undefined,
      undefined,
      false
    );

    expect(payload).to.deep.equal({
      tests: [{ className: 'myClass', testMethods: ['myTest'] }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.calledOnce).to.be.true;
  });

  it('should include skipCodeCoverage in async payload when classNames with category are provided', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    // Mock the buildClassPayloadForFlow method
    const mockFlowPayload = {
      testLevel: TestLevel.RunSpecifiedTests,
      tests: [{ className: 'FlowTestClass' }],
      skipCodeCoverage: true
    };
    sandboxStub
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .stub(testService as any, 'buildClassPayloadForFlow')
      .resolves(mockFlowPayload);

    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'FlowTestClass',
      undefined,
      TestCategory.Flow,
      true
    );

    expect(payload).to.deep.equal(mockFlowPayload);
    expect(payload).to.have.property('skipCodeCoverage', true);
    expect(namespaceStub.notCalled).to.be.true;
  });
});

describe('Build sync payload', async () => {
  const $$ = new TestContext();
  let sandboxStub: SinonSandbox;
  let testSrv: TestService;
  beforeEach(async () => {
    sandboxStub = createSandbox();
    await $$.stubAuths(testData);
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    sandboxStub
      .stub(Connection.prototype, 'retrieveMaxApiVersion')
      .resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sandboxStub
      .stub(mockConnection, 'instanceUrl')
      .get(() => 'https://na139.salesforce.com');
    testSrv = new TestService(mockConnection);
  });

  afterEach(async () => {
    sandboxStub.restore();
  });

  it('should build synchronous payload for tests without namespace', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([{ installedNs: false, namespace: 'myNamespace' }]);
    const payload = await testSrv.buildSyncPayload(
      TestLevel.RunSpecifiedTests,
      'myClass.myTest'
    );

    expect(payload).to.deep.equal({
      tests: [{ className: 'myClass', testMethods: ['myTest'] }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.calledOnce).to.be.true;
  });

  it('should build synchronous payload for tests with namespace', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([{ installedNs: false, namespace: 'myNamespace' }]);
    const payload = await testSrv.buildSyncPayload(
      TestLevel.RunSpecifiedTests,
      'myNamespace.myClass.myTest'
    );

    expect(payload).to.deep.equal({
      tests: [
        {
          className: 'myNamespace.myClass',
          testMethods: ['myTest']
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should build synchronous payload for class without namespace', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    const payload = await testSrv.buildSyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'myClass'
    );

    expect(payload).to.deep.equal({
      tests: [{ className: 'myClass' }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.notCalled).to.be.true;
  });

  it('should build synchronous payload for class with namespace', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([{ installedNs: false, namespace: 'myNamespace' }]);
    const payload = await testSrv.buildSyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'myNamespace.myClass'
    );

    expect(payload).to.deep.equal({
      tests: [{ className: 'myNamespace.myClass' }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // No longer queries namespaces for class-only runs
    expect(namespaceStub.called).to.be.false;
  });

  it('should throw an error if multiple classes are specified', async () => {
    try {
      await testSrv.buildSyncPayload(
        TestLevel.RunSpecifiedTests,
        'myNamespace.myClass.myTest, myNamespace.otherClass.otherTest'
      );
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal(nls.localize('syncClassErr'));
    }
  });

  it('should throw an error if no tests or classes are specified', async () => {
    try {
      await testSrv.buildSyncPayload(TestLevel.RunLocalTests);
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal(nls.localize('payloadErr'));
    }
  });

  it('should include skipCodeCoverage in sync payload when tests are provided', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([{ installedNs: false, namespace: 'myNamespace' }]);
    const payload = await testSrv.buildSyncPayload(
      TestLevel.RunSpecifiedTests,
      'myClass.myTest',
      undefined,
      undefined,
      true
    );

    expect(payload).to.deep.equal({
      tests: [{ className: 'myClass', testMethods: ['myTest'] }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: true
    });
    expect(namespaceStub.calledOnce).to.be.true;
  });

  it('should include skipCodeCoverage as false in sync payload when skipCodeCoverage is false', async () => {
    const namespaceStub = sandboxStub
      .stub(utils, 'queryNamespaces')
      .resolves([{ installedNs: false, namespace: 'myNamespace' }]);
    const payload = await testSrv.buildSyncPayload(
      TestLevel.RunSpecifiedTests,
      'myClass.myTest',
      undefined,
      undefined,
      false
    );

    expect(payload).to.deep.equal({
      tests: [{ className: 'myClass', testMethods: ['myTest'] }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.calledOnce).to.be.true;
  });

  it('should include skipCodeCoverage in sync payload when classnames with category are provided', async () => {
    const namespaceStub = sandboxStub.stub(utils, 'queryNamespaces');
    // Mock the buildClassPayloadForFlow method
    const mockFlowPayload = {
      testLevel: TestLevel.RunSpecifiedTests,
      tests: [{ className: 'FlowTestClass' }],
      skipCodeCoverage: true
    };
    sandboxStub
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .stub(testSrv as any, 'buildClassPayloadForFlow')
      .resolves(mockFlowPayload);

    const payload = await testSrv.buildSyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'FlowTestClass',
      TestCategory.Flow,
      true
    );

    expect(payload).to.deep.equal(mockFlowPayload);
    expect(payload).to.have.property('skipCodeCoverage', true);
    expect(namespaceStub.notCalled).to.be.true;
  });
});
