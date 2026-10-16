/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { identity } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { orgLogoutDefaultCommand } from '../../../../src/commands/auth/orgLogout';
import type * as orgUtil from '../../../../src/util/orgUtil';
import { makeConfirmOrThrow, UserCancellationError } from '../../testHelpers/promptServiceStub';

const mockUpdateConfigAndStateAggregatorsEffect = vi.fn<() => Effect.Effect<void, never, never>>(() => Effect.void);
let logoutMock: VitestMock;
vi.mock('../../../../src/util/orgUtil', async () => {
  const { logoutOrg } = await vi.importActual<typeof orgUtil>('../../../../src/util/orgUtil');
  return { logoutOrg, updateConfigAndStateAggregatorsEffect: () => mockUpdateConfigAndStateAggregatorsEffect() };
});

type OrgSnapshot = { username?: string; isScratch?: boolean; aliases?: readonly string[] };

const buildServices = (opts: {
  isProject: boolean;
  confirm: boolean;
  orgInfo: OrgSnapshot;
  isCurrentTargetOrg: boolean;
  clearDefaultOrgRef: VitestMock;
  simpleExec: VitestMock;
}) => ({
  ProjectService: {
    getSfProject: () =>
      opts.isProject ? Effect.succeed({}) : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
  },
  PromptService: Effect.succeed({ confirmOrThrow: makeConfirmOrThrow(opts.confirm) }),
  TerminalService: Effect.succeed({ simpleExec: opts.simpleExec }),
  WorkspaceService: { getWorkspaceInfoOrThrow: () => Effect.succeed({ fsPath: '/workspace' }) },
  ConfigService: {
    isCurrentTargetOrg: () => Effect.succeed(opts.isCurrentTargetOrg)
  },
  ClearDefaultOrgRef: opts.clearDefaultOrgRef,
  TargetOrgRef: () => SubscriptionRef.make(opts.orgInfo),
  UserCancellationError
});

const run = (opts: {
  isProject: boolean;
  confirm: boolean;
  orgInfo: OrgSnapshot;
  isCurrentTargetOrg?: boolean;
  clearDefaultOrgRef: VitestMock;
}) =>
  Effect.runPromiseExit(
    orgLogoutDefaultCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: buildServices({ isCurrentTargetOrg: true, simpleExec: logoutMock, ...opts })
        })
      } as unknown as ExtensionProviderService)
    ) as Effect.Effect<void, unknown, never>
  );

describe('orgLogoutDefaultCommand', () => {
  let clearDefaultOrgRefMock: VitestMock;
  let showInformationMessageMock: VitestMock;

  beforeEach(() => {
    vi.clearAllMocks();
    logoutMock = vi.fn().mockReturnValue(Effect.succeed('logged out'));
    clearDefaultOrgRefMock = vi.fn().mockReturnValue(Effect.void);
    mockUpdateConfigAndStateAggregatorsEffect.mockReturnValue(Effect.void);
    showInformationMessageMock = vscode.window.showInformationMessage as unknown as VitestMock;
    showInformationMessageMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs out a non-scratch default org, refreshes, and clears the target-org ref', async () => {
    const username = 'user@example.com';
    const exit = await run({
      isProject: true,
      confirm: true,
      orgInfo: { username, aliases: ['myOrg'] },
      clearDefaultOrgRef: clearDefaultOrgRefMock
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(logoutMock).toHaveBeenCalledWith({
      executable: 'sf',
      args: ['org', 'logout', '--target-org', username, '--no-prompt'],
      parse: identity,
      cwd: '/workspace'
    });
    expect(mockUpdateConfigAndStateAggregatorsEffect).toHaveBeenCalledTimes(1);
    // in-process ref clear (not the async config-file watcher) is what clears the apex-testing tree (#7624)
    expect(clearDefaultOrgRefMock).toHaveBeenCalledTimes(1);
  });

  it('does not clear the ref when the logged-out org was not the current target', async () => {
    const username = 'user@example.com';
    const exit = await run({
      isProject: true,
      confirm: true,
      orgInfo: { username },
      isCurrentTargetOrg: false,
      clearDefaultOrgRef: clearDefaultOrgRefMock
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(logoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['org', 'logout', '--target-org', username, '--no-prompt'] })
    );
    expect(mockUpdateConfigAndStateAggregatorsEffect).toHaveBeenCalledTimes(1);
    // logging out a non-target org must leave the current target-org (and its ref) intact
    expect(clearDefaultOrgRefMock).not.toHaveBeenCalled();
  });

  it('logs out a scratch default org after the confirm prompt is accepted', async () => {
    const username = 'scratch@example.com';
    const exit = await run({
      isProject: true,
      confirm: true,
      orgInfo: { username, isScratch: true, aliases: ['myScratch'] },
      clearDefaultOrgRef: clearDefaultOrgRefMock
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(logoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['org', 'logout', '--target-org', username, '--no-prompt'] })
    );
    expect(mockUpdateConfigAndStateAggregatorsEffect).toHaveBeenCalledTimes(1);
    expect(clearDefaultOrgRefMock).toHaveBeenCalledTimes(1);
  });

  it('cancels (no removeAuth/refresh/ref-clear) when the scratch confirm modal is declined', async () => {
    const exit = await run({
      isProject: true,
      confirm: false,
      orgInfo: { username: 'scratch@example.com', isScratch: true },
      clearDefaultOrgRef: clearDefaultOrgRefMock
    });

    // cancellation is caught and turned into a no-op success
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(logoutMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
    expect(clearDefaultOrgRefMock).not.toHaveBeenCalled();
  });

  it('shows an info message (no removeAuth/refresh/ref-clear) when there is no default org', async () => {
    const exit = await run({
      isProject: true,
      confirm: true,
      orgInfo: {},
      clearDefaultOrgRef: clearDefaultOrgRefMock
    });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    expect(logoutMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
    expect(clearDefaultOrgRefMock).not.toHaveBeenCalled();
  });

  it('fails the precondition (no removeAuth) when not in a project', async () => {
    const exit = await run({
      isProject: false,
      confirm: true,
      orgInfo: { username: 'user@example.com' },
      clearDefaultOrgRef: clearDefaultOrgRefMock
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(logoutMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
    expect(clearDefaultOrgRefMock).not.toHaveBeenCalled();
  });

  it('fails with OrgLogoutError (no refresh/ref-clear) when removeAuth rejects', async () => {
    logoutMock.mockReturnValue(Effect.fail({ _tag: 'TerminalServiceError', message: 'removal failed' }));
    const exit = await run({
      isProject: true,
      confirm: true,
      orgInfo: { username: 'user@example.com' },
      clearDefaultOrgRef: clearDefaultOrgRefMock
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('OrgLogoutError');
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
    expect(clearDefaultOrgRefMock).not.toHaveBeenCalled();
  });
});
