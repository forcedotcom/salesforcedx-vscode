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
  const getUsernameMock = jest.fn();
  const dummyConnection = { getUsername: getUsernameMock } as any;
  const dummySourceTracking = {} as any;
  let instance: any;

  describe('getSourceTracker', () => {
    const dummyUsername = 'aUsername';
    let getRootWorkspacePathStub: jest.SpyInstance;

    beforeEach(() => {
      instance = SourceTrackingProvider.getInstance();
      getRootWorkspacePathStub = jest
        .spyOn(workspaceUtils, 'getRootWorkspacePath')
        .mockReturnValue(dummyPath);
    });

    it('should return the STL instance for this project if it already exists', async () => {
      getUsernameMock.mockReturnValue(dummyUsername);
      instance.sourceTrackers.set(
        dummyPath + dummyUsername,
        dummySourceTracking
      );

      const result = await instance.getSourceTracker(
        dummyPath,
        dummyConnection
      );

      expect(result).toBe(dummySourceTracking);
    });

    it('should create a new instance of STL if one doesnt already exist and add it to the map', async () => {
      jest
        .spyOn(SourceTracking, 'create')
        .mockResolvedValue(dummySourceTracking);

      const result = await instance.getSourceTracker(
        dummyPath,
        dummyConnection
      );

      expect(result).toBe(dummySourceTracking);
      expect(instance.sourceTrackers.get(dummyPath + dummyUsername)).toBe(
        dummySourceTracking
      );
    });
  });
});
