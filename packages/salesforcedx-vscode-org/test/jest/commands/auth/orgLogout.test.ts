/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { orgLogoutDefaultCommand } from '../../../../src/commands/auth/orgLogout';
import { makeConfirmOrThrow, UserCancellationError } from '../../testHelpers/promptServiceStub';

const mockUpdateConfigAndStateAggregatorsEffect = jest.fn<Effect.Effect<void, never, never>, []>(() => Effect.void);
jest.mock('../../../../src/util/orgUtil', () => ({
  updateConfigAndStateAggregatorsEffect: () => mockUpdateConfigAndStateAggregatorsEffect()
}));

type OrgSnapshot = { username?: string; isScratch?: boolean; aliases?: readonly string[] };

const buildServices = (opts: {
  isProject: boolean;
  confirm: boolean;
  orgInfo: OrgSnapshot;
  isCurrentTargetOrg: boolean;
  unsetTargetOrg: jest.Mock;
}) => ({
  ProjectService: {
    getSfProject: () =>
      opts.isProject ? Effect.succeed({}) : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
  },
  PromptService: Effect.succeed({ confirmOrThrow: makeConfirmOrThrow(opts.confirm) }),
  WorkspaceService: {
    getWorkspaceInfoOrThrow: () => Effect.succeed({ fsPath: '/workspace' })
  },
  ConfigService: {
    isCurrentTargetOrg: () => Effect.succeed(opts.isCurrentTargetOrg),
    unsetTargetOrg: opts.unsetTargetOrg
  },
  TargetOrgRef: () => SubscriptionRef.make(opts.orgInfo),
  UserCancellationError
});

const run = (opts: {
  isProject: boolean;
  confirm: boolean;
  orgInfo: OrgSnapshot;
  isCurrentTargetOrg?: boolean;
  unsetTargetOrg: jest.Mock;
}) =>
  Effect.runPromiseExit(
    orgLogoutDefaultCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices({ isCurrentTargetOrg: true, ...opts }) })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgLogoutDefaultCommand', () => {
  let removeAuthMock: jest.Mock;
  let unsetTargetOrgMock: jest.Mock;
  let showInformationMessageMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    removeAuthMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(AuthRemover, 'create').mockResolvedValue({
      removeAuth: removeAuthMock
    } as unknown as AuthRemover);
    unsetTargetOrgMock = jest.fn().mockReturnValue(Effect.void);
    mockUpdateConfigAndStateAggregatorsEffect.mockReturnValue(Effect.void);
    showInformationMessageMock = vscode.window.showInformationMessage as unknown as jest.Mock;
    showInformationMessageMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs out a non-scratch default org, refreshes, and clears the target-org ref', async () => {
    const username = 'user@example.com';
    const exit = await run({
      isProject: true,
      confirm: true,
      orgInfo: { username, aliases: ['myOrg'] },
      unsetTargetOrg: unsetTargetOrgMock
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(AuthRemover.create).toHaveBeenCalledWith({ projectPath: '/workspace', skipCache: true });
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(mockUpdateConfigAndStateAggregatorsEffect).toHaveBeenCalledTimes(1);
    // in-process ref clear (not the async config-file watcher) is what clears the apex-testing tree (#7624)
    expect(unsetTargetOrgMock).toHaveBeenCalledTimes(1);
  });

  it('does not clear the ref when the logged-out org was not the current target', async () => {
    const username = 'user@example.com';
    const exit = await run({
      isProject: true,
      confirm: true,
      orgInfo: { username },
      isCurrentTargetOrg: false,
      unsetTargetOrg: unsetTargetOrgMock
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(mockUpdateConfigAndStateAggregatorsEffect).toHaveBeenCalledTimes(1);
    // logging out a non-target org must leave the current target-org (and its ref) intact
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });

  it('logs out a scratch default org after the confirm prompt is accepted', async () => {
    const username = 'scratch@example.com';
    const exit = await run({
      isProject: true,
      confirm: true,
      orgInfo: { username, isScratch: true, aliases: ['myScratch'] },
      unsetTargetOrg: unsetTargetOrgMock
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(mockUpdateConfigAndStateAggregatorsEffect).toHaveBeenCalledTimes(1);
    expect(unsetTargetOrgMock).toHaveBeenCalledTimes(1);
  });

  it('cancels (no removeAuth/refresh/ref-clear) when the scratch confirm modal is declined', async () => {
    const exit = await run({
      isProject: true,
      confirm: false,
      orgInfo: { username: 'scratch@example.com', isScratch: true },
      unsetTargetOrg: unsetTargetOrgMock
    });

    // cancellation is caught and turned into a no-op success
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(removeAuthMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });

  it('shows an info message (no removeAuth/refresh/ref-clear) when there is no default org', async () => {
    const exit = await run({
      isProject: true,
      confirm: true,
      orgInfo: {},
      unsetTargetOrg: unsetTargetOrgMock
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    expect(removeAuthMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });

  it('fails the precondition (no removeAuth) when not in a project', async () => {
    const exit = await run({
      isProject: false,
      confirm: true,
      orgInfo: { username: 'user@example.com' },
      unsetTargetOrg: unsetTargetOrgMock
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(removeAuthMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });

  it('fails with OrgLogoutError (no refresh/ref-clear) when removeAuth rejects', async () => {
    removeAuthMock.mockRejectedValue(new Error('removal failed'));
    const exit = await run({
      isProject: true,
      confirm: true,
      orgInfo: { username: 'user@example.com' },
      unsetTargetOrg: unsetTargetOrgMock
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('OrgLogoutError');
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });
});
