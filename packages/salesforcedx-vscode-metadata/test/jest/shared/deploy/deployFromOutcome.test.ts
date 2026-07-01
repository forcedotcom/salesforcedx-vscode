/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { DeployOutcome } from 'salesforcedx-vscode-services';
import { getMergedDeployFailures } from '../../../../src/shared/deploy/getMergedDeployFailures';
import { formatDeployOutput } from '../../../../src/shared/deploy/formatDeployOutput';

// Mock the diagnostics and conflict storage modules
const mockClearDeployDiagnostics = jest.fn();
const mockApplyDeployDiagnostics = jest.fn();
const mockMaybeStoreDeployResult = jest.fn();

jest.mock('../../../../src/shared/deploy/deployDiagnostics', () => ({
  clearDeployDiagnostics: () => {
    mockClearDeployDiagnostics();
  },
  applyDeployDiagnostics: (failures: unknown) => {
    mockApplyDeployDiagnostics(failures);
    return Effect.void;
  }
}));
jest.mock('../../../../src/conflict/resultStorage', () => ({
  maybeStoreDeployResult: (outcome: unknown) => {
    mockMaybeStoreDeployResult(outcome);
    return Effect.void;
  }
}));

import { deployFromOutcome } from '../../../../src/shared/deploy/deployFromOutcome';

// Mock ChannelService
const mockAppendCalls: string[] = [];
const mockShow = jest.fn();
const mockChannelService = {
  appendToChannel: (text: string) => {
    mockAppendCalls.push(text);
    return Effect.void;
  },
  getChannel: Effect.succeed({ show: mockShow })
};

const mockExtensionProvider = {
  getServicesApi: Effect.succeed({
    services: {
      ChannelService: Effect.succeed(mockChannelService)
    }
  })
} as unknown as ExtensionProviderService;

// deployFromOutcome statically requires ExtensionProviderService | FsService | ChannelService, but the
// deployDiagnostics/resultStorage modules are jest.mock'd (their FsService deps neutralized at runtime) and
// ChannelService is served via the mocked getServicesApi — so providing ExtensionProviderService is sufficient
// at runtime. The requirement channel is widened to `never` for the test runner since the env is fully mocked.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const runWithMocks = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.runPromise(
    (effect as Effect.Effect<A, E, ExtensionProviderService>).pipe(
      Effect.provideService(ExtensionProviderService, mockExtensionProvider)
    )
  );

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

  describe('deployFromOutcome Effect', () => {
    beforeEach(() => {
      mockClearDeployDiagnostics.mockClear();
      mockApplyDeployDiagnostics.mockClear();
      mockMaybeStoreDeployResult.mockClear();
      mockAppendCalls.length = 0;
    });

    it('success outcome appends formatted text and does not fail', async () => {
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

      await runWithMocks(deployFromOutcome(outcome));

      expect(mockClearDeployDiagnostics).toHaveBeenCalled();
      expect(mockAppendCalls.length).toBeGreaterThan(0);
      expect(mockAppendCalls[0]).toContain('=== Deployed Source');
      expect(mockApplyDeployDiagnostics).not.toHaveBeenCalled();
    });

    it('failure outcome with filePath invokes applyDeployDiagnostics and fails with DeployCompletedWithErrorsError', async () => {
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

      await expect(runWithMocks(deployFromOutcome(outcome))).rejects.toThrow('Deploy completed with errors');

      expect(mockClearDeployDiagnostics).toHaveBeenCalled();
      expect(mockAppendCalls.length).toBeGreaterThan(0);
      expect(mockAppendCalls[0]).toContain('=== Deploy Errors');
      expect(mockApplyDeployDiagnostics).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ filePath: expect.stringContaining('BadClass.cls') })])
      );
    });

    it('failure outcome without filePath does not invoke applyDeployDiagnostics but still fails', async () => {
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

      await expect(runWithMocks(deployFromOutcome(outcome))).rejects.toThrow('Deploy completed with errors');

      expect(mockClearDeployDiagnostics).toHaveBeenCalled();
      expect(mockAppendCalls.length).toBeGreaterThan(0);
      expect(mockAppendCalls[0]).toContain('=== Deploy Errors');
      expect(mockApplyDeployDiagnostics).not.toHaveBeenCalled();
    });
  });
});
