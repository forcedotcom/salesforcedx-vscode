/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, Org } from '@salesforce/core';
import { LocalCommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { fail } from 'assert';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { createSandbox } from 'sinon';
import { SObject, SObjectCategory, SObjectDescribe } from '../../src/describe';
import {
  FauxClassGenerator,
  SObjectRefreshResult,
  SObjectRefreshSource
} from '../../src/generator/fauxClassGenerator';
import { nls } from '../../src/messages';
import { CancellationTokenSource } from './integrationTestUtil';
import { mockDescribeResponse } from './mockData';

const PROJECT_NAME = `project_${new Date().getTime()}`;
const CONNECTION_DATA = {
  accessToken: '00Dxx000thisIsATestToken',
  instanceUrl: 'https://na1.salesforce.com'
};

const env = createSandbox();

// tslint:disable:no-unused-expression
describe('Generate faux classes for SObjects', () => {
  let cancellationTokenSource: CancellationTokenSource;
  let projectPath: string;
  let emitter: EventEmitter;

  function getGenerator(): FauxClassGenerator {
    return new FauxClassGenerator(emitter, cancellationTokenSource.token);
  }

  before(async () => {
    projectPath = path.join(process.cwd(), PROJECT_NAME);
    emitter = new EventEmitter();
  });

  beforeEach(() => {
    cancellationTokenSource = new CancellationTokenSource();
    env.stub(AuthInfo, 'create').returns({
      getConnectionOptions: () => CONNECTION_DATA
    });
  });

  afterEach(() => env.restore());

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

    try {
      await generator.generate(
        projectPath,
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Manual
      );
    } catch ({ error }) {
      rejectOutput = error;
    }
    expect(rejectOutput.message).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
    expect(errorMessage).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
    expect(exitCode).to.equal(LocalCommandExecution.FAILURE_CODE);
  });

  it('Should emit an error event on failure, generateMin', async () => {
    let errorMessage = '';
    let stderrInfo = '';
    let exitCode: number = LocalCommandExecution.SUCCESS_CODE;
    let rejectOutput: any;
    const generator = getGenerator();
    emitter.addListener(LocalCommandExecution.ERROR_EVENT, (data: Error) => {
      errorMessage = data.message;
    });
    emitter.addListener(LocalCommandExecution.EXIT_EVENT, (data: number) => {
      exitCode = data;
    });
    emitter.addListener(LocalCommandExecution.STDERR_EVENT, (data: string) => {
      stderrInfo = data;
    });

    try {
      await generator.generateMin(projectPath, SObjectRefreshSource.StartupMin);
    } catch ({ error }) {
      rejectOutput = error;
    }
    expect(rejectOutput.message).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
    expect(errorMessage).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
    expect(exitCode).to.equal(LocalCommandExecution.FAILURE_CODE);
    expect(stderrInfo).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
  });

  it('Should fail if outside a DX project', async () => {
    let result: SObjectRefreshResult;
    const generator = getGenerator();

    try {
      result = await generator.generate(
        projectPath,
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Manual
      );
      fail('generator should have thrown an error');
    } catch ({ error }) {
      expect(error.message).to.contain(
        nls.localize('no_generate_if_not_in_project', '')
      );
      return;
    }
  });

  it('Should fail if calling generateMin outside a DX project', async () => {
    let result: SObjectRefreshResult;
    const generator = getGenerator();

    try {
      result = await generator.generateMin(
        projectPath,
        SObjectRefreshSource.StartupMin
      );
      fail('generator should have thrown an error');
    } catch ({ error }) {
      expect(error.message).to.contain(
        nls.localize('no_generate_if_not_in_project', '')
      );
      return;
    }
  });

  it('Should be cancellable', async () => {
    env
      .stub(SObjectDescribe.prototype, 'describeGlobal')
      .returns([
        'MyCustomObject2__c',
        'MyCustomObject3__c',
        'MyCustomObject__c'
      ]);
    env.stub(fs, 'existsSync').returns(true);

    const generator = getGenerator();
    cancellationTokenSource.cancel();

    const result = await generator.generate(
      projectPath,
      SObjectCategory.CUSTOM,
      SObjectRefreshSource.Manual
    );
    expect(result.data.cancelled).to.be.true;
  });

  it('Should be cancellable, generateMin', async () => {
    env.stub(fs, 'existsSync').returns(true);

    const generator = getGenerator();
    cancellationTokenSource.cancel();

    const result = await generator.generateMin(
      projectPath,
      SObjectRefreshSource.StartupMin
    );
    expect(result.data.cancelled).to.be.true;
  });

  it('Should emit message to stderr on failure', async () => {
    let stderrInfo = '';
    let rejectOutput: any;
    const generator = getGenerator();
    emitter.addListener(LocalCommandExecution.STDERR_EVENT, (data: string) => {
      stderrInfo = data;
    });

    try {
      await generator.generate(
        projectPath,
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Manual
      );
    } catch ({ error }) {
      rejectOutput = error;
    }
    expect(rejectOutput.message).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
    expect(stderrInfo).to.contain(
      nls.localize('no_generate_if_not_in_project', '')
    );
  });

  describe('Check results', () => {
    beforeEach(() => {
      env.stub(fs, 'existsSync').returns(true);
      env.stub(Connection.prototype, 'request').resolves(mockDescribeResponse);
      env.stub(FauxClassGenerator.prototype, 'generateFauxClass');
      env
        .stub(SObjectDescribe.prototype, 'describeGlobal')
        .returns(['ApexPageInfo']);
    });

    it('Should emit an exit event with code success code 0 on success', async () => {
      let exitCode = LocalCommandExecution.FAILURE_CODE;

      const generator = getGenerator();
      emitter.addListener(LocalCommandExecution.EXIT_EVENT, (data: number) => {
        exitCode = data;
      });

      const result = await generator.generate(
        projectPath,
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Manual
      );
      expect(result.error).to.be.undefined;
      expect(exitCode).to.equal(LocalCommandExecution.SUCCESS_CODE);
    });

    it('Should log the number of created faux classes on success', async () => {
      const generator = getGenerator();
      let stdoutInfo = '';
      let result: SObjectRefreshResult;
      emitter.addListener(
        LocalCommandExecution.STDOUT_EVENT,
        (data: string) => {
          stdoutInfo = data;
        }
      );

      result = await generator.generate(
        projectPath,
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Manual
      );

      expect(result.error).to.be.undefined;
      expect(result.data.standardObjects).to.eql(1);
      expect(stdoutInfo).to.contain(
        nls.localize('fetched_sobjects_length_text', 1, 'Standard')
      );
    });
  });

  describe('Check generateMin results', () => {
    beforeEach(() => {
      env.stub(fs, 'existsSync').returns(true);
      env.stub(Connection.prototype, 'request').resolves(mockDescribeResponse);
      env.stub(FauxClassGenerator.prototype, 'generateFauxClass');
    });

    it('Should log the number of created faux classes on generateMin success', async () => {
      const generator = getGenerator();
      let stdoutInfo = '';
      let result: SObjectRefreshResult;
      emitter.addListener(
        LocalCommandExecution.STDOUT_EVENT,
        (data: string) => {
          stdoutInfo = data;
        }
      );
      let exitCode = LocalCommandExecution.FAILURE_CODE;
      emitter.addListener(LocalCommandExecution.EXIT_EVENT, (data: number) => {
        exitCode = data;
      });

      result = await generator.generateMin(
        projectPath,
        SObjectRefreshSource.StartupMin
      );

      expect(result.error).to.be.undefined;
      expect(result.data.standardObjects).to.eql(16);
      expect(result.data.customObjects).to.eql(0);
      expect(stdoutInfo).to.contain(
        nls.localize('fetched_sobjects_length_text', 16, 'Standard')
      );
      expect(exitCode).to.equal(LocalCommandExecution.SUCCESS_CODE);
    });
  });
});
