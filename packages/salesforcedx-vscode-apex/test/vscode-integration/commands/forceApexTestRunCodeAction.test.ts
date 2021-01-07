/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestLevel, TestService } from '@salesforce/apex-node';
import { workspaceContext } from '@salesforce/salesforcedx-utils-vscode/out/src/context';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { extensions } from 'vscode';
import {
  ApexLibraryTestRunExecutor,
  forceApexTestClassRunCodeAction,
  forceApexTestMethodRunCodeAction,
  ForceApexTestRunCodeActionExecutor,
  resolveTestClassParam,
  resolveTestMethodParam
} from '../../../src/commands/forceApexTestRunCodeAction';

const sfdxCoreExports = extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const sfdxCoreSetting = sfdxCoreExports.sfdxCoreSettings;

// return undefined: used to get around strict checks
function getUndefined(): any {
  return undefined;
}

describe('Force Apex Test Run - Code Action', () => {
  describe('Command builder - Test Class', () => {
    const testClass = 'MyTests';
    const outputToJson = 'outputToJson';
    const builder = new ForceApexTestRunCodeActionExecutor(
      [testClass],
      false,
      outputToJson
    );

    it('Should build command for single test class', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testClass} --resultformat human --outputdir outputToJson --loglevel error`
      );
    });
  });

  describe('Command builder - Test Class with Coverage', () => {
    const testClass = 'MyTests';
    const outputToJson = 'outputToJson';
    const builder = new ForceApexTestRunCodeActionExecutor(
      [testClass],
      true,
      outputToJson
    );

    it('Should build command for single test class with code coverage', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testClass} --resultformat human --outputdir outputToJson --loglevel error --codecoverage`
      );
    });
  });

  describe('Command builder - Test Method', () => {
    const testMethod = 'MyTests.testMe';
    const outputToJson = 'outputToJson';
    const builder = new ForceApexTestRunCodeActionExecutor(
      [testMethod],
      false,
      outputToJson
    );

    it('Should build command for single test method', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testMethod} --resultformat human --outputdir outputToJson --loglevel error`
      );
    });
  });

  describe('Command builder - Test Method with Coverage', () => {
    const testMethod = 'MyTests.testMe';
    const outputToJson = 'outputToJson';
    const builder = new ForceApexTestRunCodeActionExecutor(
      [testMethod],
      true,
      outputToJson
    );

    it('Should build command for single test method with code coverage', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testMethod} --resultformat human --outputdir outputToJson --loglevel error --codecoverage`
      );
    });
  });

  describe('Cached Test Class', () => {
    const testClass = 'MyTests';
    const testClass2 = 'MyTests2';
    it('Should return cached value', async () => {
      let resolvedTestClass = await resolveTestClassParam(getUndefined());
      expect(resolvedTestClass).to.equal(undefined);

      resolvedTestClass = await resolveTestClassParam(testClass);
      expect(resolvedTestClass).to.equal(testClass);

      resolvedTestClass = await resolveTestClassParam('');
      expect(resolvedTestClass).to.equal(testClass);

      resolvedTestClass = await resolveTestClassParam(getUndefined());
      expect(resolvedTestClass).to.equal(testClass);

      resolvedTestClass = await resolveTestClassParam(testClass2);
      expect(resolvedTestClass).to.equal(testClass2);

      resolvedTestClass = await resolveTestClassParam('');
      expect(resolvedTestClass).to.equal(testClass2);
    });
  });

  describe('Cached Test Method', () => {
    const testMethod = 'MyTests.testMe';
    const testMethod2 = 'MyTests.testMe2';
    it('Should return cached value', async () => {
      let resolvedTestMethod = await resolveTestMethodParam(getUndefined());
      expect(resolvedTestMethod).to.equal(undefined);

      resolvedTestMethod = await resolveTestMethodParam(testMethod);
      expect(resolvedTestMethod).to.equal(testMethod);

      resolvedTestMethod = await resolveTestMethodParam('');
      expect(resolvedTestMethod).to.equal(testMethod);

      resolvedTestMethod = await resolveTestMethodParam(getUndefined());
      expect(resolvedTestMethod).to.equal(testMethod);

      resolvedTestMethod = await resolveTestMethodParam(testMethod2);
      expect(resolvedTestMethod).to.equal(testMethod2);

      resolvedTestMethod = await resolveTestMethodParam('');
      expect(resolvedTestMethod).to.equal(testMethod2);
    });
  });

  // tslint:disable:no-unused-expression
  describe('Apex Library Test Run Executor', async () => {
    let sb: SinonSandbox;
    let runTestStub: SinonStub;

    beforeEach(async () => {
      sb = createSandbox();
      runTestStub = sb.stub(TestService.prototype, 'runTestAsynchronous');
      sb.stub(workspaceContext, 'getConnection');
    });
    afterEach(async () => {
      sb.restore();
    });

    it('should run test with correct parameters for single test method with code coverage', async () => {
      const apexLibExecutor = new ApexLibraryTestRunExecutor(
        ['testClass.oneTest'],
        'path/to/dir',
        true
      );
      await apexLibExecutor.execute();
      expect(runTestStub.args[0]).to.deep.equal([
        {
          tests: [{ className: 'testClass', testMethods: ['oneTest'] }],
          testLevel: TestLevel.RunSpecifiedTests
        },
        true
      ]);
    });

    it('should run test with correct parameters for multiple test methods without code coverage', async () => {
      const apexLibExecutor = new ApexLibraryTestRunExecutor(
        ['testClass.oneTest', 'testClass.twoTest'],
        'path/to/dir',
        false
      );
      await apexLibExecutor.execute();
      expect(runTestStub.args[0]).to.deep.equal([
        {
          tests: [
            { className: 'testClass', testMethods: ['oneTest'] },
            { className: 'testClass', testMethods: ['twoTest'] }
          ],
          testLevel: TestLevel.RunSpecifiedTests
        },
        false
      ]);
    });

    it('should run test with correct parameters for single test class with code coverage', async () => {
      const apexLibExecutor = new ApexLibraryTestRunExecutor(
        ['testClass'],
        'path/to/dir',
        true
      );
      await apexLibExecutor.execute();
      expect(runTestStub.args[0]).to.deep.equal([
        {
          tests: [{ className: 'testClass' }],
          testLevel: TestLevel.RunSpecifiedTests
        },
        true
      ]);
    });

    it('should run test with correct parameters for multiple test classes without code coverage', async () => {
      const apexLibExecutor = new ApexLibraryTestRunExecutor(
        ['testClass', 'secondTestClass'],
        'path/to/dir',
        false
      );
      await apexLibExecutor.execute();
      expect(runTestStub.args[0]).to.deep.equal([
        {
          tests: [{ className: 'testClass' }, { className: 'secondTestClass' }],
          testLevel: TestLevel.RunSpecifiedTests
        },
        false
      ]);
    });
  });

  describe('Use Apex Library Setting', async () => {
    let sb: SinonSandbox;
    let settingStub: SinonStub;
    let apexExecutorStub: SinonStub;
    let cliExecutorStub: SinonStub;

    beforeEach(async () => {
      sb = createSandbox();
      settingStub = sb.stub(sfdxCoreSetting, 'getApexLibrary');
      apexExecutorStub = sb.stub(
        ApexLibraryTestRunExecutor.prototype,
        'execute'
      );
      cliExecutorStub = sb.stub(
        ForceApexTestRunCodeActionExecutor.prototype,
        'execute'
      );
    });
    afterEach(async () => {
      sb.restore();
    });

    it('should use the ApexLibraryTestRunExecutor if setting is true', async () => {
      settingStub.returns(true);
      await forceApexTestClassRunCodeAction('testClass');
      await forceApexTestMethodRunCodeAction('testClass.testMethod');
      expect(apexExecutorStub.calledTwice).to.be.true;
      expect(cliExecutorStub.called).to.be.false;
    });

    it('should use the ForceApexTestClassRunCodeActionExecutor if setting is false', async () => {
      settingStub.returns(false);
      await forceApexTestClassRunCodeAction('testClass');
      await forceApexTestMethodRunCodeAction('testClass.testMethod');
      expect(cliExecutorStub.calledTwice).to.be.true;
      expect(apexExecutorStub.called).to.be.false;
    });
  });
});
