/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentStatus, type DeployResult } from '@salesforce/source-deploy-retrieve';
import { getMergedDeployFailures } from '../../../../src/shared/deploy/getMergedDeployFailures';

describe('getMergedDeployFailures', () => {
  it('adds componentFailures from the API when missing from file responses', () => {
    const result = {
      getFileResponses: () => [],
      response: {
        details: {
          componentFailures: {
            fullName: 'MyBundle',
            componentType: 'LightningUIBundle',
            problem: 'Enable the org permission to deploy UI bundles.',
            problemType: 'Error'
          }
        }
      }
    } as unknown as DeployResult;

    const merged = getMergedDeployFailures(result);
    expect(merged).toHaveLength(1);
    expect(merged[0].error).toBe('Enable the org permission to deploy UI bundles.');
    expect(merged[0].type).toBe('LightningUIBundle');
    expect(merged[0].state).toBe(ComponentStatus.Failed);
  });

  it('does not duplicate a failure already present in file responses', () => {
    const fileFailure = {
      fullName: 'MyBundle',
      type: 'LightningUIBundle',
      state: ComponentStatus.Failed as const,
      error: 'from file response',
      problemType: 'Error' as const,
      filePath: '/proj/force-app/main/default/...'
    };
    const result = {
      getFileResponses: () => [fileFailure],
      response: {
        details: {
          componentFailures: {
            fullName: 'MyBundle',
            componentType: 'LightningUIBundle',
            problem: 'duplicate from API',
            problemType: 'Error'
          }
        }
      }
    } as unknown as DeployResult;

    const merged = getMergedDeployFailures(result);
    expect(merged).toHaveLength(1);
    expect(merged[0].error).toBe('from file response');
  });

  it('returns only file failures when componentFailures count does not exceed file failures', () => {
    const fileFailure = {
      fullName: 'A',
      type: 'CustomObject',
      state: ComponentStatus.Failed as const,
      error: 'e',
      problemType: 'Error' as const
    };
    const result = {
      getFileResponses: () => [fileFailure],
      response: {
        details: {
          componentFailures: {
            fullName: 'B',
            componentType: 'CustomObject',
            problem: 'other',
            problemType: 'Error'
          }
        }
      }
    } as unknown as DeployResult;

    const merged = getMergedDeployFailures(result);
    expect(merged).toHaveLength(1);
    expect(merged[0].fullName).toBe('A');
  });
});
