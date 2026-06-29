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
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { orgLogoutAllCommand } from '../../../../src/commands/auth/orgLogout';

// The real UserCancellationError (from @salesforce/vscode-services) is not constructable under
// ts-jest; a local Schema.TaggedError with the same _tag is interchangeable for catchTag matching.
class UserCancellationError extends Schema.TaggedError<UserCancellationError>()('UserCancellationError', {}) {}

// orgList.ts uses toSorted which trips ts-jest; the command only needs the two helpers it imports.
jest.mock('../../../../src/orgPicker/orgList', () => ({
  buildOrgQuickPickItems: (auths: Array<{ username: string }>) =>
    auths.map(a => ({ label: a.username, orgUsername: a.username })),
  isOrgItem: (item: unknown): boolean => typeof item === 'object' && item !== null && 'orgUsername' in item
}));

const mockGetFreshAuthorizations = jest.fn<Effect.Effect<unknown, never, never>, []>();
const mockUpdateConfigAndStateAggregatorsEffect = jest.fn<Effect.Effect<void, never, never>, []>(() => Effect.void);
jest.mock('../../../../src/util/orgUtil', () => ({
  getFreshAuthorizations: () => mockGetFreshAuthorizations(),
  updateConfigAndStateAggregatorsEffect: () => mockUpdateConfigAndStateAggregatorsEffect()
}));

type Authorization = { username: string; isScratchOrg?: boolean; isSandbox?: boolean };

const buildServices = (opts: { isProject: boolean; confirm: boolean }) => ({
  ProjectService: {
    getSfProject: () =>
      opts.isProject ? Effect.succeed({}) : Effect.fail({ _tag: 'FailedToResolveSfProjectError' as const })
  },
  PromptService: Effect.succeed({
    considerEmptySelectionAsCancellation: <T>(value: readonly T[] | undefined) =>
      value === undefined || value.length === 0 ? Effect.fail(new UserCancellationError()) : Effect.succeed(value),
    confirmOrThrow: (_params: { message: string; confirmLabel: string }) =>
      opts.confirm ? Effect.void : Effect.fail(new UserCancellationError())
  }),
  UserCancellationError
});

const run = (opts: { isProject: boolean; confirm: boolean }) =>
  Effect.runPromiseExit(
    orgLogoutAllCommand().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: buildServices(opts) })
      } as unknown as ExtensionProviderService) as Effect.Effect<void, unknown, never>
    )
  );

describe('orgLogoutAllCommand', () => {
  let removeAuthMock: jest.Mock;
  let showQuickPickMock: jest.SpyInstance;

  const selectAll = (auths: Authorization[]) =>
    showQuickPickMock.mockResolvedValueOnce(auths.map(a => ({ label: a.username, orgUsername: a.username })));

  beforeEach(() => {
    jest.clearAllMocks();
    removeAuthMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(AuthRemover, 'create').mockResolvedValue({
      removeAuth: removeAuthMock
    } as unknown as AuthRemover);
    showQuickPickMock = jest.spyOn(vscode.window, 'showQuickPick');
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: [] }));
    mockUpdateConfigAndStateAggregatorsEffect.mockReturnValue(Effect.void);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs out each selected org and refreshes config/state', async () => {
    const auths: Authorization[] = [{ username: 'user1@example.com' }, { username: 'user2@example.com' }];
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: auths }));
    selectAll(auths);

    const exit = await run({ isProject: true, confirm: true });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledTimes(2);
    expect(removeAuthMock).toHaveBeenCalledWith('user1@example.com');
    expect(removeAuthMock).toHaveBeenCalledWith('user2@example.com');
    expect(mockUpdateConfigAndStateAggregatorsEffect).toHaveBeenCalledTimes(1);
  });

  it('cancels (no removeAuth, no refresh) when nothing is selected', async () => {
    const auths: Authorization[] = [{ username: 'user1@example.com' }];
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: auths }));
    showQuickPickMock.mockResolvedValueOnce([]);

    const exit = await run({ isProject: true, confirm: true });

    // cancellation is caught and turned into a no-op success
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(removeAuthMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
  });

  it('cancels (no removeAuth, no refresh) when the confirm modal is declined', async () => {
    const auths: Authorization[] = [{ username: 'scratch@example.com', isScratchOrg: true }];
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: auths }));
    selectAll(auths);

    const exit = await run({ isProject: true, confirm: false });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(removeAuthMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
  });

  it('fails the precondition (no removeAuth) when not in a project', async () => {
    const exit = await run({ isProject: false, confirm: true });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToResolveSfProjectError');
    expect(removeAuthMock).not.toHaveBeenCalled();
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
  });

  it('fails with OrgLogoutError when removeAuth rejects', async () => {
    const auths: Authorization[] = [{ username: 'user@example.com' }];
    mockGetFreshAuthorizations.mockReturnValue(Effect.succeed({ defaultConfig: {}, freshAuthorizations: auths }));
    selectAll(auths);
    removeAuthMock.mockRejectedValue(new Error('removal failed'));

    const exit = await run({ isProject: true, confirm: true });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('OrgLogoutError');
    expect(mockUpdateConfigAndStateAggregatorsEffect).not.toHaveBeenCalled();
  });
});
