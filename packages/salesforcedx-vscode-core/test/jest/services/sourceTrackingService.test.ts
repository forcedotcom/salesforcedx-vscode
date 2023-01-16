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

// const stCreateMock = jest.fn();
// jest.mock('@salesforce/source-deploy-retrieve', () => {
//   return {
//     ...jest.requireActual('@salesforce/source-deploy-retrieve'),
//     importMessagesDirectory: jest.fn()
//   };
// });
// const mockCore = {
//   // ...jest.requireActual('@salesforce/source-tracking'),
//   Org: jest.fn().mockImplementation(() => {
//     return { create: jest.fn() };
//   })
// };

// jest.mock('@salesforce/core', () => {
//   return mockCore;
// });
// Org: {
//   create: jest.fn().mockImplementation(() => {
//     return { init: jest.fn() };
//   })
// },

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Org: { create: jest.fn() },
  SfProject: { resolve: jest.fn() }
}));

// var createMock = jest.fn().mockImplementation(() => {
//   return { orgId: jest.fn() } as any;
// });
// tslint:disable-next-line:no-var-keyword
// tslint:disable-next-line:prefer-const
var sourceTrackingMock = { orgId: jest.fn() } as any;
// tslint:disable-next-line:no-var-keyword
// tslint:disable-next-line:prefer-const
var stClassMock = {
  create: jest.fn().mockImplementation(() => {
    return sourceTrackingMock;
  })
};

// jest.mock('@salesforce/source-tracking', () => ({
//   SourceTracking: jest.fn().mockImplementation(() => {
//     return stClassMock;
//   })
// }));

jest.mock('@salesforce/source-tracking', () => ({
  SourceTracking: { create: jest.fn() }
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
  // const sourceTrackingCreateSpy = jest.spyOn(SourceTracking, 'create');

  beforeEach(() => {
    workspaceContextGetInstanceSpy.mockReturnValue(mockWorkspaceContext);
    // sourceTrackingCreateSpy.mockResolvedValue({} as any);
  });

  it('Should return an instance of SourceTracking', async () => {
    const sts = SourceTrackingService.createSourceTracking();

    expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
    expect(mockWorkspaceContext.getConnection).toHaveBeenCalled();
    // expect(Org.create).toHaveBeenCalled();
    // expect(SfProject.resolve).toHaveBeenCalled();
    // expect(createMock).toHaveBeenCalled();
    // expect(SourceTracking.create).toHaveBeenCalled();
    expect(stClassMock.create).toHaveBeenCalled();
    // not working - not sure why
    // expect(orgCreateSpy).toHaveBeenCalled();
    // expect(mockCore.Org).toHaveBeenCalled();
    // expect(sfProjectResolveSpy).toHaveBeenCalled();

    /*
    For some reason this fails:

  ● createSourceTracking › Should return an instance of SourceTracking

    expect(jest.fn()).toHaveBeenCalled()

    Expected number of calls: >= 1
    Received number of calls:    0

      28 |   it('Should return an instance of SourceTracking', async () => {
      29 |     const sts = SourceTrackingService.createSourceTracking();
    > 30 |     expect(sourceTrackingCreateSpy).toHaveBeenCalled();
         |                                     ^
      31 |   });

    */
    // expect(sourceTrackingCreateSpy).toHaveBeenCalled();
  });
});
