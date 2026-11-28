/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock, MockInstance as VitestMockInstance } from 'vitest';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { isNotNull } from 'effect/Predicate';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { identity } from 'effect/Function';
import * as vscode from 'vscode';
import {
  ProjectService,
  PromptService,
  TerminalService,
  UserCancellationError,
  WorkspaceService
} from '@salesforce/vscode-services/v2';
import { orgLogoutAllCommand } from '../../../../src/commands/auth/orgLogout';
import type * as orgUtil from '../../../../src/util/orgUtil';

// orgList.ts uses toSorted which trips Vitest transform; command only needs the two helpers it imports.
vi.mock('../../../../src/orgPicker/orgList', () => ({
  buildOrgQuickPickItems: (auths: Array<{ username: string }>) =>
    auths.map(a => ({ label: a.username, orgUsername: a.username })),
  isOrgItem: (item: unknown): boolean => typeof item === 'object' && isNotNull(item) && 'orgUsername' in item
}));

const mockGetFreshAuthorizations = vi.fn<() => Effect.Effect<unknown, never, never>>();
const mockUpdateConfigAndStateAggregatorsEffect = vi.fn<() => Effect.Effect<void, never, never>>(() => Effect.void);
let logoutMock: VitestMock;
vi.mock('../../../../src/util/orgUtil', async () => {
  const { logoutOrg } = await vi.importActual<typeof orgUtil>('../../../../src/util/orgUtil');
  return {
    logoutOrg,
    getFreshAuthorizations: () => mockGetFreshAuthorizations(),
    updateConfigAndStateAggregatorsEffect: () => mockUpdateConfigAndStateAggregatorsEffect()
  };
});

type Authorization = { username: string; isScratchOrg?: boolean; isSandbox?: boolean };

const buildServices = (opts: { isProject: boolean; confirm: boolean; simpleExec: VitestMock }) => ({
  project: {
    getSfProject: () =>
      opts.isProject ? Effect.succeed({}) : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
  },
  prompt: {
    considerEmptySelectionAsCancellation: <T>(value: readonly T[] | undefined) =>
      value === undefined || value.length === 0
        ? Effect.fail(new UserCancellationError({ message: 'User canceled' }))
        : Effect.succeed(value),
    confirmOrThrow: (_params: { message: string; confirmLabel: string }) =>
      opts.confirm ? Effect.void : Effect.fail(new UserCancellationError({ message: 'User canceled' }))
  },
  terminal: { simpleExec: opts.simpleExec },
  workspace: { getWorkspaceInfoOrThrow: () => Effect.succeed({ fsPath: '/workspace' }) }
});

const run = (opts: { isProject: boolean; confirm: boolean }) => {
  const services = buildServices({ ...opts, simpleExec: logoutMock });
  return Effect.runPromiseExit(
    orgLogoutAllCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          v2: { services: { ProjectService, PromptService, TerminalService, WorkspaceService, UserCancellationError } }
        })
      } as unknown as ExtensionProviderService['Service']),
      Effect.provideService(ProjectService, services.project as never),
      Effect.provideService(PromptService, services.prompt as never),
      Effect.provideService(TerminalService, services.terminal as never),
      Effect.provideService(WorkspaceService, services.workspace as never)
    ) as Effect.Effect<void, unknown, never>
  );
};

describe('orgLogoutAllCommand', () => {
  let showQuickPickMock: VitestMockInstance;

  const selectAll = (auths: Authorization[]) =>
    showQuickPickMock.mockResolvedValueOnce(auths.map(a => ({ label: a.username, orgUsername: a.username })));

  beforeEach(() => {
    vi.clearAllMocks();
    logoutMock = vi.fn().mockReturnValue(Effect.succeed('logged out'));
    showQuickPickMock = vi.spyOn(vscode.window, 'showQuickPick');
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: [] }));
    mockUpdateConfigAndStateAggregatorsEffect.mockReturnValue(Effect.void);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs out each selected org and refreshes config/state', async () => {
    const auths: Authorization[] = [{ username: 'user1@example.com' }, { username: 'user2@example.com' }];
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: auths }));
    selectAll(auths);

    const exit = await run({ isProject: true, confirm: true });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(logoutMock).toHaveBeenCalledTimes(2);
    expect(logoutMock).toHaveBeenNthCalledWith(1, {
      executable: 'sf',
      args: ['org', 'logout', '--target-org', 'user1@example.com', '--no-prompt'],
      parse: identity,
      cwd: '/workspace'
    });
    expect(logoutMock).toHaveBeenNthCalledWith(2, {
      executable: 'sf',
      args: ['org', 'logout', '--target-org', 'user2@example.com', '--no-prompt'],
      parse: identity,
      cwd: '/workspace'
    });
    expect(mockUpdateConfigAndStateAggregatorsEffect).toHaveBeenCalledTimes(1);
  });

  it('cancels (no removeAuth, no refresh) when nothing is selected', async () => {
    const auths: Authorization[] = [{ username: 'user1@example.com' }];
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: auths }));
    showQuickPickMock.mockResolvedValueOnce([]);

    const exit = await run({ isProject: true, confirm: true });

    // cancellation is caught and turned into a no-op success
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(logoutMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
  });

  it('logs out a scratch org after the scratch confirm prompt is accepted', async () => {
    const auths: Authorization[] = [{ username: 'scratch@example.com', isScratchOrg: true }];
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: auths }));
    selectAll(auths);

    const exit = await run({ isProject: true, confirm: true });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(logoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['org', 'logout', '--target-org', 'scratch@example.com', '--no-prompt'] })
    );
    expect(mockUpdateConfigAndStateAggregatorsEffect).toHaveBeenCalledTimes(1);
  });

  it('short-circuits on the first removeAuth failure (fail-fast, no refresh)', async () => {
    const auths: Authorization[] = [{ username: 'user1@example.com' }, { username: 'user2@example.com' }];
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: auths }));
    selectAll(auths);
    // first org rejects; Effect.forEach is sequential + non-concurrent, so it stops before the second.
    logoutMock.mockReturnValueOnce(Effect.fail({ _tag: 'TerminalServiceError', message: 'removal failed' }));

    const exit = await run({ isProject: true, confirm: true });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('OrgLogoutError');
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
  });

  it('cancels (no removeAuth, no refresh) when the confirm modal is declined', async () => {
    const auths: Authorization[] = [{ username: 'scratch@example.com', isScratchOrg: true }];
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: auths }));
    selectAll(auths);

    const exit = await run({ isProject: true, confirm: false });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(logoutMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
  });

  it('fails the precondition (no removeAuth) when not in a project', async () => {
    const exit = await run({ isProject: false, confirm: true });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(logoutMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
  });

  it('fails with OrgLogoutError when removeAuth rejects', async () => {
    const auths: Authorization[] = [{ username: 'user@example.com' }];
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: auths }));
    selectAll(auths);
    logoutMock.mockReturnValue(Effect.fail({ _tag: 'TerminalServiceError', message: 'removal failed' }));

    const exit = await run({ isProject: true, confirm: true });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('OrgLogoutError');
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
  });
});
