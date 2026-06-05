/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { getOrgShape } from '../../../src/context/workspaceOrgShape';

jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  workspaceUtils: {
    hasRootWorkspace: jest.fn()
  }
}));

const mockRunPromise = jest.fn();
jest.mock('../../../src/services/runtime', () => ({
  getRuntime: () => ({ runPromise: mockRunPromise })
}));

describe('getOrgShape', () => {
  const username = 'test-user';

  beforeEach(() => {
    jest.clearAllMocks();
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(true);
  });

  it('returns Undefined when there is no root workspace (runtime not invoked)', async () => {
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(false);

    const result = await getOrgShape(username);

    expect(result).toBe('Undefined');
    expect(mockRunPromise).not.toHaveBeenCalled();
  });

  it('returns Scratch when isScratch true', async () => {
    mockRunPromise.mockResolvedValue('Scratch');

    expect(await getOrgShape(username)).toBe('Scratch');
  });

  it('returns Sandbox when isSandbox true', async () => {
    mockRunPromise.mockResolvedValue('Sandbox');

    expect(await getOrgShape(username)).toBe('Sandbox');
  });

  it('returns Production when alias is set', async () => {
    mockRunPromise.mockResolvedValue('Production');

    expect(await getOrgShape(username)).toBe('Production');
  });

  it('returns Undefined when nothing is populated (catchAll path)', async () => {
    mockRunPromise.mockResolvedValue('Undefined');

    expect(await getOrgShape(username)).toBe('Undefined');
  });
});
