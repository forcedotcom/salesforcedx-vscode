/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { TestLevel, TestService } from '../../src/tests';
import * as utils from '../../src/tests/utils';

let mockConnection: Connection;
const testData = new MockTestOrgData();

describe('buildAsyncClassPayload with namespaces', () => {
  const $$ = new TestContext();
  let testService: TestService;

  beforeEach(async () => {
    await $$.stubAuths(testData);
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    $$.SANDBOX.stub(mockConnection, 'instanceUrl').get(() => 'https://na139.salesforce.com');
    testService = new TestService(mockConnection);
  });

  it('should build async payload for single class without namespace', async () => {
    const namespaceStub = $$.SANDBOX.stub(utils, 'queryNamespaces');
    const payload = await testService.buildAsyncPayload(TestLevel.RunSpecifiedTests, undefined, 'MyTestClass');

    expect(payload).toEqual({
      tests: [{ className: 'MyTestClass' }],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    expect(namespaceStub.notCalled).toBe(true);
  });

  it('should build async payload for single class with org namespace', async () => {
    const namespaceStub = $$.SANDBOX.stub(utils, 'queryNamespaces').resolves([
      { installedNs: false, namespace: 'myNamespace' }
    ]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'myNamespace.MyTestClass'
    );

    expect(payload).toEqual({
      tests: [
        {
          className: 'myNamespace.MyTestClass'
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // No longer queries namespaces for class-only runs
    expect(namespaceStub.called).toBe(false);
  });

  it('should build async payload for single class with installed package namespace', async () => {
    const namespaceStub = $$.SANDBOX.stub(utils, 'queryNamespaces').resolves([
      { installedNs: true, namespace: 'CodeBuilder' }
    ]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'CodeBuilder.ApplicationTest'
    );

    expect(payload).toEqual({
      tests: [
        {
          className: 'CodeBuilder.ApplicationTest'
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // No longer queries namespaces for class-only runs
    expect(namespaceStub.called).toBe(false);
  });

  it('should build async payload for multiple classes with mixed namespaces', async () => {
    const namespaceStub = $$.SANDBOX.stub(utils, 'queryNamespaces').resolves([
      { installedNs: false, namespace: 'orgNs' },
      { installedNs: true, namespace: 'installedPkg' }
    ]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'orgNs.TestClass1,installedPkg.TestClass2,TestClass3'
    );

    expect(payload).toEqual({
      tests: [
        {
          className: 'orgNs.TestClass1'
        },
        {
          className: 'installedPkg.TestClass2'
        },
        {
          className: 'TestClass3'
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // No longer queries namespaces for class-only runs
    expect(namespaceStub.called).toBe(false);
  });

  it('should build async payload for class with namespace not in org', async () => {
    const namespaceStub = $$.SANDBOX.stub(utils, 'queryNamespaces').resolves([
      { installedNs: false, namespace: 'differentNs' }
    ]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'unknownNs.MyTestClass'
    );

    // When namespace is not found, treat the whole thing as a class name
    expect(payload).toEqual({
      tests: [
        {
          className: 'unknownNs.MyTestClass'
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // No longer queries namespaces for class-only runs
    expect(namespaceStub.called).toBe(false);
  });

  it('should only query namespaces once for multiple classes', async () => {
    const namespaceStub = $$.SANDBOX.stub(utils, 'queryNamespaces').resolves([
      { installedNs: false, namespace: 'myNs' }
    ]);
    const payload = await testService.buildAsyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'myNs.Class1,myNs.Class2,myNs.Class3'
    );

    expect(payload).toEqual({
      tests: [
        {
          className: 'myNs.Class1'
        },
        {
          className: 'myNs.Class2'
        },
        {
          className: 'myNs.Class3'
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // No longer queries namespaces for class-only runs
    expect(namespaceStub.called).toBe(false);
  });
});

describe('buildSyncPayload with class namespaces', () => {
  const $$ = new TestContext();
  let testService: TestService;

  beforeEach(async () => {
    await $$.stubAuths(testData);
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    $$.SANDBOX.stub(mockConnection, 'instanceUrl').get(() => 'https://na139.salesforce.com');
    testService = new TestService(mockConnection);
  });
  it('should build sync payload for class with org namespace', async () => {
    const namespaceStub = $$.SANDBOX.stub(utils, 'queryNamespaces').resolves([
      { installedNs: false, namespace: 'myNs' }
    ]);
    const payload = await testService.buildSyncPayload(TestLevel.RunSpecifiedTests, undefined, 'myNs.MyTestClass');

    expect(payload).toEqual({
      tests: [
        {
          className: 'myNs.MyTestClass'
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // No longer queries namespaces for class-only runs
    expect(namespaceStub.called).toBe(false);
  });

  it('should build sync payload for class with installed package namespace', async () => {
    const namespaceStub = $$.SANDBOX.stub(utils, 'queryNamespaces').resolves([
      { installedNs: true, namespace: 'installedPkg' }
    ]);
    const payload = await testService.buildSyncPayload(
      TestLevel.RunSpecifiedTests,
      undefined,
      'installedPkg.MyTestClass'
    );

    expect(payload).toEqual({
      tests: [
        {
          className: 'installedPkg.MyTestClass'
        }
      ],
      testLevel: TestLevel.RunSpecifiedTests,
      skipCodeCoverage: false
    });
    // No longer queries namespaces for class-only runs
    expect(namespaceStub.called).toBe(false);
  });
});
