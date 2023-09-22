import { SourceTracking } from '@salesforce/source-tracking';
import { SourceTrackingProvider, workspaceUtils } from '../../../src';
import { SourceTrackingService } from '../../../src/services';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Org: { create: jest.fn() },
  SfProject: { resolve: jest.fn() }
}));

describe('SourceTrackingProvider', () => {
  const instance: any = SourceTrackingProvider.getInstance();
  let getRootWorkspacePathStub: jest.SpyInstance;

  beforeEach(() => {
    getRootWorkspacePathStub = jest
      .spyOn(workspaceUtils, 'getRootWorkspacePath')
      .mockReturnValue('aPath');
  });

  describe('getSourceTracker', () => {
    it('should return the STL instance for this project if it already exists', () => {
      instance.sourceTrackers.set('aPath', {} as any);

      const result = instance.getSourceTracker('aPath', {} as any);

      expect(result).not.toBe(undefined);
    });

    it('should create a new instance of STL if one doesnt already exist', () => {});
  });

  describe('createSourceTracking', () => {
    let sourceTrackingCreateSpy: jest.SpyInstance;
    let ensureLocalTrackingSpy: jest.SpyInstance;

    beforeEach(() => {
      sourceTrackingCreateSpy = jest
        .spyOn(SourceTracking, 'create')
        .mockResolvedValue({} as any);
      ensureLocalTrackingSpy = jest
        .spyOn(SourceTracking.prototype, 'ensureLocalTracking')
        .mockResolvedValue({} as any);
    });

    it('Should create an instance of SourceTracking', async () => {
      await SourceTrackingService.getSourceTracking('', {} as any);

      expect(sourceTrackingCreateSpy).not.toHaveBeenCalled();
    });
  });
});
