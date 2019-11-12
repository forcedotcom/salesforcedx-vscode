/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CONFLICT_ERROR_NAME,
  DeployResult,
  ForceDeployResultParser,
  ForceSourceDeployErrorResponse,
  ForceSourceDeploySuccessResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import { expect } from 'chai';
import { stub } from 'sinon';
import { channelService } from '../../../src/channels';
import { BaseDeployExecutor } from '../../../src/commands/baseDeployCommand';
import { ForceSourceDeployManifestExecutor } from '../../../src/commands/forceSourceDeployManifest';
import { ForceSourceDeploySourcePathExecutor } from '../../../src/commands/forceSourceDeploySourcePath';
import { ForceSourcePushExecutor } from '../../../src/commands/forceSourcePush';
import { nls } from '../../../src/messages';

describe('Correctly output deploy results', () => {
  let errorsStub: sinon.SinonStub;
  let successesStub: sinon.SinonStub;
  let channelServiceStub: sinon.SinonStub;
  let output = '';
  const table = new Table();
  let deploySuccess: ForceSourceDeploySuccessResponse;
  let deployError: ForceSourceDeployErrorResponse;

  beforeEach(() => {
    output = '';
    errorsStub = stub(ForceDeployResultParser.prototype, 'getErrors');
    successesStub = stub(ForceDeployResultParser.prototype, 'getSuccesses');
    channelServiceStub = stub(channelService, 'appendLine');
    channelServiceStub.callsFake(line => (output += line + '\n'));
    deploySuccess = {
      status: 0,
      result: {
        deployedSource: [
          {
            state: 'Add',
            type: 'ApexClass',
            fullName: 'MyClass',
            filePath: 'src/classes/MyClass.cls'
          }
        ]
      }
    };
    deployError = {
      status: 1,
      name: 'Deploy Failed',
      message: 'There was a failure',
      stack: 'A stack',
      warnings: ['A warning'],
      result: [
        {
          filePath: 'src/classes/MyClass2.cls',
          error: 'Some Error'
        } as DeployResult
      ]
    };
  });

  afterEach(() => {
    errorsStub.restore();
    successesStub.restore();
    channelServiceStub.restore();
  });

  it('Should display correct headings and format for a deploy', () => {
    const resultParser = new ForceDeployResultParser('{}');
    successesStub.returns(deploySuccess);
    errorsStub.returns(deployError);

    let executor: BaseDeployExecutor = new ForceSourceDeployManifestExecutor();
    executor.outputResult(resultParser);

    const successTable = table.createTable(
      (deploySuccess.result.deployedSource as unknown) as Row[],
      [
        { key: 'state', label: nls.localize('table_header_state') },
        { key: 'fullName', label: nls.localize('table_header_full_name') },
        { key: 'type', label: nls.localize('table_header_type') },
        { key: 'filePath', label: nls.localize('table_header_project_path') }
      ],
      nls.localize('table_title_deployed_source')
    );
    const errorTable = table.createTable(
      (deployError.result as unknown) as Row[],
      [
        {
          key: 'filePath',
          label: nls.localize('table_header_project_path')
        },
        { key: 'error', label: nls.localize('table_header_errors') }
      ],
      nls.localize(`table_title_deploy_errors`)
    );
    const expectedOutput = `${successTable}\n${errorTable}\n`;

    expect(output).to.be.equal(expectedOutput);

    // Let's make sure ForceSourceDeploySourcePath returns the right DeployType
    output = '';
    executor = new ForceSourceDeploySourcePathExecutor();
    executor.outputResult(resultParser);
    expect(output).to.be.equal(expectedOutput);
  });

  it('Should only show deploy errors if no successes', () => {
    successesStub.returns(undefined);
    errorsStub.returns(deployError);

    const executor = new ForceSourceDeployManifestExecutor();
    executor.outputResult(new ForceDeployResultParser('{}'));

    const errorTable = table.createTable(
      (deployError.result as unknown) as Row[],
      [
        {
          key: 'filePath',
          label: nls.localize('table_header_project_path')
        },
        { key: 'error', label: nls.localize('table_header_errors') }
      ],
      nls.localize(`table_title_deploy_errors`)
    );
    expect(output).to.be.equal(`${errorTable}\n`);
  });

  it('Should only show deploy successes if no errors', () => {
    successesStub.returns(deploySuccess);
    errorsStub.returns(undefined);

    const executor = new ForceSourceDeployManifestExecutor();
    executor.outputResult(new ForceDeployResultParser('{}'));

    const successTable = table.createTable(
      (deploySuccess.result.deployedSource as unknown) as Row[],
      [
        { key: 'state', label: nls.localize('table_header_state') },
        { key: 'fullName', label: nls.localize('table_header_full_name') },
        { key: 'type', label: nls.localize('table_header_type') },
        { key: 'filePath', label: nls.localize('table_header_project_path') }
      ],
      nls.localize('table_title_deployed_source')
    );
    expect(output).to.be.equal(`${successTable}\n`);
  });

  it('Should show correct heading for source:push operation', () => {
    successesStub.returns(deploySuccess);
    errorsStub.returns(undefined);

    const executor = new ForceSourcePushExecutor();
    executor.outputResult(new ForceDeployResultParser('{}'));

    const successTable = table.createTable(
      (deploySuccess.result.deployedSource as unknown) as Row[],
      [
        { key: 'state', label: nls.localize('table_header_state') },
        { key: 'fullName', label: nls.localize('table_header_full_name') },
        { key: 'type', label: nls.localize('table_header_type') },
        { key: 'filePath', label: nls.localize('table_header_project_path') }
      ],
      nls.localize('table_title_pushed_source')
    );
    expect(output).to.be.equal(`${successTable}\n`);
  });

  it('Should show no results found for source:push operation with no new source', () => {
    successesStub.returns({ status: 0, result: { deployedSource: [] } });
    errorsStub.returns(undefined);

    const executor = new ForceSourcePushExecutor();
    executor.outputResult(new ForceDeployResultParser('{}'));

    const successTable = table.createTable(
      [],
      [
        { key: 'state', label: nls.localize('table_header_state') },
        { key: 'fullName', label: nls.localize('table_header_full_name') },
        { key: 'type', label: nls.localize('table_header_type') },
        { key: 'filePath', label: nls.localize('table_header_project_path') }
      ],
      nls.localize('table_title_pushed_source')
    );
    const expectedOutput = `${successTable}\n${nls.localize(
      'table_no_results_found'
    )}\n\n`;
    expect(output).to.be.equal(expectedOutput);
  });

  it('Should show error name and message if there are no results', () => {
    successesStub.returns(undefined);
    errorsStub.returns({
      status: 1,
      name: 'Deploy Failed',
      message: 'An error has occurred'
    });

    const executor = new ForceSourcePushExecutor();
    executor.outputResult(new ForceDeployResultParser('{}'));
    expect(output).to.be.equal('Deploy Failed: An error has occurred\n\n');
  });

  it('Should show deploy conflicts correctly', () => {
    const hasConflictsStub = stub(
      ForceDeployResultParser.prototype,
      'hasConflicts'
    ).returns(true);
    deployError.name = CONFLICT_ERROR_NAME;
    deployError.result = [
      {
        state: 'Conflict',
        fullName: 'SomeClass',
        type: 'ApexClass',
        filePath: 'some/class/path'
      }
    ];
    errorsStub.returns(deployError);
    const conflictsTable = table.createTable(
      (deployError.result as unknown) as Row[],
      [
        { key: 'state', label: nls.localize('table_header_state') },
        { key: 'fullName', label: nls.localize('table_header_full_name') },
        { key: 'type', label: nls.localize('table_header_type') },
        { key: 'filePath', label: nls.localize('table_header_project_path') }
      ]
    );
    const expectedOutput = `${nls.localize(
      'push_conflicts_error'
    )}\n\n${conflictsTable}\n`;
    const executor = new ForceSourcePushExecutor();
    executor.outputResult(new ForceDeployResultParser('{}'));

    expect(output).to.be.equal(expectedOutput);

    hasConflictsStub.restore();
  });
});
