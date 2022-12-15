/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceTracking } from '@salesforce/source-tracking';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SourceTrackingService } from '../../../../src/services/sourceTrackingService';
import { testData } from './testdata/sourceTracking';

describe('SourceTrackingService', () => {
  describe('createSourceTracking', () => {
    beforeEach(() => {
      // Todo: stubs
    });
    it('Should return an instance of SourceTracking', async () => {
      const sourceTrackingStub = sinon.createStubInstance(SourceTracking);
      sourceTrackingStub.getStatus.returns(testData.statusOutputRows);
      const sourceTrackingServiceSUT: SourceTrackingService = new SourceTrackingService(
        sourceTrackingStub
      );
      // const sourceTracking = await sourceTrackingServiceSUT.createSourceTracking();

      // expect(sourceTrackingStub.create.called).to.equal(true);
      // todo: more expects
    });
  });
  describe('getSourceStatusSummary', () => {
    it('Should return a properly formatted string when local and remote changes exist.', async () => {
      // Arrange
      const sourceTrackingStub = sinon.createStubInstance(SourceTracking);
      sourceTrackingStub.getStatus.returns(testData.statusOutputRows);
      const sourceTrackingServiceSUT: SourceTrackingService = new SourceTrackingService(
        sourceTrackingStub
      );

      // Act
      const formattedOutput: string = await sourceTrackingServiceSUT.getSourceStatusSummary(
        {}
      );

      // Assert
      expect(formattedOutput).to.equal(testData.statusSummaryString);
    });
  });
});
