/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { URI } from 'vscode-uri';
import {
  ComponentStatus,
  type DeployResult,
  type FileResponseFailure,
  type FileResponseSuccess,
  RequestStatus
} from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import {
  isSDRFailure,
  isSDRSuccess,
  makeFileResponseFailure,
  toComponentStatusChangeType
} from 'salesforcedx-vscode-services/src/core/sdrGuards';
import { formatDeployOutput } from '../../../../src/shared/deploy/formatDeployOutput';

const classesDir = path.join(path.sep, 'proj', 'force-app', 'main', 'default', 'classes');

const mockExtensionProvider: ExtensionProviderService = {
  getServicesApi: Effect.succeed({
    services: {
      ComponentSetService: Effect.succeed({
        isSDRSuccess,
        isSDRFailure,
        getComponentState: (component: FileResponseSuccess) => toComponentStatusChangeType(component.state),
        makeFileResponseFailure
      })
    }
  } as unknown as SalesforceVSCodeServicesApi)
};

const run = (effect: Effect.Effect<string, unknown, unknown>) =>
  Effect.runPromise(
    effect.pipe(Effect.provideService(ExtensionProviderService, mockExtensionProvider)) as Effect.Effect<
      string,
      never,
      never
    >
  );

describe('formatDeployOutput', () => {
  describe('when deploy did not apply to the org (Failed, Canceled, or missing status)', () => {
    it('uses not-deployed wording and avoids raw Created for new components', async () => {
      const ok: FileResponseSuccess = {
        fullName: 'GoodClass',
        type: 'ApexClass',
        state: ComponentStatus.Created,
        filePath: path.join(classesDir, 'GoodClass.cls')
      };
      const bad: FileResponseFailure = {
        fullName: 'BadClass',
        type: 'ApexClass',
        state: ComponentStatus.Failed,
        error: 'Syntax error',
        problemType: 'Error',
        filePath: path.join(classesDir, 'BadClass.cls')
      };
      const result = {
        getFileResponses: () => [ok, bad],
        response: { status: RequestStatus.Failed }
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('Components without file-level errors');
      expect(out).toContain('not deployed');
      expect(out).toContain('no metadata changes were applied to the org');
      expect(out).toContain('Would have been created —');
      expect(out).not.toContain('=== Deployed Source');
      expect(out).not.toMatch(/^\s*Created\s+/m);
    });

    it('labels unchanged components when deploy failed', async () => {
      const unchanged: FileResponseSuccess = {
        fullName: 'StableClass',
        type: 'ApexClass',
        state: ComponentStatus.Unchanged,
        filePath: path.join(classesDir, 'StableClass.cls')
      };
      const bad: FileResponseFailure = {
        fullName: 'BadClass',
        type: 'ApexClass',
        state: ComponentStatus.Failed,
        error: 'Error',
        problemType: 'Error',
        filePath: path.join(classesDir, 'BadClass.cls')
      };
      const result = {
        getFileResponses: () => [unchanged, bad],
        response: { status: RequestStatus.Failed }
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('Would have had no changes —');
    });

    it('labels changed components when deploy failed', async () => {
      const changed: FileResponseSuccess = {
        fullName: 'EditedClass',
        type: 'ApexClass',
        state: ComponentStatus.Changed,
        filePath: path.join(classesDir, 'EditedClass.cls')
      };
      const bad: FileResponseFailure = {
        fullName: 'BadClass',
        type: 'ApexClass',
        state: ComponentStatus.Failed,
        error: 'Error',
        problemType: 'Error',
        filePath: path.join(classesDir, 'BadClass.cls')
      };
      const result = {
        getFileResponses: () => [changed, bad],
        response: { status: RequestStatus.Failed }
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('Would have been updated —');
    });

    it('uses not-deployed section when status is Canceled', async () => {
      const ok: FileResponseSuccess = {
        fullName: 'GoodClass',
        type: 'ApexClass',
        state: ComponentStatus.Created,
        filePath: path.join(classesDir, 'GoodClass.cls')
      };
      const result = {
        getFileResponses: () => [ok],
        response: { status: RequestStatus.Canceled }
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('Components without file-level errors');
      expect(out).toContain('Would have been created —');
      expect(out).not.toContain('=== Deployed Source');
    });

    it('treats missing response status as not applied', async () => {
      const ok: FileResponseSuccess = {
        fullName: 'GoodClass',
        type: 'ApexClass',
        state: ComponentStatus.Created,
        filePath: path.join(classesDir, 'GoodClass.cls')
      };
      const result = {
        getFileResponses: () => [ok],
        response: {}
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('Would have been created —');
      expect(out).not.toContain('=== Deployed Source');
    });

    it('formats deletes that were not applied when deploy failed', async () => {
      const deleted: FileResponseSuccess = {
        fullName: 'RemoveClass',
        type: 'ApexClass',
        state: ComponentStatus.Deleted,
        filePath: path.join(classesDir, 'RemoveClass.cls')
      };
      const bad: FileResponseFailure = {
        fullName: 'BadBundle',
        type: 'LightningUIBundle',
        state: ComponentStatus.Failed,
        error: 'Blocked',
        problemType: 'Error'
      };
      const result = {
        getFileResponses: () => [deleted, bad],
        response: { status: RequestStatus.Failed }
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('Deletes without file-level errors');
      expect(out).toContain('Would have been deleted —');
    });

    it('outputs only deploy errors when every file response failed', async () => {
      const bad: FileResponseFailure = {
        fullName: 'BadClass',
        type: 'ApexClass',
        state: ComponentStatus.Failed,
        error: 'Only failure',
        problemType: 'Error',
        filePath: path.join(classesDir, 'BadClass.cls')
      };
      const result = {
        getFileResponses: () => [bad],
        response: { status: RequestStatus.Failed }
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('=== Deploy Errors (1) ===');
      expect(out).toContain('Only failure');
      expect(out).not.toContain('Components without file-level errors');
    });

    it('includes merged componentFailures from the API in the error section', async () => {
      const result = {
        getFileResponses: () => [],
        response: {
          status: RequestStatus.Failed,
          details: {
            componentFailures: {
              fullName: 'OnlyApi',
              componentType: 'CustomObject',
              problem: 'Problem from API details',
              problemType: 'Error'
            }
          }
        }
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('=== Deploy Errors (1) ===');
      expect(out).toContain('Problem from API details');
    });
  });

  describe('when deploy applied to the org (Succeeded or SucceededPartial)', () => {
    it('uses Deployed Source with raw API state when deploy succeeded', async () => {
      const ok: FileResponseSuccess = {
        fullName: 'GoodClass',
        type: 'ApexClass',
        state: ComponentStatus.Created,
        filePath: path.join(classesDir, 'GoodClass.cls')
      };
      const result = {
        getFileResponses: () => [ok],
        response: { status: RequestStatus.Succeeded }
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('=== Deployed Source (1) ===');
      expect(out).toContain(`Created ApexClass ${URI.file(path.join(classesDir, 'GoodClass.cls')).toString()}`);
      expect(out).not.toContain('not deployed');
      expect(out).not.toContain('Would have been created');
    });

    it('lists multiple deployed components with correct count', async () => {
      const a: FileResponseSuccess = {
        fullName: 'A',
        type: 'ApexClass',
        state: ComponentStatus.Created,
        filePath: path.join(classesDir, 'A.cls')
      };
      const b: FileResponseSuccess = {
        fullName: 'B',
        type: 'ApexClass',
        state: ComponentStatus.Changed,
        filePath: path.join(classesDir, 'B.cls')
      };
      const result = {
        getFileResponses: () => [a, b],
        response: { status: RequestStatus.Succeeded }
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('=== Deployed Source (2) ===');
    });

    it('uses Deployed Source for successful components when status is SucceededPartial', async () => {
      const ok: FileResponseSuccess = {
        fullName: 'GoodClass',
        type: 'ApexClass',
        state: ComponentStatus.Created,
        filePath: path.join(classesDir, 'GoodClass.cls')
      };
      const bad: FileResponseFailure = {
        fullName: 'BadClass',
        type: 'ApexClass',
        state: ComponentStatus.Failed,
        error: 'Syntax error',
        problemType: 'Error',
        filePath: path.join(classesDir, 'BadClass.cls')
      };
      const result = {
        getFileResponses: () => [ok, bad],
        response: { status: RequestStatus.SucceededPartial }
      } as unknown as DeployResult;

      const out = await run(formatDeployOutput(result));
      expect(out).toContain('=== Deployed Source (1) ===');
      expect(out).toContain('=== Deploy Errors (1) ===');
    });
  });
});
