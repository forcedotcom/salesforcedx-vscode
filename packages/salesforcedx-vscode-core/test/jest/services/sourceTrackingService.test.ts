import { getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode';
import { SourceTracking } from '@salesforce/source-tracking';
import { tmpdir } from 'os';
import { SourceTrackingService } from '../../../src/services';
import { testData } from '../../vscode-integration/services/tracking/testdata/sourceTracking';

jest.mock('@salesforce/source-tracking');
const sourceTrackingMocked = jest.mocked(SourceTracking);
jest.mock('@salesforce/salesforcedx-utils-vscode');
const getRootWorkspacePathMocked = jest.mocked(getRootWorkspacePath);
const FAKE_WORKSPACE = tmpdir();

describe('SourceTrackingService', () => {
  let processCwdMocked: jest.SpyInstance;
  // Todo: Need a fake
  // * Connection
  // * Org
  // * Project

  beforeEach(() => {
    sourceTrackingMocked.create.mockResolvedValue(sourceTrackingMocked as any);
    (sourceTrackingMocked as any).prototype.getStatus.mockResolvedValue(
      testData.statusOutputRows as any
    );
    getRootWorkspacePathMocked.mockReturnValue(FAKE_WORKSPACE);
    processCwdMocked = jest.spyOn(process, 'cwd').mockReturnValue('');
  });

  describe('createSourceTracking', () => {
    it('Should return an instance of SourceTracking', async () => {
      // Arrange
      const sourceTrackingServiceSUT: SourceTrackingService = new SourceTrackingService(
        sourceTrackingMocked as any
      );

      // Act
      const sourceTracking = await sourceTrackingServiceSUT.createSourceTracking();

      // Assert
      expect(processCwdMocked).toHaveBeenCalled();
      expect(sourceTrackingMocked.create).toHaveBeenCalled();
      // todo: more expects
    });
  });

  describe('getSourceStatusSummary', () => {
    it('Should return a properly formatted string when local and remote changes exist.', async () => {
      // Arrange
      const sourceTrackingServiceSUT: SourceTrackingService = new SourceTrackingService(
        sourceTrackingMocked as any
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
