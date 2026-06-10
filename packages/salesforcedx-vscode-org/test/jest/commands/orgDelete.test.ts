/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { orgDeleteDefaultCommand } from '../../../src/commands/orgDelete';

jest.mock('../../../src/channels', () => ({
  channelService: { appendLine: jest.fn(), showChannelOutput: jest.fn() },
  OUTPUT_CHANNEL: {}
}));

const mockUpdateConfigAndStateAggregators = jest.fn<Promise<void>, []>();
jest.mock('../../../src/util/orgUtil', () => ({
  updateConfigAndStateAggregators: () => mockUpdateConfigAndStateAggregators()
}));

const userCancellationError = { _tag: 'UserCancellationError', message: 'User cancelled' } as const;

type OrgSnapshot = { orgId?: string; isScratch?: boolean; isSandbox?: boolean };

const buildServices = (orgInfo: OrgSnapshot, confirm: boolean, simpleExec: jest.Mock) => ({
  PromptService: Effect.succeed({
    confirmOrThrow: (_params: { message: string; confirmLabel: string }) =>
      confirm ? Effect.void : Effect.fail(userCancellationError)
  }),
  TerminalService: Effect.succeed({ simpleExec }),
  TargetOrgRef: () => SubscriptionRef.make(orgInfo)
});

const run = (orgInfo: OrgSnapshot, confirm: boolean, simpleExec: jest.Mock) =>
  Effect.runPromiseExit(
    orgDeleteDefaultCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(orgInfo, confirm, simpleExec) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgDeleteDefaultCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateConfigAndStateAggregators.mockResolvedValue(undefined);
  });

  it('runs `sf org delete scratch` for a scratch default org', async () => {
    const simpleExec = jest.fn(() => Effect.succeed('deleted'));
    const exit = await run({ orgId: '00D', isScratch: true }, true, simpleExec);

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith('sf org delete scratch --no-prompt', expect.any(Function), 120_000);
    expect(mockUpdateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
  });

  it('runs `sf org delete sandbox` for a sandbox default org', async () => {
    const simpleExec = jest.fn(() => Effect.succeed('deleted'));
    const exit = await run({ orgId: '00D', isSandbox: true }, true, simpleExec);

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(simpleExec).toHaveBeenCalledWith('sf org delete sandbox --no-prompt', expect.any(Function), 120_000);
  });

  it('fails with UserCancellationError and does not exec when the user declines', async () => {
    const simpleExec = jest.fn(() => Effect.succeed('deleted'));
    const exit = await run({ orgId: '00D', isScratch: true }, false, simpleExec);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    expect(simpleExec).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregators).not.toHaveBeenCalled();
  });
});
