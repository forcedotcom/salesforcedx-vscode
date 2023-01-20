/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceTracking } from '@salesforce/source-tracking';
import { SourceTrackingService } from '../../../src/services';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Org: { create: jest.fn() },
  SfProject: { resolve: jest.fn() }
}));

describe('Source Tracking Service', () => {
  const sourceTrackingCreateSpy = jest.spyOn(SourceTracking, 'create');

  beforeEach(() => {
    sourceTrackingCreateSpy.mockResolvedValue({} as any);
  });

  it('Should create an instance of SourceTracking', async () => {
    await SourceTrackingService.createSourceTracking('', '');

    expect(sourceTrackingCreateSpy).toHaveBeenCalled();
  });
});
