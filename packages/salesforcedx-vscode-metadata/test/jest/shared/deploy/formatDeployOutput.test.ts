/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { URI } from 'vscode-uri';
import type { DeployOutcome } from 'salesforcedx-vscode-services';
import { formatDeployOutput } from '../../../../src/shared/deploy/formatDeployOutput';

const classesDir = path.join(path.sep, 'proj', 'force-app', 'main', 'default', 'classes');

describe('formatDeployOutput', () => {
  describe('when deploy did not apply to the org (Failed, Canceled, or missing status)', () => {
    it('uses not-deployed wording and avoids raw Created for new components', () => {
      const outcome: DeployOutcome = {
        success: false,
        status: 'Failed',
        appliedToOrg: false,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [
          {
            fullName: 'GoodClass',
            type: 'ApexClass',
            state: 'Created',
            filePath: path.join(classesDir, 'GoodClass.cls')
          },
          {
            fullName: 'BadClass',
            type: 'ApexClass',
            state: 'Failed',
            error: 'Syntax error',
            problemType: 'Error',
            filePath: path.join(classesDir, 'BadClass.cls')
          }
        ],
        componentFailures: []
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('Components without file-level errors');
      expect(out).toContain('not deployed');
      expect(out).toContain('no metadata changes were applied to the org');
      expect(out).toContain('Would have been created');
      expect(out).not.toContain('=== Deployed Source');
      expect(out).not.toMatch(/^\s*Created\s+/m);
    });

    it('labels unchanged components when deploy failed', () => {
      const outcome: DeployOutcome = {
        success: false,
        status: 'Failed',
        appliedToOrg: false,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [
          {
            fullName: 'StableClass',
            type: 'ApexClass',
            state: 'Unchanged',
            filePath: path.join(classesDir, 'StableClass.cls')
          },
          {
            fullName: 'BadClass',
            type: 'ApexClass',
            state: 'Failed',
            error: 'Error',
            problemType: 'Error',
            filePath: path.join(classesDir, 'BadClass.cls')
          }
        ],
        componentFailures: []
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('Would have had no changes —');
    });

    it('labels changed components when deploy failed', () => {
      const outcome: DeployOutcome = {
        success: false,
        status: 'Failed',
        appliedToOrg: false,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [
          {
            fullName: 'EditedClass',
            type: 'ApexClass',
            state: 'Changed',
            filePath: path.join(classesDir, 'EditedClass.cls')
          },
          {
            fullName: 'BadClass',
            type: 'ApexClass',
            state: 'Failed',
            error: 'Error',
            problemType: 'Error',
            filePath: path.join(classesDir, 'BadClass.cls')
          }
        ],
        componentFailures: []
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('Would have been updated —');
    });

    it('uses not-deployed section when status is Canceled', () => {
      const outcome: DeployOutcome = {
        success: false,
        status: 'Canceled',
        appliedToOrg: false,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [
          {
            fullName: 'GoodClass',
            type: 'ApexClass',
            state: 'Created',
            filePath: path.join(classesDir, 'GoodClass.cls')
          }
        ],
        componentFailures: []
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('Components without file-level errors');
      expect(out).toContain('Would have been created —');
      expect(out).not.toContain('=== Deployed Source');
    });

    it('treats missing response status as not applied', () => {
      const outcome: DeployOutcome = {
        success: false,
        status: 'Failed',
        appliedToOrg: false,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [
          {
            fullName: 'GoodClass',
            type: 'ApexClass',
            state: 'Created',
            filePath: path.join(classesDir, 'GoodClass.cls')
          }
        ],
        componentFailures: []
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('Would have been created —');
      expect(out).not.toContain('=== Deployed Source');
    });

    it('formats deletes that were not applied when deploy failed', () => {
      const outcome: DeployOutcome = {
        success: false,
        status: 'Failed',
        appliedToOrg: false,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [
          {
            fullName: 'RemoveClass',
            type: 'ApexClass',
            state: 'Deleted',
            filePath: path.join(classesDir, 'RemoveClass.cls')
          },
          {
            fullName: 'BadBundle',
            type: 'LightningUIBundle',
            state: 'Failed',
            error: 'Blocked',
            problemType: 'Error'
          }
        ],
        componentFailures: []
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('Deletes without file-level errors');
      expect(out).toContain('Would have been deleted —');
    });

    it('outputs only deploy errors when every file response failed', () => {
      const outcome: DeployOutcome = {
        success: false,
        status: 'Failed',
        appliedToOrg: false,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [
          {
            fullName: 'BadClass',
            type: 'ApexClass',
            state: 'Failed',
            error: 'Only failure',
            problemType: 'Error',
            filePath: path.join(classesDir, 'BadClass.cls')
          }
        ],
        componentFailures: []
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('=== Deploy Errors (1) ===');
      expect(out).toContain('Only failure');
      expect(out).not.toContain('Components without file-level errors');
    });

    it('includes merged componentFailures from the API in the error section', () => {
      const outcome: DeployOutcome = {
        success: false,
        status: 'Failed',
        appliedToOrg: false,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [],
        componentFailures: [
          {
            fullName: 'OnlyApi',
            type: 'CustomObject',
            problem: 'Problem from API details',
            problemType: 'Error'
          }
        ]
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('=== Deploy Errors (1) ===');
      expect(out).toContain('Problem from API details');
    });
  });

  describe('when deploy applied to the org (Succeeded or SucceededPartial)', () => {
    it('uses Deployed Source with raw API state when deploy succeeded', () => {
      const outcome: DeployOutcome = {
        success: true,
        status: 'Succeeded',
        appliedToOrg: true,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [
          {
            fullName: 'GoodClass',
            type: 'ApexClass',
            state: 'Created',
            filePath: path.join(classesDir, 'GoodClass.cls')
          }
        ],
        componentFailures: []
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('=== Deployed Source (1) ===');
      expect(out).toContain(`Created ApexClass ${URI.file(path.join(classesDir, 'GoodClass.cls')).toString()}`);
      expect(out).not.toContain('not deployed');
      expect(out).not.toContain('Would have been created');
    });

    it('lists multiple deployed components with correct count', () => {
      const outcome: DeployOutcome = {
        success: true,
        status: 'Succeeded',
        appliedToOrg: true,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [
          {
            fullName: 'A',
            type: 'ApexClass',
            state: 'Created',
            filePath: path.join(classesDir, 'A.cls')
          },
          {
            fullName: 'B',
            type: 'ApexClass',
            state: 'Changed',
            filePath: path.join(classesDir, 'B.cls')
          }
        ],
        componentFailures: []
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('=== Deployed Source (2) ===');
    });

    it('uses Deployed Source for successful components when status is SucceededPartial', () => {
      const outcome: DeployOutcome = {
        success: false,
        status: 'SucceededPartial',
        appliedToOrg: true,
        completedDate: '2026-06-23T00:00:00.000Z',
        fileResponses: [
          {
            fullName: 'GoodClass',
            type: 'ApexClass',
            state: 'Created',
            filePath: path.join(classesDir, 'GoodClass.cls')
          },
          {
            fullName: 'BadClass',
            type: 'ApexClass',
            state: 'Failed',
            error: 'Syntax error',
            problemType: 'Error',
            filePath: path.join(classesDir, 'BadClass.cls')
          }
        ],
        componentFailures: []
      };

      const out = formatDeployOutput(outcome);
      expect(out).toContain('=== Deployed Source (1) ===');
      expect(out).toContain('=== Deploy Errors (1) ===');
    });
  });
});
