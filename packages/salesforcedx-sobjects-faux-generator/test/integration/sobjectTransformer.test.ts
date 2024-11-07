/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo } from '@salesforce/core-bundle';
import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import { fail } from 'assert';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSandbox } from 'sinon';
import { SObjectTransformer } from '../../src';
import { ERROR_EVENT, EXIT_EVENT, FAILURE_CODE, STDERR_EVENT, STDOUT_EVENT, SUCCESS_CODE } from '../../src/constants';
import { nls } from '../../src/messages';
import { MinObjectRetriever } from '../../src/retriever';
import { CancellationTokenSource } from './integrationTestUtil';

const PROJECT_NAME = `project_${new Date().getTime()}`;
const CONNECTION_DATA = {
  accessToken: '00Dxx000thisIsATestToken',
  instanceUrl: 'https://na1.salesforce.com'
};

const env = createSandbox();
const tempFolder = path.join(os.tmpdir(), PROJECT_NAME);

// tslint:disable:no-unused-expression
describe('Transform sobject definitions', () => {
  let cancellationTokenSource: CancellationTokenSource;
  let emitter: EventEmitter;

  beforeEach(() => {
    env.stub(projectPaths, 'stateFolder').returns(tempFolder);
    emitter = new EventEmitter();
    cancellationTokenSource = new CancellationTokenSource();
    env.stub(AuthInfo, 'create').returns({
      getConnectionOptions: () => CONNECTION_DATA
    });
  });

  afterEach(() => env.restore());

  it('Should emit an error event on retriever failure', async () => {
    env.stub(fs, 'existsSync').returns(true);

    let errorMessage = '';
    let exitCode: number = SUCCESS_CODE;
    let rejectOutput: any;
    const transformer = new SObjectTransformer(
      emitter,
      [
        {
          retrieve: () => {
            throw new Error('Retrieve Error');
          }
        }
      ],
      [],
      cancellationTokenSource.token
    );
    emitter.addListener(ERROR_EVENT, (data: Error) => {
      errorMessage = data.message;
    });
    emitter.addListener(EXIT_EVENT, (data: number) => {
      exitCode = data;
    });

    try {
      await transformer.transform();
    } catch ({ error }) {
      rejectOutput = error;
    }

    expect(rejectOutput.message).to.contain('Retrieve Error');
    expect(errorMessage).to.contain('Retrieve Error');
    expect(exitCode).to.equal(FAILURE_CODE);
  });

  it('Should emit an error event on generator failure', async () => {
    env.stub(fs, 'existsSync').returns(true);

    let errorMessage = '';
    let exitCode: number = SUCCESS_CODE;
    let rejectOutput: any;
    const transformer = new SObjectTransformer(
      emitter,
      [],
      [
        {
          generate: () => {
            throw new Error('Generate Error');
          }
        }
      ],
      cancellationTokenSource.token
    );
    emitter.addListener(ERROR_EVENT, (data: Error) => {
      errorMessage = data.message;
    });
    emitter.addListener(EXIT_EVENT, (data: number) => {
      exitCode = data;
    });

    try {
      await transformer.transform();
    } catch ({ error }) {
      rejectOutput = error;
    }

    expect(rejectOutput.message).to.contain('Generate Error');
    expect(errorMessage).to.contain('Generate Error');
    expect(exitCode).to.equal(FAILURE_CODE);
  });

  it('Should fail if outside a DX project', async () => {
    env.stub(fs, 'existsSync').returns(false);

    const transformer = new SObjectTransformer(emitter, [], [], cancellationTokenSource.token);

    try {
      await transformer.transform();
      fail('transformer should have thrown an error');
    } catch ({ error }) {
      expect(error.message).to.contain(nls.localize('no_generate_if_not_in_project', ''));
      return;
    }
  });

  it('Should be cancellable', async () => {
    env.stub(fs, 'existsSync').returns(true);
    env.stub(MinObjectRetriever.prototype, 'retrieve').returns([]);

    const transformer = new SObjectTransformer(emitter, [new MinObjectRetriever()], [], cancellationTokenSource.token);
    cancellationTokenSource.cancel();

    const result = await transformer.transform();
    expect(result.data.cancelled).to.be.true;
  });

  it('Should emit message to stderr on failure', async () => {
    env.stub(fs, 'existsSync').returns(true);

    let stderrInfo = '';
    let rejectOutput: any;
    const transformer = new SObjectTransformer(
      emitter,
      [],
      [
        {
          generate: () => {
            throw new Error('Broken Generator');
          }
        }
      ],
      cancellationTokenSource.token
    );
    emitter.addListener(STDERR_EVENT, (data: string) => {
      stderrInfo = data;
    });

    try {
      await transformer.transform();
    } catch ({ error }) {
      rejectOutput = error;
    }

    expect(rejectOutput.message).to.contain('Broken Generator');
    expect(stderrInfo).to.contain('Broken Generator');
  });

  describe('Check results', () => {
    beforeEach(() => {
      env.stub(fs, 'existsSync').returns(true);
    });

    it('Should emit an exit event with code success code 0 on success', async () => {
      let exitCode = FAILURE_CODE;

      const transformer = new SObjectTransformer(emitter, [], [], cancellationTokenSource.token);
      emitter.addListener(EXIT_EVENT, (data: number) => {
        exitCode = data;
      });

      const result = await transformer.transform();
      expect(result.error).to.be.undefined;
      expect(exitCode).to.equal(SUCCESS_CODE);
    });

    it('Should log the number of standard objects processed on success', async () => {
      const transformer = new SObjectTransformer(
        emitter,
        [
          {
            retrieve: out => {
              out.addStandard([
                {
                  name: 'Account',
                  label: 'Account',
                  queryable: true,
                  custom: false,
                  fields: [],
                  childRelationships: []
                }
              ]);
              return Promise.resolve();
            }
          }
        ],
        [],
        cancellationTokenSource.token
      );

      let stdoutInfo = '';
      emitter.addListener(STDOUT_EVENT, (data: string) => {
        stdoutInfo = data;
      });

      const result = await transformer.transform();

      expect(result.error).to.be.undefined;
      expect(result.data.standardObjects).to.eql(1);
      expect(stdoutInfo).to.contain(nls.localize('processed_sobjects_length_text', 1, 'Standard'));
    });

    it('Should log the number of custom objects processed on success', async () => {
      const transformer = new SObjectTransformer(
        emitter,
        [
          {
            retrieve: out => {
              out.addCustom([
                {
                  name: 'Custom_1',
                  label: 'Custom_1',
                  queryable: true,
                  custom: true,
                  fields: [],
                  childRelationships: []
                }
              ]);
              return Promise.resolve();
            }
          }
        ],
        [],
        cancellationTokenSource.token
      );

      let stdoutInfo = '';
      emitter.addListener(STDOUT_EVENT, (data: string) => {
        stdoutInfo = data;
      });

      const result = await transformer.transform();

      expect(result.error).to.be.undefined;
      expect(result.data.customObjects).to.eql(1);
      expect(stdoutInfo).to.contain(nls.localize('processed_sobjects_length_text', 1, 'Custom'));
    });
  });
});
