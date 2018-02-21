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
    const builder = new ForceApexTestRunCodeActionExecutor(testClass);

    it('Should build command for single test class', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testClass} --resultformat human --synchronous --loglevel error`
      );
    });
  });

  describe('Command builder - Test Method', () => {
    const testMethod = 'MyTests.testMe';
    const builder = new ForceApexTestRunCodeActionExecutor(testMethod);

    it('Should build command for single test method', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testMethod} --resultformat human --synchronous --loglevel error`
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
