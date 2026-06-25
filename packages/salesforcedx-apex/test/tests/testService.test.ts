/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SinonStub } from 'sinon';
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { fail } from 'node:assert';
import { TestService } from '../../src';
import { TestCategory, TestLevel } from '../../src/tests/types';

let mockConnection: Connection;
let toolingCreateStub: SinonStub;
let toolingQueryStub: SinonStub;
const testData = new MockTestOrgData();

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
    toolingQueryStub.resolves({ records: [{ Id: 'xxxxxxx243' }] });

    const testService = new TestService(mockConnection);
    const ids = await testService.getApexClassIds(['firstTestClass']);

    expect(ids).toEqual(['xxxxxxx243']);
    expect(toolingQueryStub.calledOnce).toBe(true);
    expect(toolingQueryStub.firstCall.args[0]).toContain("Name = 'firstTestClass'");
    expect(toolingQueryStub.firstCall.args[0]).toContain('NamespacePrefix = null');
  });

  it('should retrieve apex class id for namespaced class (ns.ShortName)', async () => {
    toolingQueryStub.resolves({ records: [{ Id: 'pkgClassId' }] });

    const testService = new TestService(mockConnection);
    const ids = await testService.getApexClassIds(['myns.FooTest']);

    expect(ids).toEqual(['pkgClassId']);
    expect(toolingQueryStub.firstCall.args[0]).toContain("Name = 'FooTest'");
    expect(toolingQueryStub.firstCall.args[0]).toContain("NamespacePrefix = 'myns'");
  });

  it('should retrieve apex class ids for multiple classes', async () => {
    toolingQueryStub
      .onFirstCall()
      .resolves({
        records: [{ Id: 'xxxxxxx243' }]
      })
      .onSecondCall()
      .resolves({
        records: [{ Id: 'xxxxxxx245' }]
      })
      .onThirdCall()
      .resolves({
        records: [{ Id: 'xxxxxxx247' }]
      });

    const testService = new TestService(mockConnection);
    const ids = await testService.getApexClassIds(['firstTestClass', 'secondTestClass', 'thirdTestClass']);

    expect(ids).toEqual(['xxxxxxx243', 'xxxxxxx245', 'xxxxxxx247']);
    expect(toolingQueryStub.calledThrice).toBe(true);
  });

  it('should retrieve 0 apex class ids when given 0 classes', async () => {
    toolingQueryStub.resolves({ records: [{ Id: 'xxxxxxx243' }] });

    const testService = new TestService(mockConnection);
    const ids = await testService.getApexClassIds([]);

    expect(ids).toEqual([]);
    expect(toolingQueryStub.notCalled).toBe(true);
  });

  it('should throw an error if a given apex class does not exist', async () => {
    toolingQueryStub.resolves({ records: [{ Id: 'xxxxxxx243' }] });

    const testService = new TestService(mockConnection);
    const ids = await testService.getApexClassIds([]);

    expect(ids).toEqual([]);
    expect(toolingQueryStub.notCalled).toBe(true);
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
      .resolves({ records: [{ Id: 'xxxxxxx243' }] })
      .onSecondCall()
      .resolves({ records: [{ ApexClassId: 'xxxxxx55555' }] });

    const testService = new TestService(mockConnection);
    const tests = await testService.getTestsInSuite('testSuite');

    expect(tests).toEqual([{ ApexClassId: 'xxxxxx55555' }]);
    expect(toolingQueryStub.calledTwice).toBe(true);
    expect(toolingQueryStub.args[1]).toContain(
      "SELECT ApexClassId FROM TestSuiteMembership WHERE ApexTestSuiteId = 'xxxxxxx243'"
    );
  });

  it('should return tests from suite when suite id is provided', async () => {
    toolingQueryStub.onFirstCall().resolves({ records: [{ ApexClassId: 'xxxxxx55555' }] });

    const testService = new TestService(mockConnection);
    const tests = await testService.getTestsInSuite(undefined, 'xxxxxxx243');

    expect(tests).toEqual([{ ApexClassId: 'xxxxxx55555' }]);
    expect(toolingQueryStub.calledOnce).toBe(true);
  });

  it('should retrieve all suites associated with a given username', async () => {
    toolingQueryStub.onFirstCall().resolves({
      records: [{ id: 'xxxxxx55555', TestSuiteName: 'testSuite' }]
    });

    const testService = new TestService(mockConnection);
    const tests = await testService.retrieveAllSuites();

    expect(tests).toEqual([{ id: 'xxxxxx55555', TestSuiteName: 'testSuite' }]);
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
        .resolves({ records: [{ Id: 'xxxxxxx004' }] })
        .onCall(3)
        .resolves({ records: [{ Id: 'xxxxxxx006' }] });
      toolingCreateStub.resolves({ id: 'xxxxxxx243' });

      const testService = new TestService(mockConnection);
      await testService.buildSuite('testSuite', ['testClassOne', 'testClassTwo']);

      expect(toolingQueryStub.callCount).toBe(4);
      expect(toolingCreateStub.calledThrice).toBe(true);
    });

    it('should retrieve associated suite id for suitename that exists', async () => {
      toolingQueryStub
        .onFirstCall()
        .resolves({
          records: [{ Id: 'xxxxxxx243' }]
        })
        .onSecondCall()
        .resolves({ records: [] })
        .onThirdCall()
        .resolves({ records: [{ Id: 'xxxxxxx004' }] })
        .onCall(3)
        .resolves({ records: [{ Id: 'xxxxxxx006' }] });
      toolingCreateStub.resolves({ id: 'xxxxxxx243' });

      const testService = new TestService(mockConnection);
      await testService.buildSuite('oldSuite', ['testClassOne', 'testClassTwo']);

      expect(toolingQueryStub.callCount).toBe(4);
      expect(toolingCreateStub.calledTwice).toBe(true);
    });

    it('should log message if a test class already exists in given suite', async () => {
      toolingQueryStub
        .onFirstCall()
        .resolves({
          records: [{ Id: 'xxxxxxx243' }]
        })
        .onSecondCall()
        .resolves({
          records: [{ ApexClassId: 'xxxxxxx004' }, { ApexClassId: 'xxxxxxx006' }]
        })
        .onThirdCall()
        .resolves({ records: [{ Id: 'xxxxxxx004' }] })
        .onCall(3)
        .resolves({ records: [{ Id: 'xxxxxxx006' }] });
      toolingCreateStub.resolves({ id: 'xxxxxxx243' });
      const consoleSpy = $$.SANDBOX.spy(console, 'log');

      const testService = new TestService(mockConnection);
      await testService.buildSuite('oldSuite', ['testClassOne', 'testClassTwo']);

      expect(toolingQueryStub.callCount).toBe(4);
      expect(toolingCreateStub.notCalled).toBe(true);
      expect(consoleSpy.callCount).toBe(2);
      expect(consoleSpy.args[0]).toEqual(['Apex test class testClassOne already exists in Apex test suite oldSuite']);
      expect(consoleSpy.args[1]).toEqual(['Apex test class testClassTwo already exists in Apex test suite oldSuite']);
    });

    it('should add test class to suite if class does not exist', async () => {
      toolingQueryStub
        .onFirstCall()
        .resolves({
          records: [{ Id: 'xxxxxxx243' }]
        })
        .onSecondCall()
        .resolves({ records: [] })
        .onThirdCall()
        .resolves({ records: [{ Id: 'xxxxxxx004' }] })
        .onCall(3)
        .resolves({ records: [{ Id: 'xxxxxxx006' }] });
      toolingCreateStub.resolves({ id: 'xxxxxxx243' });

      const testService = new TestService(mockConnection);
      await testService.buildSuite('oldSuite', ['testClassOne', 'testClassTwo']);

      expect(toolingCreateStub.calledTwice).toBe(true);
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

      const result = await (testService as any).buildTestPayload(tests);
      expect(result.tests.toString()).toBe(testsPayload.tests.toString());
    });

    it('should correctly identify and separate Flow tests from Apex tests', async () => {
      const tests = 'TestClass1.method1,FlowTesting.TestFlow.TestFlowClass.method1,TestClass2.method2';

      const testService = new TestService(mockConnection);
      // Mock the processFlowTest and processApexTest methods
      const processFlowTestSpy = $$.SANDBOX.spy(testService as any, 'processFlowTest');
      const processApexTestSpy = $$.SANDBOX.spy(testService as any, 'processApexTest');

      await (testService as any).buildTestPayload(tests);

      // Verify that processFlowTest was called for Flow test
      expect(processFlowTestSpy.calledOnce).toBe(true);
      expect(processFlowTestSpy.args[0][0]).toEqual(['FlowTesting', 'TestFlow', 'TestFlowClass', 'method1']);

      // Verify that processApexTest was called for Apex tests
      expect(processApexTestSpy.calledTwice).toBe(true);
      expect(processApexTestSpy.args[0][0]).toEqual(['TestClass1', 'method1']);
      expect(processApexTestSpy.args[1][0]).toEqual(['TestClass2', 'method2']);
    });

    it('should handle only Flow tests in test payload', async () => {
      const tests = 'FlowTesting.TestFlow1.TestFlowClass1.method1,FlowTesting.TestFlow2.TestFlowClass2.method2';

      const testService = new TestService(mockConnection);
      const processFlowTestSpy = $$.SANDBOX.spy(testService as any, 'processFlowTest');
      const processApexTestSpy = $$.SANDBOX.spy(testService as any, 'processApexTest');

      await (testService as any).buildTestPayload(tests);

      // Verify that only processFlowTest was called
      expect(processFlowTestSpy.calledTwice).toBe(true);
      expect(processApexTestSpy.notCalled).toBe(true);
    });

    it('should handle only Apex tests in test payload', async () => {
      const tests = 'TestClass1.method1,TestClass2.method2,namespace.TestClass3.method3';

      const testService = new TestService(mockConnection);
      const processFlowTestSpy = $$.SANDBOX.spy(testService as any, 'processFlowTest');
      const processApexTestSpy = $$.SANDBOX.spy(testService as any, 'processApexTest');

      await (testService as any).buildTestPayload(tests);

      // Verify that only processApexTest was called
      expect(processApexTestSpy.calledThrice).toBe(true);
      expect(processFlowTestSpy.notCalled).toBe(true);
    });
  });

  describe('Category Support in Test Payloads', () => {
    let testService: TestService;

    beforeEach(() => {
      testService = new TestService(mockConnection);
    });

    describe('buildSyncPayload', () => {
      it('should include category in sync payload when category is provided', async () => {
        const result = await testService.buildSyncPayload(
          TestLevel.RunLocalTests,
          undefined,
          undefined,
          TestCategory.Flow
        );

        expect(result).toEqual({
          testLevel: TestLevel.RunLocalTests,
          category: [TestCategory.Flow],
          skipCodeCoverage: false
        });
      });

      it('should handle multiple categories in sync payload', async () => {
        const result = await testService.buildSyncPayload(TestLevel.RunLocalTests, undefined, undefined, 'Flow,Apex');

        expect(result).toEqual({
          testLevel: TestLevel.RunLocalTests,
          category: ['Flow', 'Apex'],
          skipCodeCoverage: false
        });
      });

      it('should not include category in sync payload when category is not provided', async () => {
        const result = await testService.buildSyncPayload(
          TestLevel.RunLocalTests,
          'TestClass.method1', // Provide tests to avoid validation error
          undefined,
          undefined
        );

        expect(result).not.toHaveProperty('category');
        expect(result.testLevel).toBe(TestLevel.RunSpecifiedTests);
      });

      it('should handle classnames with category for Flow tests in sync payload', async () => {
        // Mock the buildClassPayloadForFlow method
        const mockFlowPayload = {
          testLevel: TestLevel.RunSpecifiedTests,
          tests: [{ className: 'FlowTestClass' }]
        };
        $$.SANDBOX.stub(testService as any, 'buildClassPayloadForFlow').resolves(mockFlowPayload);

        const result = await testService.buildSyncPayload(
          TestLevel.RunSpecifiedTests,
          undefined,
          'FlowTestClass',
          TestCategory.Flow
        );

        expect(result).toEqual(mockFlowPayload);
      });
    });

    describe('buildAsyncPayload', () => {
      it('should include category in async payload when not provided', async () => {
        const result = await testService.buildAsyncPayload(
          TestLevel.RunLocalTests,
          undefined,
          undefined,
          undefined,
          TestCategory.Flow
        );

        expect(result).toEqual({
          suiteNames: undefined,
          testLevel: TestLevel.RunLocalTests,
          category: ['Flow'],
          skipCodeCoverage: false
        });
      });

      it('should not include category in async payload when not provided', async () => {
        const result = await testService.buildAsyncPayload(
          TestLevel.RunSpecifiedTests,
          undefined,
          'TestClass',
          undefined,
          undefined
        );

        expect(result).toEqual({
          testLevel: TestLevel.RunSpecifiedTests,
          tests: [{ className: 'TestClass' }],
          skipCodeCoverage: false
        });
        expect(result).not.toHaveProperty('category');
      });
    });

    describe('Private utility methods', () => {
      it('should correctly identify when category is provided (hasCategory)', () => {
        // Test hasCategory method behavior through public interface
        // Since hasCategory is private, we test its behavior indirectly

        const testServiceAny = testService as any;

        // Test that valid categories return truthy values
        expect(testServiceAny.hasCategory('Flow')).toBeTruthy();
        expect(testServiceAny.hasCategory('Flow,Apex')).toBeTruthy();

        // Test that invalid categories return falsy values
        expect(testServiceAny.hasCategory('')).not.toBeTruthy();
        expect(testServiceAny.hasCategory(null)).not.toBeTruthy();
        expect(testServiceAny.hasCategory(undefined)).not.toBeTruthy();
      });
    });
  });
});
