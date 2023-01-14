/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Org, SfProject } from '@salesforce/core';
import { SourceTracking } from '@salesforce/source-tracking';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { SourceTrackingService } from './../../../src/services/sourceTrackingService';

describe('createSourceTracking', () => {
  const workspaceContextGetInstanceSpy = jest.spyOn(
    WorkspaceContext,
    'getInstance'
  );
  SourceTracking.create = jest.fn();
  Org.create = jest.fn();
  SfProject.resolve = jest.fn();

  const mockWorkspaceContext = { getConnection: jest.fn() } as any;

  beforeEach(() => {
    workspaceContextGetInstanceSpy.mockReturnValue(mockWorkspaceContext);
  });

  it('Should return an instance of SourceTracking', async () => {
    const sts = SourceTrackingService.createSourceTracking();
    expect(SourceTracking.create).toHaveBeenCalled();
  });
});
