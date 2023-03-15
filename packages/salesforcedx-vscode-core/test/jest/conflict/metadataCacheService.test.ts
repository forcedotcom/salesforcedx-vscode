import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { MetadataCacheService } from '../../../src/conflict';
import { WorkspaceContext } from '../../../src/context';
import * as sdrUtils from '../../../src/services/sdr/componentSetUtils';

describe('MetadataCacheService', () => {
  describe('createRetrieveOperation', () => {
    const dummyComponentSet = new ComponentSet([
      { fullName: 'Test', type: 'apexclass' },
      { fullName: 'Test2', type: 'layout' }
    ]);
    let retrieveStub: jest.SpyInstance;
    let getSourceComponentsStub: jest.SpyInstance;
    let setApiVersionOnStub: jest.SpyInstance;
    let workspaceContextStub: jest.SpyInstance;
    let componentSetRetrieveStub: jest.SpyInstance;

    beforeEach(() => {
      retrieveStub = jest
        .spyOn(dummyComponentSet, 'retrieve')
        .mockResolvedValue({} as any);
      componentSetRetrieveStub = jest
        .spyOn(ComponentSet.prototype, 'retrieve')
        .mockResolvedValue({} as any);
      setApiVersionOnStub = jest
        .spyOn(sdrUtils, 'setApiVersionOn')
        .mockImplementation(jest.fn());
      workspaceContextStub = jest
        .spyOn(WorkspaceContext, 'getInstance')
        .mockReturnValue({
          getConnection: async () => {
            return {};
          }
        } as any);
      getSourceComponentsStub = jest
        .spyOn(MetadataCacheService.prototype, 'getSourceComponents')
        .mockResolvedValue(dummyComponentSet);
    });

    it('should use the suppressEvents option to retrieve files with conflicts', async () => {
      const m = new MetadataCacheService('');

      const o = await m.createRetrieveOperation();

      expect(setApiVersionOnStub).toHaveBeenCalledWith(dummyComponentSet);
      const dummyRetrieveOptionsWithSuppressEvents = { suppressEvents: true };
      expect(retrieveStub).toHaveBeenCalledWith(
        expect.objectContaining(dummyRetrieveOptionsWithSuppressEvents)
      );
    });
  });
});
