import { expect } from 'chai';
import { ForceApexTestRunCodeActionExecutor } from '../../src/commands/forceApexTestRunCodeAction';

describe('Force Apex Test Run - Code Action', () => {
  describe('Command builder - Test Class', () => {
    const testClass = 'MyTests';
    const builder = new ForceApexTestRunCodeActionExecutor(testClass);

    it('Should build command for single test class', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testClass} --resultformat ide --synchronous --loglevel error`
      );
    });
  });

  describe('Command builder - Test Method', () => {
    const testMethod = 'MyTests.testMe';
    const builder = new ForceApexTestRunCodeActionExecutor(testMethod);

    it('Should build command for single test method', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testMethod} --resultformat ide --synchronous --loglevel error`
      );
    });
  });
});
