/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ReadableApexTestRunExecutor } from '../../../src/views/readableApexTestRunExecutor';

describe('Apex Test Run - Sidebar', () => {
  describe('Command builder - Test Class', () => {
    const testClass = ['MyTests'];
    const outputToJson = 'outputToJson';
    const builder = new ReadableApexTestRunExecutor(
      testClass,
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
    const testClass = ['MyTests'];
    const outputToJson = 'outputToJson';
    const builder = new ReadableApexTestRunExecutor(
      testClass,
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
    const testMethod = ['MyTests.testMe'];
    const outputToJson = 'outputToJson';
    const builder = new ReadableApexTestRunExecutor(
      testMethod,
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
    const testMethod = ['MyTests.testMe'];
    const outputToJson = 'outputToJson';
    const builder = new ReadableApexTestRunExecutor(
      testMethod,
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
});
