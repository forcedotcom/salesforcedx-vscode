/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DeployOutcome } from 'salesforcedx-vscode-services';
import { getMergedDeployFailures } from '../../../../src/shared/deploy/getMergedDeployFailures';

describe('getMergedDeployFailures', () => {
  it('adds componentFailures from the API when missing from file responses', () => {
    const outcome: DeployOutcome = {
      success: false,
      status: 'Failed',
      appliedToOrg: false,
      completedDate: '2026-06-23T00:00:00.000Z',
      fileResponses: [],
      componentFailures: [
        {
          fullName: 'MyBundle',
          type: 'LightningUIBundle',
          problem: 'Enable the org permission to deploy UI bundles.',
          problemType: 'Error'
        }
      ]
    };

    const merged = getMergedDeployFailures(outcome);
    expect(merged).toHaveLength(1);
    expect(merged[0].error).toBe('Enable the org permission to deploy UI bundles.');
    expect(merged[0].type).toBe('LightningUIBundle');
    expect(merged[0].state).toBe('Failed');
  });

  it('does not duplicate a failure already present in file responses', () => {
    const outcome: DeployOutcome = {
      success: false,
      status: 'Failed',
      appliedToOrg: false,
      completedDate: '2026-06-23T00:00:00.000Z',
      fileResponses: [
        {
          fullName: 'MyBundle',
          type: 'LightningUIBundle',
          state: 'Failed',
          error: 'from file response',
          problemType: 'Error',
          filePath: '/proj/force-app/main/default/...'
        }
      ],
      componentFailures: [
        {
          fullName: 'MyBundle',
          type: 'LightningUIBundle',
          problem: 'duplicate from API',
          problemType: 'Error'
        }
      ]
    };

    const merged = getMergedDeployFailures(outcome);
    expect(merged).toHaveLength(1);
    expect(merged[0].error).toBe('from file response');
  });

  it('returns only file failures when componentFailures count does not exceed file failures', () => {
    const outcome: DeployOutcome = {
      success: false,
      status: 'Failed',
      appliedToOrg: false,
      completedDate: '2026-06-23T00:00:00.000Z',
      fileResponses: [
        {
          fullName: 'A',
          type: 'CustomObject',
          state: 'Failed',
          error: 'e',
          problemType: 'Error'
        }
      ],
      componentFailures: [
        {
          fullName: 'B',
          type: 'CustomObject',
          problem: 'other',
          problemType: 'Error'
        }
      ]
    };

    const merged = getMergedDeployFailures(outcome);
    expect(merged).toHaveLength(1);
    expect(merged[0].fullName).toBe('A');
  });
});
