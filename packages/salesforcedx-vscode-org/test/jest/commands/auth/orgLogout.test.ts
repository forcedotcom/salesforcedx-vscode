/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover, StateAggregator } from '@salesforce/core';
import { OrgLogoutDefault } from '../../../../src/commands/auth/orgLogout';
import { updateConfigAndStateAggregators } from '../../../../src/util/orgUtil';

jest.mock('../../../../src/telemetry', () => ({
  telemetryService: { sendException: jest.fn() }
}));

jest.mock('../../../../src/channels', () => ({
  OUTPUT_CHANNEL: {}
}));

jest.mock('../../../../src/util/orgUtil', () => ({
  updateConfigAndStateAggregators: jest.fn().mockResolvedValue(undefined)
}));

// selectOrgsForLogout imports orgList.ts which has a pre-existing toSorted ts-jest issue
jest.mock('../../../../src/parameterGatherers/selectOrgsForLogout');

describe('OrgLogoutDefault', () => {
  let removeAuthMock: jest.Mock;
  let clearInstanceAsyncMock: jest.SpyInstance;
  let createMock: jest.SpyInstance;

  beforeEach(() => {
    removeAuthMock = jest.fn().mockResolvedValue(undefined);
    createMock = jest.spyOn(AuthRemover, 'create').mockResolvedValue({
      removeAuth: removeAuthMock
    } as unknown as AuthRemover);
    clearInstanceAsyncMock = jest.spyOn(StateAggregator, 'clearInstanceAsync').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Asserts the full happy path: removeAuth routed the username, caches refreshed, result true, and
  // (regression guard) the StateAggregator singleton is cleared BEFORE the AuthRemover is created so
  // removeAuth's in-memory alias read cannot drop an alias added after extension boot.
  it('clears the singleton, removes auth for the username, and refreshes extension caches', async () => {
    const username = 'user@example.com';

    const executor = new OrgLogoutDefault();
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(updateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
    expect(clearInstanceAsyncMock.mock.invocationCallOrder[0]).toBeLessThan(createMock.mock.invocationCallOrder[0]);
  });

  it('returns false and does not refresh caches when auth removal fails', async () => {
    removeAuthMock.mockRejectedValue(new Error('removal failed'));

    const executor = new OrgLogoutDefault();
    const result = await executor.run({ type: 'CONTINUE', data: 'user@example.com' });

    expect(result).toBe(false);
    expect(updateConfigAndStateAggregators).not.toHaveBeenCalled();
  });
});
