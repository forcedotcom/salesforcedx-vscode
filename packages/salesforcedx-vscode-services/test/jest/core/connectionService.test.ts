/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, type OrgAuthorization } from '@salesforce/core';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import { ConnectionService } from '../../../src/core/connectionService';

describe('ConnectionService.listAllAuthorizations', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the authorizations from AuthInfo', async () => {
    const orgAuths = [
      { username: 'a@example.com', isDevHub: false },
      { username: 'b@example.com', isDevHub: true }
    ] as unknown as OrgAuthorization[];
    jest.spyOn(AuthInfo, 'listAllAuthorizations').mockResolvedValue(orgAuths);

    const result = await Effect.runPromise(
      ConnectionService.listAllAuthorizations().pipe(Effect.provide(ConnectionService.Default))
    );

    expect(result).toEqual(orgAuths);
  });

  it('fails with FailedToListAuthorizationsError carrying the cause', async () => {
    const underlying = new Error('boom');
    jest.spyOn(AuthInfo, 'listAllAuthorizations').mockRejectedValue(underlying);

    const exit = await Effect.runPromiseExit(
      ConnectionService.listAllAuthorizations().pipe(Effect.provide(ConnectionService.Default))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    const failure = Exit.isFailure(exit) ? Cause.failureOption(exit.cause) : Option.none();
    expect(Option.isSome(failure)).toBe(true);
    const error = Option.getOrThrow(failure);
    expect(error._tag).toBe('FailedToListAuthorizationsError');
    expect(error.cause).toBe(underlying);
  });
});
