/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getOrgShape } from '../../../src/context/workspaceOrgShape';
import { OrgAuthInfo, workspaceUtils } from '../../../src/util';

jest.mock('../../../src/util', () => ({
  OrgAuthInfo: {
    isASandboxOrg: jest.fn(),
    isAScratchOrg: jest.fn(),
    getTargetOrgOrAlias: jest.fn()
  },
  workspaceUtils: {
    hasRootWorkspace: jest.fn()
  }
}));
describe('getOrgShape', () => {
  const username = 'test-user';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return Sandbox if the org is a sandbox', async () => {
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(true);
    (OrgAuthInfo.isASandboxOrg as jest.Mock).mockResolvedValue(true);

    const result = await getOrgShape(username);

    expect(result).toBe('Sandbox');
    expect(workspaceUtils.hasRootWorkspace).toHaveBeenCalled();
    expect(OrgAuthInfo.isASandboxOrg).toHaveBeenCalledWith(username);
  });

  it('should return Scratch if the org is a scratch org', async () => {
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(true);
    (OrgAuthInfo.isASandboxOrg as jest.Mock).mockResolvedValue(false);
    (OrgAuthInfo.isAScratchOrg as jest.Mock).mockResolvedValue(true);

    const result = await getOrgShape(username);

    expect(result).toBe('Scratch');
    expect(workspaceUtils.hasRootWorkspace).toHaveBeenCalled();
    expect(OrgAuthInfo.isAScratchOrg).toHaveBeenCalledWith(username);
  });

  it('should return Production if the target org or alias exists', async () => {
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(true);
    (OrgAuthInfo.isASandboxOrg as jest.Mock).mockResolvedValue(false);
    (OrgAuthInfo.isAScratchOrg as jest.Mock).mockResolvedValue(false);
    (OrgAuthInfo.getTargetOrgOrAlias as jest.Mock).mockResolvedValue('some-org');

    const result = await getOrgShape(username);

    expect(result).toBe('Production');
    expect(workspaceUtils.hasRootWorkspace).toHaveBeenCalled();
    expect(OrgAuthInfo.getTargetOrgOrAlias).toHaveBeenCalledWith(false);
  });

  it('should return Undefined if no conditions match in root workspace', async () => {
    (workspaceUtils.hasRootWorkspace as jest.Mock).mockReturnValue(true);
    (OrgAuthInfo.isASandboxOrg as jest.Mock).mockResolvedValue(false);
    (OrgAuthInfo.isAScratchOrg as jest.Mock).mockResolvedValue(false);
    (OrgAuthInfo.getTargetOrgOrAlias as jest.Mock).mockResolvedValue(undefined);

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
