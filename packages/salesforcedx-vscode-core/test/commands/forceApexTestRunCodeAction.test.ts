import { expect } from 'chai';
import { ForceApexTestRunCodeActionExecutor } from '../../src/commands/forceApexTestRunCodeAction';
import { nls } from '../../src/messages';

describe('Force Apex Test Run - Code Action', () => {
  describe('Command builder - Test Class', () => {
    const testClass = 'MyTests';
    const builder = new ForceApexTestRunCodeActionExecutor(testClass);

    it('Should build command for single test class', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testClass} --resultformat human --synchronous`
      );
      expect(command.description).to.equal(
        nls.localize(
          'force_apex_test_run_codeAction_all_tests_description_text',
          testClass
        )
      );
    });
  });

  describe('Command builder - Test Method', () => {
    const testMethod = 'MyTests.testMe';
    const builder = new ForceApexTestRunCodeActionExecutor(testMethod);

    it('Should build command for single test method', () => {
      const command = builder.build({});

      expect(command.toCommand()).to.equal(
        `sfdx force:apex:test:run --tests ${testMethod} --resultformat human --synchronous`
      );
      expect(command.description).to.equal(
        nls.localize(
          'force_apex_test_run_codeAction_testMethod_description_text',
          testMethod
        )
      );
    });
  });
});
