/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalCommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import rimraf = require('rimraf');
import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as path from 'path';
import { SObjectCategory } from '../../src/describe';
import {
  CancellationToken,
  FAILURE_CODE,
  FauxClassGenerator,
  SUCCESS_CODE
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

  before(async function() {
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

    cancellationTokenSource = new util.CancellationTokenSource();

    username = await util.initializeProject(
      PROJECT_NAME,
      SIMPLE_OBJECT_SOURCE_FOLDER,
      customFields
    );

    projectPath = path.join(process.cwd(), PROJECT_NAME);
    emitter = new EventEmitter();
  });

  after(function() {
    rimraf.sync(projectPath);
    projectPath = '';
  });

  it('Should be cancellable', async () => {
    let result = '';
    const generator = getGenerator();
    cancellationTokenSource.cancel();
    try {
      result = await generator.generate(projectPath, SObjectCategory.ALL);
    } catch (e) {
      expect(e).to.equal(nls.localize('faux_generation_cancelled_text'));
    }
    expect.fail(result, 'undefined', 'generator should have thrown an error');
  });

  it('Should fail if outside a project', async () => {
    let result = '';
    const generator = getGenerator();
    const INVALID_PROJECT_NAME = 'outsideproject';
    projectPath = path.join(process.cwd(), INVALID_PROJECT_NAME);
    try {
      result = await generator.generate(projectPath, SObjectCategory.ALL);
    } catch (e) {
      expect(e).to.contain(FAILURE_CODE);
      expect(e).to.contain(nls.localize('failure_fetching_sobjects_list_text'));
    }
    expect.fail(result, 'undefined', 'generator should have thrown an error');
  });

  /*
  it('Should emit an error event on failure', async () => {

  });

  it('Should emit message to stderr on failure', async () => {

  });

  it('Should emit an exit event with code 0 on success', async () => {

  });
  */

  it('Should log the number of created faux classes on success', async () => {
    const generator = getGenerator();
    let stdoutInfo = '';
    let result = '';
    emitter.addListener(LocalCommandExecution.STDOUT_EVENT, (data: string) => {
      stdoutInfo = data;
    });
    try {
      // only fetch the custom objects to keep the execution time short
      result = await generator.generate(projectPath, SObjectCategory.CUSTOM);
    } catch (e) {
      expect.fail(e, 'undefined', 'generator should not have thrown an error');
    }
    expect(result).to.equal(SUCCESS_CODE);
    expect(stdoutInfo).to.contain(
      nls.localize('fetched_sobjects_length_text', 3, 'Custom')
    );
  });
});
