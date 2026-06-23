/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DeployOutcome } from 'salesforcedx-vscode-services';
import { getMergedDeployFailures } from '../../../../src/shared/deploy/getMergedDeployFailures';
import { formatDeployOutput } from '../../../../src/shared/deploy/formatDeployOutput';

describe('deployFromOutcome', () => {
  it('uses shared formatDeployOutput for success outcome', () => {
    const outcome: DeployOutcome = {
      success: true,
      status: 'Succeeded',
      appliedToOrg: true,
      completedDate: '2026-06-23T12:00:00.000Z',
      fileResponses: [
        {
          fullName: 'GoodClass',
          type: 'ApexClass',
          state: 'Created',
          filePath: '/proj/force-app/main/default/classes/GoodClass.cls'
        }
      ],
      componentFailures: []
    };

    const output = formatDeployOutput(outcome);
    expect(output).toContain('=== Deployed Source (1) ===');
    expect(output).not.toContain('Deploy Errors');
  });

  it('uses shared getMergedDeployFailures for failure outcome', () => {
    const outcome: DeployOutcome = {
      success: false,
      status: 'Failed',
      appliedToOrg: false,
      completedDate: '2026-06-23T12:00:00.000Z',
      fileResponses: [
        {
          fullName: 'BadClass',
          type: 'ApexClass',
          state: 'Failed',
          error: 'Syntax error on line 5',
          problemType: 'Error',
          filePath: '/proj/force-app/main/default/classes/BadClass.cls'
        }
      ],
      componentFailures: []
    };

    const failures = getMergedDeployFailures(outcome);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toBe('Syntax error on line 5');

    const output = formatDeployOutput(outcome);
    expect(output).toContain('=== Deploy Errors (1) ===');
    expect(output).toContain('Syntax error on line 5');
  });

  it('merges componentFailures without filePath', () => {
    const outcome: DeployOutcome = {
      success: false,
      status: 'Failed',
      appliedToOrg: false,
      completedDate: '2026-06-23T12:00:00.000Z',
      fileResponses: [],
      componentFailures: [
        {
          fullName: 'SomeObject',
          type: 'CustomObject',
          problem: 'Missing required field',
          problemType: 'Error'
        }
      ]
    };

    const failures = getMergedDeployFailures(outcome);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toBe('Missing required field');

    const output = formatDeployOutput(outcome);
    expect(output).toContain('=== Deploy Errors (1) ===');
    expect(output).toContain('Missing required field');
  });
});
