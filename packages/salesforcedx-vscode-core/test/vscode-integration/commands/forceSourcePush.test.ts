/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CONFLICT_ERROR_NAME,
  ForcePushResultParser,
  ForceSourcePushErrorResponse,
  ForceSourcePushSuccessResponse,
  PushResult
} from '@salesforce/salesforcedx-utils-vscode';
import { Row, Table } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { stub } from 'sinon';
import { channelService } from '../../../src/channels';
import { ForceSourcePushExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';

describe('Correctly output deploy results', () => {
  let errorsStub: sinon.SinonStub;
  let successesStub: sinon.SinonStub;
  let channelServiceStub: sinon.SinonStub;
  let output = '';
  const table = new Table();
  let deploySuccess: ForceSourcePushSuccessResponse;
  let deployError: ForceSourcePushErrorResponse;

  beforeEach(() => {
    output = '';
    errorsStub = stub(ForcePushResultParser.prototype, 'getErrors');
    successesStub = stub(ForcePushResultParser.prototype, 'getSuccesses');
    channelServiceStub = stub(channelService, 'appendLine');
    channelServiceStub.callsFake(line => (output += line + '\n'));
    deploySuccess = {
      status: 0,
      result: {
        pushedSource: [
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
      data: [
        {
          filePath: 'src/classes/MyClass2.cls',
          error: 'Some Error'
        } as PushResult
      ]
    };
  });

  afterEach(() => {
    errorsStub.restore();
    successesStub.restore();
    channelServiceStub.restore();
  });

  it('Should show correct heading for source:push operation', () => {
    successesStub.returns(deploySuccess);
    errorsStub.returns(undefined);

    const executor = new ForceSourcePushExecutor();
    executor.outputResult(new ForcePushResultParser('{}'));

    const successTable = table.createTable(
      (deploySuccess.result.pushedSource as unknown) as Row[],
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
    executor.outputResult(new ForcePushResultParser('{}'));

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
    executor.outputResult(new ForcePushResultParser('{}'));
    expect(output).to.be.equal('Deploy Failed: An error has occurred\n\n');
  });

  it('Should show deploy conflicts correctly', () => {
    const hasConflictsStub = stub(
      ForcePushResultParser.prototype,
      'hasConflicts'
    ).returns(true);
    deployError.name = CONFLICT_ERROR_NAME;
    deployError.data = [
      {
        state: 'Conflict',
        fullName: 'SomeClass',
        type: 'ApexClass',
        filePath: 'some/class/path'
      }
    ];
    errorsStub.returns(deployError);
    const conflictsTable = table.createTable(
      (deployError.data as unknown) as Row[],
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
    executor.outputResult(new ForcePushResultParser('{}'));

    expect(output).to.be.equal(expectedOutput);

    hasConflictsStub.restore();
  });
});
