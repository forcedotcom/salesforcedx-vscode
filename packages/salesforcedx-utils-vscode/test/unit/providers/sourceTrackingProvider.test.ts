/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceTracking } from '@salesforce/source-tracking';
import { SourceTrackingProvider, workspaceUtils } from '../../../src';

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
  const dummySourceTracking = {} as any;
  let instance: any;

  describe('getSourceTracker', () => {
    let getRootWorkspacePathStub: jest.SpyInstance;

    beforeEach(() => {
      getRootWorkspacePathStub = jest
        .spyOn(workspaceUtils, 'getRootWorkspacePath')
        .mockReturnValue(dummyPath);
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
      instance = SourceTrackingProvider.getInstance();
      jest
        .spyOn(SourceTracking, 'create')
        .mockResolvedValue(dummySourceTracking);

      const result = await instance.getSourceTracker(
        dummyPath,
        dummyConnection
      );

      expect(result).toBe(dummySourceTracking);
      expect(instance.sourceTrackers.get(dummyPath)).toBe(dummySourceTracking);
    });
  });
});
