/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SFDX_PROJECT_FILE } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { LocalCommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import { renameSync } from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { SObjectCategory } from '../../src/describe';
import {
  FauxClassGenerator,
  SObjectRefreshResult,
  SObjectRefreshSource
} from '../../src/generator/fauxClassGenerator';
import { nls } from '../../src/messages';
import * as util from './integrationTestUtil';

// The CustomObjects are all identical in terms of fields, just different ones to test batch
// and multiple objects for testing describeGlobal
const PROJECT_NAME = `project_${new Date().getTime()}`;
const CUSTOM_OBJECT_NAME = 'MyCustomObject__c';
const CUSTOM_OBJECT2_NAME = 'MyCustomObject2__c';
const CUSTOM_OBJECT3_NAME = 'MyCustomObject3__c';
const CUSTOM_FIELD_FULLNAME = '.MyCustomField__c';
const SIMPLE_OBJECT_SOURCE_FOLDER = 'simpleObjectAndField';

// tslint:disable:no-unused-expression
describe('Generate faux classes for SObjects', function() {
  // tslint:disable-next-line:no-invalid-this
  this.timeout(180000);
  let username: string;

  let cancellationTokenSource: util.CancellationTokenSource;
  let projectPath: string;
  let emitter: EventEmitter;

  function getGenerator(): FauxClassGenerator {
    return new FauxClassGenerator(emitter, cancellationTokenSource.token);
  }

  before(async () => {
    const customFields: util.CustomFieldInfo[] = [
      new util.CustomFieldInfo(CUSTOM_OBJECT_NAME, [
        `${CUSTOM_OBJECT_NAME}${CUSTOM_FIELD_FULLNAME}`
      ]),
      new util.CustomFieldInfo(CUSTOM_OBJECT2_NAME, [
        `${CUSTOM_OBJECT2_NAME}${CUSTOM_FIELD_FULLNAME}`
      ]),
      new util.CustomFieldInfo(CUSTOM_OBJECT3_NAME, [
        `${CUSTOM_OBJECT3_NAME}${CUSTOM_FIELD_FULLNAME}`
      ])
    ];

    username = await util.initializeProject(
      PROJECT_NAME,
      SIMPLE_OBJECT_SOURCE_FOLDER,
      customFields
    );

    projectPath = path.join(process.cwd(), PROJECT_NAME);
    emitter = new EventEmitter();
  });

  beforeEach(() => {
    cancellationTokenSource = new util.CancellationTokenSource();
  });

  after(async () => {
    if (username) {
      await util.deleteScratchOrg(username);
    }
    rimraf.sync(projectPath);
    projectPath = '';
  });

  it('Should be cancellable', async () => {
    const generator = getGenerator();
    cancellationTokenSource.cancel();
    const result = await generator.generate(
      projectPath,
      SObjectCategory.CUSTOM,
      SObjectRefreshSource.Manual
    );
    expect(result.data.cancelled).to.be.true;
  });

  it('Should fail if outside a project', async () => {
    let result: SObjectRefreshResult;
    const generator = getGenerator();
    invalidateProject(projectPath);
    try {
      result = await generator.generate(
        projectPath,
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Manual
      );
    } catch ({ error }) {
      expect(error.message).to.contain(
        nls.localize('no_generate_if_not_in_project', '')
      );
      return;
    } finally {
      restoreProject(projectPath);
    }
    expect.fail(result, 'undefined', 'generator should have thrown an error');
  });

  it('Should emit an error event on failure', async () => {
    let errorMessage = '';
    let exitCode: number = LocalCommandExecution.SUCCESS_CODE;
    let rejectOutput: any;
    const generator = getGenerator();
    emitter.addListener(LocalCommandExecution.ERROR_EVENT, (data: Error) => {
      errorMessage = data.message;
    });
    emitter.addListener(LocalCommandExecution.EXIT_EVENT, (data: number) => {
      exitCode = data;
    });
    invalidateProject(projectPath);
    try {
      await generator.generate(
        projectPath,
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Manual
      );
    } catch ({ error }) {
      rejectOutput = error;
    } finally {
      restoreProject(projectPath);
    }
    expect(rejectOutput.message).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
    expect(errorMessage).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
    expect(exitCode).to.equal(LocalCommandExecution.FAILURE_CODE);
  });

  it('Should emit message to stderr on failure', async () => {
    let stderrInfo = '';
    let rejectOutput: any;
    const generator = getGenerator();
    emitter.addListener(LocalCommandExecution.STDERR_EVENT, (data: string) => {
      stderrInfo = data;
    });
    invalidateProject(projectPath);
    try {
      await generator.generate(
        projectPath,
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Manual
      );
    } catch ({ error }) {
      rejectOutput = error;
    } finally {
      restoreProject(projectPath);
    }
    expect(rejectOutput.message).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
    expect(stderrInfo).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
  });

  it('Should emit an exit event with code success code 0 on success', async () => {
    let exitCode = LocalCommandExecution.FAILURE_CODE;
    const generator = getGenerator();
    emitter.addListener(LocalCommandExecution.EXIT_EVENT, (data: number) => {
      exitCode = data;
    });
    try {
      const result = await generator.generate(
        projectPath,
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Manual
      );
      expect(result.error).to.be.undefined;
      expect(exitCode).to.equal(LocalCommandExecution.SUCCESS_CODE);
    } catch (e) {
      expect.fail(e, 'undefined', 'generator should not have thrown an error');
    }
  });

  it('Should log the number of created faux classes on success', async () => {
    const generator = getGenerator();
    let stdoutInfo = '';
    let result: SObjectRefreshResult;
    emitter.addListener(LocalCommandExecution.STDOUT_EVENT, (data: string) => {
      stdoutInfo = data;
    });
    try {
      result = await generator.generate(
        projectPath,
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Manual
      );
      expect(result.error).to.be.undefined;
      expect(result.data.customObjects).to.eql(3);
      expect(stdoutInfo).to.contain(
        nls.localize('fetched_sobjects_length_text', 3, 'Custom')
      );
    } catch (e) {
      expect.fail(e, 'undefined', 'generator should not have thrown an error');
    }
  });
});

// easy way to force the generator to throw an error
const BOGUS_PROJECT_FILE = `bogus${SFDX_PROJECT_FILE}`;
function invalidateProject(projectPath: string) {
  renameSync(
    path.join(projectPath, SFDX_PROJECT_FILE),
    path.join(projectPath, BOGUS_PROJECT_FILE)
  );
}

function restoreProject(projectPath: string) {
  renameSync(
    path.join(projectPath, BOGUS_PROJECT_FILE),
    path.join(projectPath, SFDX_PROJECT_FILE)
  );
}
