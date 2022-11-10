import {
  CliCommandExecutor,
  CommandOutput,
  ForceOrgDisplay
} from '../../../src';

describe('ForceOrgDisplay unit tests.', () => {
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
    executeSpy = jest
      .spyOn(CliCommandExecutor.prototype, 'execute')
      .mockReturnValue(fakeExecution as any);
    getCmdResultSpy = jest
      .spyOn(CommandOutput.prototype, 'getCmdResult')
      .mockResolvedValue(fakeResult);
  });

  it('Should create instance.', () => {
    const forceOrgDisplay = new ForceOrgDisplay();
    expect(forceOrgDisplay).toBeInstanceOf(ForceOrgDisplay);
  });

  it('Should be able to successfully get org info.', async () => {
    const forceOrgDisplay = new ForceOrgDisplay();
    const result = await forceOrgDisplay.getOrgInfo(fakePath);
    expect(result).toEqual(resultObj.result);
    expect(executeSpy).toHaveBeenCalled();
    expect(getCmdResultSpy).toHaveBeenCalledWith(fakeExecution);
  });

  it('Should reject with result when json is not parseable.', async () => {
    const partialJson = fakeResult.substring(2);
    getCmdResultSpy.mockResolvedValue(partialJson);
    const forceOrgDisplay = new ForceOrgDisplay();
    expect(forceOrgDisplay.getOrgInfo(fakePath)).rejects.toEqual(partialJson);
    expect(executeSpy).toHaveBeenCalled();
    expect(getCmdResultSpy).toHaveBeenCalledWith(fakeExecution);
  });
});
