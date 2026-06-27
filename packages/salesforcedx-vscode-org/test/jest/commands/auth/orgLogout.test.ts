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
    jest.clearAllMocks();
  });

  it('removes auth for the username and refreshes extension caches', async () => {
    const username = 'user@example.com';

    const executor = new OrgLogoutDefault();
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(updateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
  });

  // Models the regression where an alias added after extension boot would be dropped by
  // removeAuth's in-memory alias read if the StateAggregator singleton were stale.
  it('clears the StateAggregator singleton before creating the AuthRemover', async () => {
    const executor = new OrgLogoutDefault();
    await executor.run({ type: 'CONTINUE', data: 'user@example.com' });

    expect(clearInstanceAsyncMock).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalled();
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
