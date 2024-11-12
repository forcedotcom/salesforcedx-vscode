/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CliCommandExecutor, CommandOutput, OrgDisplay } from '../../../src';

describe('OrgDisplay unit tests.', () => {
  const fakeExecution = {
    totally: 'fake'
  };
  const resultObj = {
    result: {
      org: 'info'
    }
  };
  const fakeResult = JSON.stringify(resultObj);
  const fakePath = '/here/is/a/fake/path';

  let executeSpy: jest.SpyInstance;
  let getCmdResultSpy: jest.SpyInstance;
  beforeEach(() => {
    executeSpy = jest.spyOn(CliCommandExecutor.prototype, 'execute').mockReturnValue(fakeExecution as any);
    getCmdResultSpy = jest.spyOn(CommandOutput.prototype, 'getCmdResult').mockResolvedValue(fakeResult);
  });

  it('Should create instance.', () => {
    const orgDisplay = new OrgDisplay();
    expect(orgDisplay).toBeInstanceOf(OrgDisplay);
  });

  it('Should be able to successfully get org info.', async () => {
    const orgDisplay = new OrgDisplay();
    const result = await orgDisplay.getOrgInfo(fakePath);
    expect(result).toEqual(resultObj.result);
    expect(executeSpy).toHaveBeenCalled();
    expect(getCmdResultSpy).toHaveBeenCalledWith(fakeExecution);
  });

  it('Should reject with result when json is not parseable.', async () => {
    const partialJson = fakeResult.substring(2);
    getCmdResultSpy.mockResolvedValue(partialJson);
    const orgDisplay = new OrgDisplay();
    expect(orgDisplay.getOrgInfo(fakePath)).rejects.toEqual(partialJson);
    expect(executeSpy).toHaveBeenCalled();
    expect(getCmdResultSpy).toHaveBeenCalledWith(fakeExecution);
  });
});
