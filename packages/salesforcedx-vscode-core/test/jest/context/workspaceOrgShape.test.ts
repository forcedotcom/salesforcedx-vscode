/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { getOrgShape } from '../../../src/context/workspaceOrgShape';
import * as util from '../../../src/util';

jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  workspaceUtils: {
    hasRootWorkspace: jest.fn()
  }
}));

jest.mock('../../../src/util', () => ({
  isASandboxOrg: jest.fn(),
  isAScratchOrg: jest.fn(),
  getTargetOrgOrAlias: jest.fn()
}));

describe('getOrgShape', () => {
  const username = 'test-user';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return Sandbox if the org is a sandbox', async () => {
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(true);
    (util.isASandboxOrg as jest.Mock).mockResolvedValue(true);

    const result = await getOrgShape(username);

    expect(result).toBe('Sandbox');
    expect(workspaceUtils.hasRootWorkspace).toHaveBeenCalled();
    expect(util.isASandboxOrg).toHaveBeenCalledWith(username);
  });

  it('should return Scratch if the org is a scratch org', async () => {
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(true);
    (util.isASandboxOrg as jest.Mock).mockResolvedValue(false);
    (util.isAScratchOrg as jest.Mock).mockResolvedValue(true);

    const result = await getOrgShape(username);

    expect(result).toBe('Scratch');
    expect(workspaceUtils.hasRootWorkspace).toHaveBeenCalled();
    expect(util.isAScratchOrg).toHaveBeenCalledWith(username);
  });

  it('should return Production if the target org or alias exists', async () => {
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(true);
    (util.isASandboxOrg as jest.Mock).mockResolvedValue(false);
    (util.isAScratchOrg as jest.Mock).mockResolvedValue(false);
    (util.getTargetOrgOrAlias as jest.Mock).mockResolvedValue('some-org');

    const result = await getOrgShape(username);

    expect(result).toBe('Production');
    expect(workspaceUtils.hasRootWorkspace).toHaveBeenCalled();
    expect(util.getTargetOrgOrAlias).toHaveBeenCalledWith(false);
  });

  it('should return Undefined if no conditions match in root workspace', async () => {
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(true);
    (util.isASandboxOrg as jest.Mock).mockResolvedValue(false);
    (util.isAScratchOrg as jest.Mock).mockResolvedValue(false);
    (util.getTargetOrgOrAlias as jest.Mock).mockResolvedValue(undefined);

    const result = await getOrgShape(username);

    expect(result).toBe('Undefined');
    expect(workspaceUtils.hasRootWorkspace).toHaveBeenCalled();
  });

  it('should return Undefined if there is no root workspace', async () => {
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(false);

    const result = await getOrgShape(username);

    expect(result).toBe('Undefined');
    expect(workspaceUtils.hasRootWorkspace).toHaveBeenCalled();
  });
});
