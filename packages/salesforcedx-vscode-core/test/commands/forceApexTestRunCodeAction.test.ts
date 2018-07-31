/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  ForceApexTestRunCodeActionExecutor,
  resolveTestClassParam,
  resolveTestMethodParam
} from '../../src/commands/forceApexTestRunCodeAction';

// return undefined: used to get around strict checks
function getUndefined(): any {
  return undefined;
}

describe('Force Apex Test Run - Code Action', () => {
  describe('Command builder - Test Class', () => {
    const testClass = 'MyTests';
    const builder = new ForceApexTestRunCodeActionExecutor(testClass, false);

    it('Should build command for single test class', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testClass} --resultformat human --synchronous --loglevel error`
      );
    });
  });

  describe('Command builder - Test Class with Coverage', () => {
    const testClass = 'MyTests';
    const builder = new ForceApexTestRunCodeActionExecutor(testClass, true);

    it('Should build command for single test class with code coverage', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testClass} --resultformat human --synchronous --loglevel error --codecoverage`
      );
    });
  });

  describe('Command builder - Test Method', () => {
    const testMethod = 'MyTests.testMe';
    const builder = new ForceApexTestRunCodeActionExecutor(testMethod, false);

    it('Should build command for single test method', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testMethod} --resultformat human --synchronous --loglevel error`
      );
    });
  });

  describe('Command builder - Test Method with Coverage', () => {
    const testMethod = 'MyTests.testMe';
    const builder = new ForceApexTestRunCodeActionExecutor(testMethod, true);

    it('Should build command for single test method with code coverage', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testMethod} --resultformat human --synchronous --loglevel error --codecoverage`
      );
    });
  });

  describe('Cached Test Class', () => {
    const testClass = 'MyTests';
    const testClass2 = 'MyTests2';
    it('Should return cached value', () => {
      let resolvedTestClass = resolveTestClassParam(getUndefined());
      expect(resolvedTestClass).to.equal(undefined);

      resolvedTestClass = resolveTestClassParam(testClass);
      expect(resolvedTestClass).to.equal(testClass);

      resolvedTestClass = resolveTestClassParam('');
      expect(resolvedTestClass).to.equal(testClass);

      resolvedTestClass = resolveTestClassParam(getUndefined());
      expect(resolvedTestClass).to.equal(testClass);

      resolvedTestClass = resolveTestClassParam(testClass2);
      expect(resolvedTestClass).to.equal(testClass2);

      resolvedTestClass = resolveTestClassParam('');
      expect(resolvedTestClass).to.equal(testClass2);
    });
  });

  describe('Cached Test Method', () => {
    const testMethod = 'MyTests.testMe';
    const testMethod2 = 'MyTests.testMe2';
    it('Should return cached value', () => {
      let resolvedTestMethod = resolveTestMethodParam(getUndefined());
      expect(resolvedTestMethod).to.equal(undefined);

      resolvedTestMethod = resolveTestMethodParam(testMethod);
      expect(resolvedTestMethod).to.equal(testMethod);

      resolvedTestMethod = resolveTestMethodParam('');
      expect(resolvedTestMethod).to.equal(testMethod);

      resolvedTestMethod = resolveTestMethodParam(getUndefined());
      expect(resolvedTestMethod).to.equal(testMethod);

      resolvedTestMethod = resolveTestMethodParam(testMethod2);
      expect(resolvedTestMethod).to.equal(testMethod2);

      resolvedTestMethod = resolveTestMethodParam('');
      expect(resolvedTestMethod).to.equal(testMethod2);
    });
  });
});
