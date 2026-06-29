/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { ConnectionService } from '../../../src/core/connectionService';

const PARAMS = {
  instanceUrl: 'https://my.salesforce.com',
  accessToken: '00Dxx!fakeToken',
  alias: 'myAlias',
  setDefault: true
};

const run = (effect: Effect.Effect<unknown, unknown, ConnectionService>) =>
  Effect.runPromiseExit(effect.pipe(Effect.provide(ConnectionService.Default)));

describe('ConnectionService.loginWithAccessToken', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates AuthInfo with loginUrl=instanceUrl, awaits save() before handleAliasAndDefaultSettings', async () => {
    const callOrder: string[] = [];
    const save = jest.fn(async () => {
      callOrder.push('save');
    });
    const handleAliasAndDefaultSettings = jest.fn(async () => {
      callOrder.push('alias');
    });
    const getFields = jest.fn(() => ({ username: 'me@org.com' }));
    const createSpy = jest
      .spyOn(AuthInfo, 'create')
      .mockResolvedValue({ save, handleAliasAndDefaultSettings, getFields } as unknown as AuthInfo);

    const exit = await run(ConnectionService.loginWithAccessToken(PARAMS));

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(createSpy).toHaveBeenCalledWith({
      accessTokenOptions: {
        accessToken: PARAMS.accessToken,
        loginUrl: PARAMS.instanceUrl,
        instanceUrl: PARAMS.instanceUrl
      }
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(handleAliasAndDefaultSettings).toHaveBeenCalledWith({
      alias: PARAMS.alias,
      setDefault: PARAMS.setDefault,
      setDefaultDevHub: false
    });
    // save must be awaited before alias/default settings
    expect(callOrder).toEqual(['save', 'alias']);
  });

  it('maps Bad_OAuth_Token create rejection to BadOAuthTokenError', async () => {
    jest.spyOn(AuthInfo, 'create').mockRejectedValue(new Error('Bad_OAuth_Token: invalid'));

    const exit = await run(ConnectionService.loginWithAccessToken(PARAMS));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('BadOAuthTokenError');
  });

  it('maps a non-Bad_OAuth_Token create rejection to FailedToCreateAuthInfoError', async () => {
    jest.spyOn(AuthInfo, 'create').mockRejectedValue(new Error('network down'));

    const exit = await run(ConnectionService.loginWithAccessToken(PARAMS));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('FailedToCreateAuthInfoError');
  });

  it('maps a save() rejection to FailedToSaveAuthInfoError (not alias)', async () => {
    const save = jest.fn().mockRejectedValue(new Error('disk full'));
    const handleAliasAndDefaultSettings = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(AuthInfo, 'create')
      .mockResolvedValue({ save, handleAliasAndDefaultSettings, getFields: () => ({}) } as unknown as AuthInfo);

    const exit = await run(ConnectionService.loginWithAccessToken(PARAMS));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const cause = JSON.stringify(exit.cause);
      expect(cause).toContain('FailedToSaveAuthInfoError');
      expect(cause).not.toContain('FailedToHandleAliasSettingsError');
    }
    expect(handleAliasAndDefaultSettings).not.toHaveBeenCalled();
  });

  it('maps a handleAliasAndDefaultSettings rejection to FailedToHandleAliasSettingsError (not save)', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const handleAliasAndDefaultSettings = jest.fn().mockRejectedValue(new Error('alias clash'));
    jest
      .spyOn(AuthInfo, 'create')
      .mockResolvedValue({ save, handleAliasAndDefaultSettings, getFields: () => ({}) } as unknown as AuthInfo);

    const exit = await run(ConnectionService.loginWithAccessToken(PARAMS));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const cause = JSON.stringify(exit.cause);
      expect(cause).toContain('FailedToHandleAliasSettingsError');
      expect(cause).not.toContain('FailedToSaveAuthInfoError');
    }
  });
});
