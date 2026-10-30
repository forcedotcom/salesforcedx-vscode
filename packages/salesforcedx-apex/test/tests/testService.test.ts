/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SinonStub } from 'sinon';
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import * as Effect from 'effect/Effect';
import { fail } from 'node:assert';
import { TestService } from '../../src';
import { getApexClassIds as getApexClassIdsOperation } from '../../src/effect/testSuites';

let mockConnection: Connection;
let toolingCreateStub: SinonStub;
let toolingQueryStub: SinonStub;
const testData = new MockTestOrgData();

const getApexClassIds = (connection: Connection, testClasses: string[]): Promise<string[]> =>
  Effect.runPromise(getApexClassIdsOperation(connection, testClasses));

describe('Apex Test Suites', () => {
  const $$ = new TestContext();
  beforeEach(async () => {
    await $$.stubAuths(testData);
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });

    toolingQueryStub = $$.SANDBOX.stub(mockConnection.tooling, 'query');
    toolingCreateStub = $$.SANDBOX.stub(mockConnection.tooling, 'create');
  });

  it('should retrieve apex class id for non-namespaced class', async () => {
    toolingQueryStub.resolves({ records: [{ Id: '01p000000000001' }] });

    const ids = await getApexClassIds(mockConnection, ['firstTestClass']);

    expect(ids).toEqual(['01p000000000001']);
    expect(toolingQueryStub.calledOnce).toBe(true);
    expect(toolingQueryStub.firstCall.args[0]).toContain("Name = 'firstTestClass'");
    expect(toolingQueryStub.firstCall.args[0]).toContain('NamespacePrefix = null');
  });

  it('should retrieve apex class id for namespaced class (ns.ShortName)', async () => {
    toolingQueryStub.resolves({ records: [{ Id: '01p000000000002' }] });

    const ids = await getApexClassIds(mockConnection, ['myns.FooTest']);

    expect(ids).toEqual(['01p000000000002']);
    expect(toolingQueryStub.firstCall.args[0]).toContain("Name = 'FooTest'");
    expect(toolingQueryStub.firstCall.args[0]).toContain("NamespacePrefix = 'myns'");
  });

  it('should retrieve apex class ids for multiple classes', async () => {
    toolingQueryStub
      .onFirstCall()
      .resolves({
        records: [{ Id: '01p000000000001' }]
      })
      .onSecondCall()
      .resolves({
        records: [{ Id: '01p000000000002' }]
      })
      .onThirdCall()
      .resolves({
        records: [{ Id: '01p000000000003' }]
      });

    const ids = await getApexClassIds(mockConnection, ['firstTestClass', 'secondTestClass', 'thirdTestClass']);

    expect(ids).toEqual(['01p000000000001', '01p000000000002', '01p000000000003']);
    expect(toolingQueryStub.calledThrice).toBe(true);
  });

  it('should retrieve 0 apex class ids when given 0 classes', async () => {
    toolingQueryStub.resolves({ records: [{ Id: '01p000000000001' }] });

    const ids = await getApexClassIds(mockConnection, []);

    expect(ids).toEqual([]);
    expect(toolingQueryStub.notCalled).toBe(true);
  });

  it('should throw an error if a given apex class does not exist', async () => {
    toolingQueryStub.resolves({ records: [] });

    await expect(getApexClassIds(mockConnection, ['MissingTest'])).rejects.toThrow('MissingTest');
  });

  it('should throw an error if suitename or suite id was not provided', async () => {
    try {
      const testService = new TestService(mockConnection);
      await testService.getTestsInSuite(undefined, undefined);
      fail();
    } catch (e) {
      expect(e.message).toBe('Must provide a suite name or suite id to retrieve test classes in suite');
      expect(toolingQueryStub.notCalled).toBe(true);
    }
  });

  it('should retrieve associated suite id if suitename is provided and return tests in suite', async () => {
    toolingQueryStub
      .onFirstCall()
      .resolves({ records: [{ Id: '05F000000000001' }] })
      .onSecondCall()
      .resolves({ records: [{ ApexClassId: '01p000000000005' }] });

    const testService = new TestService(mockConnection);
    const tests = await testService.getTestsInSuite('testSuite');

    expect(tests).toEqual([{ ApexClassId: '01p000000000005' }]);
    expect(toolingQueryStub.calledTwice).toBe(true);
    expect(toolingQueryStub.args[1]).toContain(
      "SELECT ApexClassId FROM TestSuiteMembership WHERE ApexTestSuiteId = '05F000000000001'"
    );
  });

  it('should return tests from suite when suite id is provided', async () => {
    toolingQueryStub.onFirstCall().resolves({ records: [{ ApexClassId: '01p000000000005' }] });

    const testService = new TestService(mockConnection);
    const tests = await testService.getTestsInSuite(undefined, '05F000000000001');

    expect(tests).toEqual([{ ApexClassId: '01p000000000005' }]);
    expect(toolingQueryStub.calledOnce).toBe(true);
  });

  it('should reject an id that is not an ApexTestSuite id', async () => {
    const testService = new TestService(mockConnection);

    await expect(testService.getTestsInSuite(undefined, '01p000000000005')).rejects.toThrow('Invalid suite id');
    expect(toolingQueryStub.notCalled).toBe(true);
  });

  it('should retrieve all suites associated with a given username', async () => {
    toolingQueryStub.onFirstCall().resolves({
      records: [{ id: '05F000000000002', TestSuiteName: 'testSuite' }]
    });

    const testService = new TestService(mockConnection);
    const tests = await testService.retrieveAllSuites();

    expect(tests).toEqual([{ id: '05F000000000002', TestSuiteName: 'testSuite' }]);
    expect(toolingQueryStub.calledOnce).toBe(true);
  });

  describe('Build Test Suite', () => {
    it('should create test suite given a suitename that does not exist', async () => {
      toolingQueryStub
        .onFirstCall()
        .resolves({
          records: []
        })
        .onSecondCall()
        .resolves({ records: [] })
        .onThirdCall()
        .resolves({ records: [{ Id: '01p000000000004' }] })
        .onCall(3)
        .resolves({ records: [{ Id: '01p000000000006' }] });
      toolingCreateStub.resolves({ id: '05F000000000001' });

      const testService = new TestService(mockConnection);
      await testService.buildSuite('testSuite', ['testClassOne', 'testClassTwo']);

      expect(toolingQueryStub.callCount).toBe(4);
      expect(toolingCreateStub.calledThrice).toBe(true);
    });

    it('should retrieve associated suite id for suitename that exists', async () => {
      toolingQueryStub
        .onFirstCall()
        .resolves({
          records: [{ Id: '05F000000000001' }]
        })
        .onSecondCall()
        .resolves({ records: [] })
        .onThirdCall()
        .resolves({ records: [{ Id: '01p000000000004' }] })
        .onCall(3)
        .resolves({ records: [{ Id: '01p000000000006' }] });
      toolingCreateStub.resolves({ id: '05F000000000001' });

      const testService = new TestService(mockConnection);
      await testService.buildSuite('oldSuite', ['testClassOne', 'testClassTwo']);

      expect(toolingQueryStub.callCount).toBe(4);
      expect(toolingCreateStub.calledTwice).toBe(true);
    });

    it('should not log when a test class already exists in the suite', async () => {
      toolingQueryStub
        .onFirstCall()
        .resolves({
          records: [{ Id: '05F000000000001' }]
        })
        .onSecondCall()
        .resolves({
          records: [{ ApexClassId: '01p000000000004' }, { ApexClassId: '01p000000000006' }]
        })
        .onThirdCall()
        .resolves({ records: [{ Id: '01p000000000004' }] })
        .onCall(3)
        .resolves({ records: [{ Id: '01p000000000006' }] });
      toolingCreateStub.resolves({ id: '05F000000000001' });
      const consoleSpy = $$.SANDBOX.spy(console, 'log');

      const testService = new TestService(mockConnection);
      await testService.buildSuite('oldSuite', ['testClassOne', 'testClassTwo']);

      expect(toolingQueryStub.callCount).toBe(4);
      expect(toolingCreateStub.notCalled).toBe(true);
      expect(consoleSpy.notCalled).toBe(true);
    });

    it('should add test classes to suite without logging to the console', async () => {
      toolingQueryStub
        .onFirstCall()
        .resolves({
          records: [{ Id: '05F000000000001' }]
        })
        .onSecondCall()
        .resolves({ records: [] })
        .onThirdCall()
        .resolves({ records: [{ Id: '01p000000000004' }] })
        .onCall(3)
        .resolves({ records: [{ Id: '01p000000000006' }] });
      toolingCreateStub.resolves({ id: '05F000000000001' });
      const consoleSpy = $$.SANDBOX.spy(console, 'log');

      const testService = new TestService(mockConnection);
      await testService.buildSuite('oldSuite', ['testClassOne', 'testClassTwo']);

      expect(toolingCreateStub.calledTwice).toBe(true);
      expect(consoleSpy.notCalled).toBe(true);
    });
  });

  describe('Build Test Payload', () => {
    it('should add all the tests specified even when some belong to the same class', async () => {
      const testsPayload = {
        tests: [
          {
            className: 'TestClass1',
            testMethods: ['method1']
          },
          {
            className: 'namespace.TestClass2',
            testMethods: ['method1', 'method2']
          }
        ]
      };
      const tests = 'TestClass1.method1,namespace.TestClass2.method1,namespace.TestClass2.method2';

      const testService = new TestService(mockConnection);

      const result = await testService.buildAsyncPayload('RunSpecifiedTests', tests);
      expect(result).toMatchObject(testsPayload);
    });

    it('should correctly identify and separate Flow tests from Apex tests', async () => {
      const tests = 'TestClass1.method1,FlowTesting.TestFlow.TestFlowClass.method1,TestClass2.method2';

      const testService = new TestService(mockConnection);
      const result = await testService.buildAsyncPayload('RunSpecifiedTests', tests);

      expect(result).toMatchObject({
        tests: [
          { className: 'TestClass1', testMethods: ['method1'] },
          {
            namespace: 'FlowTesting.TestFlow',
            className: 'FlowTesting.TestFlow.TestFlowClass',
            testMethods: ['method1']
          },
          { className: 'TestClass2', testMethods: ['method2'] }
        ]
      });
    });

    it('should handle only Flow tests in test payload', async () => {
      const tests = 'FlowTesting.TestFlow1.TestFlowClass1.method1,FlowTesting.TestFlow2.TestFlowClass2.method2';

      const testService = new TestService(mockConnection);
      const result = await testService.buildAsyncPayload('RunSpecifiedTests', tests);

      expect(result).toMatchObject({
        tests: [
          {
            namespace: 'FlowTesting.TestFlow1',
            className: 'FlowTesting.TestFlow1.TestFlowClass1',
            testMethods: ['method1']
          },
          {
            namespace: 'FlowTesting.TestFlow2',
            className: 'FlowTesting.TestFlow2.TestFlowClass2',
            testMethods: ['method2']
          }
        ]
      });
    });

    it('should handle only Apex tests in test payload', async () => {
      const tests = 'TestClass1.method1,TestClass2.method2,namespace.TestClass3.method3';

      const testService = new TestService(mockConnection);
      const result = await testService.buildAsyncPayload('RunSpecifiedTests', tests);

      expect(result).toMatchObject({
        tests: [
          { className: 'TestClass1', testMethods: ['method1'] },
          { className: 'TestClass2', testMethods: ['method2'] },
          { className: 'namespace.TestClass3', testMethods: ['method3'] }
        ]
      });
    });
  });

  describe('Category Support in Test Payloads', () => {
    let testService: TestService;

    beforeEach(() => {
      testService = new TestService(mockConnection);
    });

    describe('buildSyncPayload', () => {
      it('should include category in sync payload when category is provided', async () => {
        const result = await testService.buildSyncPayload('RunLocalTests', undefined, undefined, 'Flow');

        expect(result).toEqual({
          testLevel: 'RunLocalTests',
          category: ['Flow'],
          skipCodeCoverage: false
        });
      });

      it('should handle multiple categories in sync payload', async () => {
        const result = await testService.buildSyncPayload('RunLocalTests', undefined, undefined, 'Flow,Apex');

        expect(result).toEqual({
          testLevel: 'RunLocalTests',
          category: ['Flow', 'Apex'],
          skipCodeCoverage: false
        });
      });

      it('should not include category in sync payload when category is not provided', async () => {
        const result = await testService.buildSyncPayload(
          'RunLocalTests',
          'TestClass.method1', // Provide tests to avoid validation error
          undefined,
          undefined
        );

        expect(result).not.toHaveProperty('category');
        expect(result.testLevel).toBe('RunSpecifiedTests');
      });

      it('should handle classnames with category for Flow tests in sync payload', async () => {
        const mockFlowPayload = {
          testLevel: 'RunSpecifiedTests',
          tests: [{ className: 'FlowTestClass' }],
          skipCodeCoverage: false
        };

        const result = await testService.buildSyncPayload('RunSpecifiedTests', undefined, 'FlowTestClass', 'Flow');

        expect(result).toEqual(mockFlowPayload);
      });
    });

    describe('buildAsyncPayload', () => {
      it('should include category in async payload when not provided', async () => {
        const result = await testService.buildAsyncPayload('RunLocalTests', undefined, undefined, undefined, 'Flow');

        expect(result).toEqual({
          suiteNames: undefined,
          testLevel: 'RunLocalTests',
          category: ['Flow'],
          skipCodeCoverage: false
        });
      });

      it('should not include category in async payload when not provided', async () => {
        const result = await testService.buildAsyncPayload(
          'RunSpecifiedTests',
          undefined,
          'TestClass',
          undefined,
          undefined
        );

        expect(result).toEqual({
          testLevel: 'RunSpecifiedTests',
          tests: [{ className: 'TestClass' }],
          skipCodeCoverage: false
        });
        expect(result).not.toHaveProperty('category');
      });
    });
  });
});
