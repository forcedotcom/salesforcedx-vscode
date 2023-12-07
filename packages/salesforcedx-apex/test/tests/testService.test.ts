/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { fail } from 'assert';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub, spy } from 'sinon';
import { TestService } from '../../src';

let mockConnection: Connection;
let sandboxStub: SinonSandbox;
let toolingCreateStub: SinonStub;
let toolingQueryStub: SinonStub;
const testData = new MockTestOrgData();

describe('Apex Test Suites', async () => {
  const $$ = new TestContext();
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

    toolingQueryStub = sandboxStub.stub(mockConnection.tooling, 'query');
    toolingCreateStub = sandboxStub.stub(mockConnection.tooling, 'create');
  });

  afterEach(async () => {
    sandboxStub.restore();
  });

  it('should retrieve apex class ids for a singular class', async () => {
    toolingQueryStub.resolves({ records: [{ Id: 'xxxxxxx243' }] });

    const testService = new TestService(mockConnection);
    const ids = await testService.getApexClassIds(['firstTestClass']);

    expect(ids).to.deep.equal(['xxxxxxx243']);
    expect(toolingQueryStub.calledOnce).to.be.true;
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
    const ids = await testService.getApexClassIds([
      'firstTestClass',
      'secondTestClass',
      'thirdTestClass'
    ]);

    expect(ids).to.deep.equal(['xxxxxxx243', 'xxxxxxx245', 'xxxxxxx247']);
    expect(toolingQueryStub.calledThrice).to.be.true;
  });

  it('should retrieve 0 apex class ids when given 0 classes', async () => {
    toolingQueryStub.resolves({ records: [{ Id: 'xxxxxxx243' }] });

    const testService = new TestService(mockConnection);
    const ids = await testService.getApexClassIds([]);

    expect(ids).to.deep.equal([]);
    expect(toolingQueryStub.notCalled).to.be.true;
  });

  it('should throw an error if a given apex class does not exist', async () => {
    toolingQueryStub.resolves({ records: [{ Id: 'xxxxxxx243' }] });

    const testService = new TestService(mockConnection);
    const ids = await testService.getApexClassIds([]);

    expect(ids).to.deep.equal([]);
    expect(toolingQueryStub.notCalled).to.be.true;
  });

  it('should throw an error if suitename or suite id was not provided', async () => {
    try {
      const testService = new TestService(mockConnection);
      await testService.getTestsInSuite(undefined, undefined);
      fail();
    } catch (e) {
      expect(e.message).to.eql(
        'Must provide a suite name or suite id to retrieve test classes in suite'
      );
      expect(toolingQueryStub.notCalled).to.be.true;
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

    expect(tests).to.deep.equal([{ ApexClassId: 'xxxxxx55555' }]);
    expect(toolingQueryStub.calledTwice).to.be.true;
    expect(toolingQueryStub.args[1]).to.deep.include(
      `SELECT ApexClassId FROM TestSuiteMembership WHERE ApexTestSuiteId = 'xxxxxxx243'`
    );
  });

  it('should return tests from suite when suite id is provided', async () => {
    toolingQueryStub
      .onFirstCall()
      .resolves({ records: [{ ApexClassId: 'xxxxxx55555' }] });

    const testService = new TestService(mockConnection);
    const tests = await testService.getTestsInSuite(undefined, 'xxxxxxx243');

    expect(tests).to.deep.equal([{ ApexClassId: 'xxxxxx55555' }]);
    expect(toolingQueryStub.calledOnce).to.be.true;
  });

  it('should retrieve all suites associated with a given username', async () => {
    toolingQueryStub.onFirstCall().resolves({
      records: [{ id: 'xxxxxx55555', TestSuiteName: 'testSuite' }]
    });

    const testService = new TestService(mockConnection);
    const tests = await testService.retrieveAllSuites();

    expect(tests).to.deep.equal([
      { id: 'xxxxxx55555', TestSuiteName: 'testSuite' }
    ]);
    expect(toolingQueryStub.calledOnce).to.be.true;
  });

  describe('Build Test Suite', async () => {
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
      await testService.buildSuite('testSuite', [
        'testClassOne',
        'testClassTwo'
      ]);

      expect(toolingQueryStub.callCount).to.eql(4);
      expect(toolingCreateStub.calledThrice).to.be.true;
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
      await testService.buildSuite('oldSuite', [
        'testClassOne',
        'testClassTwo'
      ]);

      expect(toolingQueryStub.callCount).to.eql(4);
      expect(toolingCreateStub.calledTwice).to.be.true;
    });

    it('should log message if a test class already exists in given suite', async () => {
      toolingQueryStub
        .onFirstCall()
        .resolves({
          records: [{ Id: 'xxxxxxx243' }]
        })
        .onSecondCall()
        .resolves({
          records: [
            { ApexClassId: 'xxxxxxx004' },
            { ApexClassId: 'xxxxxxx006' }
          ]
        })
        .onThirdCall()
        .resolves({ records: [{ Id: 'xxxxxxx004' }] })
        .onCall(3)
        .resolves({ records: [{ Id: 'xxxxxxx006' }] });
      toolingCreateStub.resolves({ id: 'xxxxxxx243' });
      const consoleSpy = spy(console, 'log');

      const testService = new TestService(mockConnection);
      await testService.buildSuite('oldSuite', [
        'testClassOne',
        'testClassTwo'
      ]);

      expect(toolingQueryStub.callCount).to.eql(4);
      expect(toolingCreateStub.notCalled).to.be.true;
      expect(consoleSpy.callCount).to.eql(2);
      expect(consoleSpy.args[0]).to.eql([
        'Apex test class testClassOne already exists in Apex test suite oldSuite'
      ]);
      expect(consoleSpy.args[1]).to.eql([
        'Apex test class testClassTwo already exists in Apex test suite oldSuite'
      ]);
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
      await testService.buildSuite('oldSuite', [
        'testClassOne',
        'testClassTwo'
      ]);

      expect(toolingCreateStub.calledTwice).to.be.true;
    });
  });

  describe('Build Test Payload', async () => {
    it('should add all the tests specified even when some belong to the same class', async () => {
      const testsPayload = {
        testLevel: 'RunSpecifiedTests',
        tests: [
          {
            className: 'TestClass1',
            testMethods: ['method1']
          },
          {
            className: 'TestClass2',
            testMethods: ['method1', 'method2'],
            namespace: 'namespace'
          }
        ]
      };
      const tests =
        'TestClass1.method1,namespace.TestClass2.method1,TestClass2.method2';

      const testService = new TestService(mockConnection);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (testService as any).buildTestPayload(tests);
      expect(result.tests.toString()).to.equal(testsPayload.tests.toString());
    });
  });
});
