import { SourceTracking } from '@salesforce/source-tracking';
import { SourceTrackingProvider, workspaceUtils } from '../../../src';
import { SourceTrackingService } from '../../../src/services';
import { Org, SfProject } from '@salesforce/core';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Org: { create: jest.fn() },
  SfProject: { resolve: jest.fn() }
}));

jest.mock('@salesforce/source-tracking', () => ({
  ...jest.requireActual('@salesforce/source-tracking'),
  SourceTracking: { create: jest.fn() }
}));

describe('SourceTrackingProvider', () => {
  const dummyPath = 'a/dummy/path';
  const dummyConnection = {} as any;
  let instance: any;

  describe('getSourceTracker', () => {
    const dummySourceTracking = {} as any;
    let getRootWorkspacePathStub: jest.SpyInstance;
    // let createSourceTrackingMock: jest.SpyInstance;

    beforeEach(() => {
      getRootWorkspacePathStub = jest
        .spyOn(workspaceUtils, 'getRootWorkspacePath')
        .mockReturnValue(dummyPath);
      // createSourceTrackingMock = jest.spyOn(instance, 'createSourceTracking');
    });

    it('should return the STL instance for this project if it already exists', async () => {
      instance = SourceTrackingProvider.getInstance();
      instance.sourceTrackers.set(dummyPath, dummySourceTracking);

      const result = await instance.getSourceTracker(
        dummyPath,
        dummyConnection
      );

      expect(result).toBe(dummySourceTracking);
    });

    it('should create a new instance of STL if one doesnt already exist and add it to the map', async () => {
      // createSourceTrackingMock.mockResolvedValue(dummySourceTracking);
      instance = SourceTrackingProvider.getInstance();
      const cSpy = jest
        .spyOn(SourceTracking, 'create')
        .mockResolvedValue(dummySourceTracking);

      const result = await instance.getSourceTracker(
        dummyPath,
        dummyConnection
      );

      // expect(createSourceTrackingMock).toHaveBeenCalled();
      // expect(SfProject.resolve).toHaveBeenCalledWith(dummyPath);
      // expect(Org.create).toHaveBeenCalledWith({ connection: dummyConnection });
      expect(cSpy).toHaveBeenCalled();
      expect(result).toBe(dummySourceTracking);
    });
  });
});
