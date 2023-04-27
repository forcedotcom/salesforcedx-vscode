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
    let workspaceContextStub: jest.SpyInstance;
    let getSourceComponentsStub: jest.SpyInstance;
    let setApiVersionOnStub: jest.SpyInstance;
    let retrieveStub: jest.SpyInstance;

    beforeEach(() => {
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
      setApiVersionOnStub = jest
        .spyOn(sdrUtils, 'setApiVersionOn')
        .mockImplementation(jest.fn());
      retrieveStub = jest
        .spyOn(dummyComponentSet, 'retrieve')
        .mockResolvedValue({} as any);
    });

    it('should use the suppressEvents option to retrieve files with conflicts', async () => {
      const metadataCacheService = new MetadataCacheService('');

      const retrieveOperation = await metadataCacheService.createRetrieveOperation();

      expect(workspaceContextStub).toHaveBeenCalled();
      expect(getSourceComponentsStub).toHaveBeenCalled();
      expect(setApiVersionOnStub).toHaveBeenCalledWith(dummyComponentSet);
      const dummyRetrieveOptionsWithSuppressEvents = { suppressEvents: true };
      expect(retrieveStub).toHaveBeenCalledWith(
        expect.objectContaining(dummyRetrieveOptionsWithSuppressEvents)
      );
    });
  });
});
