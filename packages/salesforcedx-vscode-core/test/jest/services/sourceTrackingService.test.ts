import { SourceTracking } from '@salesforce/source-tracking';
import { SourceTrackingService } from '../../../src/services';
import { testData } from '../../vscode-integration/services/tracking/testdata/sourceTracking';

const sourceTrackingMocked: any = jest.mocked(SourceTracking);

// const sourceTrackingMocked = jest.mocked(SourceTracking);
describe('SourceTrackingService', () => {
  let sourceTrackingServiceCreateMock: jest.SpyInstance;
  // let sourceTrackingServiceGetSourceStatusSummaryMock: jest.SpyInstance;
  beforeEach(() => {
    sourceTrackingServiceCreateMock = jest
      .spyOn(SourceTrackingService.prototype, 'createSourceTracking')
      .mockResolvedValue(sourceTrackingMocked);
    // sourceTrackingServiceGetSourceStatusSummaryMock = jest
    //   .spyOn(SourceTrackingService.prototype, 'getSourceStatusSummary')
    //   .mockResolvedValue(String(testData.statusOutputRows));
  });
  describe('createSourceTracking', () => {
    beforeEach(() => {
      // Todo: stubs
    });
    it('Should return an instance of SourceTracking', async () => {
      // sourceTrackingMocked.mockResolvedValue(testData.statusOutputRows);
      const sourceTrackingServiceSUT: SourceTrackingService = new SourceTrackingService(
        sourceTrackingMocked
      );
      const sourceTracking = await sourceTrackingServiceSUT.createSourceTracking();

      expect(sourceTrackingServiceCreateMock).toHaveBeenCalled();
      // todo: more expects
    });
  });
  describe('getSourceStatusSummary', () => {
    it('Should return a properly formatted string when local and remote changes exist.', async () => {
      // Arrange
      // sourceTrackingMocked.getStatus.returns(testData.statusOutputRows);
      const sourceTrackingServiceSUT: SourceTrackingService = new SourceTrackingService(
        sourceTrackingMocked
      );

      // Act
      const formattedOutput: string = await sourceTrackingServiceSUT.getSourceStatusSummary(
        {}
      );

      // Assert
      expect(formattedOutput).toEqual(testData.statusSummaryString);
    });
  });
});
