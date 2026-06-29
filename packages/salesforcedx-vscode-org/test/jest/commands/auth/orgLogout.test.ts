/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import { OrgLogoutDefault } from '../../../../src/commands/auth/orgLogout';

jest.mock('../../../../src/telemetry', () => ({
  telemetryService: { sendException: jest.fn() }
}));

jest.mock('../../../../src/channels', () => ({
  OUTPUT_CHANNEL: {}
}));

describe('OrgLogoutDefault', () => {
  let removeAuthMock: jest.Mock;

  beforeEach(() => {
    removeAuthMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(AuthRemover, 'create').mockResolvedValue({
      removeAuth: removeAuthMock
    } as unknown as AuthRemover);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls removeAuth with the given username and returns true on success', async () => {
    const username = 'user@example.com';
    const executor = new OrgLogoutDefault();
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
  });

  it('returns false and does not throw when removeAuth rejects', async () => {
    const username = 'user@example.com';
    removeAuthMock.mockRejectedValue(new Error('removal failed'));

    const executor = new OrgLogoutDefault();
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(false);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
  });
});
