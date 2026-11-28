/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { ComponentStatus, type DeployResult, type FileResponseFailure } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import {
  isSDRFailure,
  makeFileResponseFailure,
  ComponentSetService,
  type SalesforceVSCodeServicesApiV2
} from '@salesforce/vscode-services/v2';
import { getMergedDeployFailures } from '../../../../src/shared/deploy/getMergedDeployFailures';

const mockExtensionProvider: ExtensionProviderService['Service'] = {
  getServicesApi: Effect.succeed({
    v2: { services: { ComponentSetService } }
  } as unknown as SalesforceVSCodeServicesApiV2)
};

const run = <A>(effect: Effect.Effect<A, unknown, unknown>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(ExtensionProviderService, mockExtensionProvider),
      Effect.provideService(ComponentSetService, {
        isSDRFailure,
        makeFileResponseFailure
      } as ComponentSetService['Service'])
    ) as Effect.Effect<A, never, never>
  );

describe('getMergedDeployFailures', () => {
  it('adds componentFailures from the API when missing from file responses', async () => {
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

    const merged = await run(getMergedDeployFailures(result));
    expect(merged).toHaveLength(1);
    expect(merged[0].error).toBe('Enable the org permission to deploy UI bundles.');
    expect(merged[0].type).toBe('LightningUIBundle');
    expect(merged[0].state).toBe(ComponentStatus.Failed);
  });

  it('does not duplicate a failure already present in file responses', async () => {
    const fileFailure: FileResponseFailure = {
      fullName: 'MyBundle',
      type: 'LightningUIBundle',
      state: ComponentStatus.Failed,
      error: 'from file response',
      problemType: 'Error',
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

    const merged = await run(getMergedDeployFailures(result));
    expect(merged).toHaveLength(1);
    expect(merged[0].error).toBe('from file response');
  });

  it('returns only file failures when componentFailures count does not exceed file failures', async () => {
    const fileFailure: FileResponseFailure = {
      fullName: 'A',
      type: 'CustomObject',
      state: ComponentStatus.Failed,
      error: 'e',
      problemType: 'Error'
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

    const merged = await run(getMergedDeployFailures(result));
    expect(merged).toHaveLength(1);
    expect(merged[0].fullName).toBe('A');
  });
});
