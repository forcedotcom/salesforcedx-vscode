/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceTracking } from '@salesforce/source-tracking';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { SourceTrackingService } from './../../../src/services/sourceTrackingService';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Org: { create: jest.fn() },
  SfProject: { resolve: jest.fn() }
}));

describe('Source Tracking Service', () => {
  const mockConnection = {} as any;
  const getConnectionStub = jest.fn().mockImplementation(() => {
    return mockConnection;
  });
  const mockWorkspaceContext = { getConnection: getConnectionStub } as any;
  const workspaceContextGetInstanceSpy = jest.spyOn(
    WorkspaceContext,
    'getInstance'
  );
  const sourceTrackingCreateSpy = jest
    .spyOn(SourceTracking, 'create')
    .mockResolvedValue({} as any);

  beforeEach(() => {
    workspaceContextGetInstanceSpy.mockReturnValue(mockWorkspaceContext);
    sourceTrackingCreateSpy.mockResolvedValue({} as any);
  });

  it('Should create an instance of SourceTracking', async () => {
    await SourceTrackingService.createSourceTracking();

    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(mockWorkspaceContext.getConnection).toHaveBeenCalled();
    expect(sourceTrackingCreateSpy).toHaveBeenCalled();
  });
});
