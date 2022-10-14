import {
  CliCommandExecutor,
  CommandOutput,
  ForceConfigGet
} from '../../../src';
import { JSON_FLAG } from '../../../src/cli/commandBuilder';

describe('ForceOrgGet unit tests.', () => {
  const fakeExecution = {
    totally: 'fake'
  };
  // forceConfigGet expect and array with named keys which does not play nice in TS land
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configMap: any = [
    { key: 'config1', value: 'true' },
    { key: 'defaultdevhubusername', value: 'test@test.com' },
    { key: 'telemetryEnabled', value: 'false' }
  ];

  const resultObj = {
    result: configMap
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
    const forceConfigGet = new ForceConfigGet();
    expect(forceConfigGet).toBeInstanceOf(ForceConfigGet);
  });

  describe('getConfig()', () => {
    it('Should be able to get all configs.', async () => {
      const forceConfigGet = new ForceConfigGet();
      const config = await forceConfigGet.getConfig(fakePath);
      expect(config).toBeInstanceOf(Map<string, string>);
      expect(config.size).toEqual(3);
      expect(config.get(configMap[0].key)).toEqual(configMap[0].value);
      expect(config.get(configMap[1].key)).toEqual(configMap[1].value);
      expect(config.get(configMap[2].key)).toEqual(configMap[2].value);
      expect(executeSpy).toHaveBeenCalled();
      expect(getCmdResultSpy).toHaveBeenCalledWith(fakeExecution);
    });

    it('Should be able to pass an arg to the command.', async () => {
      const forceConfigGet = new ForceConfigGet();
      const config = await forceConfigGet.getConfig(fakePath, JSON_FLAG);
      expect(config).toBeInstanceOf(Map<string, string>);
      expect(config.size).toEqual(3);
      expect(executeSpy).toHaveBeenCalled();
      expect(getCmdResultSpy).toHaveBeenCalledWith(fakeExecution);
    });

    it('Should reject with result when json is not parseable.', async () => {
      const partialJson = fakeResult.substring(2);
      getCmdResultSpy.mockResolvedValue(partialJson);
      const forceConfigGet = new ForceConfigGet();
      // Unexpected token error is thrown b/c json can not be parsed.
      expect(forceConfigGet.getConfig(fakePath)).rejects.toThrowError(/Unexpected token/);
    });
  });
});
