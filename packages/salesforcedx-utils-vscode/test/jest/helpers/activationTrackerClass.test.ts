/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionContext } from 'vscode';
import { ActivationTracker } from '../../../src/helpers/activationTracker';
import { getExtensionInfo } from '../../../src/helpers/activationTrackerUtils';
import { TimingUtils } from '../../../src/helpers/timingUtils';
import { TelemetryServiceInterface } from '../../../src/types';

jest.mock('../../../src/helpers/timingUtils', () => ({
  TimingUtils: {
    getCurrentTime: jest.fn(),
    getElapsedTime: jest.fn()
  }
}));

jest.mock('../../../src/helpers/activationTrackerUtils');

const mockGetExtensionInfo = getExtensionInfo as jest.Mock;

jest.mock('vscode', () => ({
  ExtensionKind: {
    Workspace: 1,
    User: 2
  },
  Uri: {
    parse: jest.fn()
  }
}));

describe('ActivationTracker', () => {
  let extensionContext: ExtensionContext;
  let telemetryService: TelemetryServiceInterface;
  let tracker: ActivationTracker;

  beforeEach(() => {
    extensionContext = {
      extension: {
        id: 'test.extension'
      }
    } as unknown as ExtensionContext;

    telemetryService = {
      sendActivationEventInfo: jest.fn(),
      sendExtensionActivationEvent: jest.fn()
    } as unknown as TelemetryServiceInterface;

    // Set up default mock return values for TimingUtils
    (TimingUtils.getCurrentTime as jest.Mock).mockReturnValue(Date.now());
    (TimingUtils.getElapsedTime as jest.Mock).mockReturnValue(100);

    // Mock getExtensionInfo to return undefined (simulating when extension info can't be retrieved)
    mockGetExtensionInfo.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call sendActivationEventInfo on markActivationStop', async () => {
    tracker = new ActivationTracker(extensionContext, telemetryService);
    await tracker.markActivationStop();

    expect(telemetryService.sendActivationEventInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        activateStartTime: expect.any(Number),
        activateStartDate: expect.any(Date),
        activateEndDate: expect.any(Date),
        extensionActivationTime: expect.any(Number),
        markEndTime: expect.any(Number),
        loadStartDate: undefined
      })
    );
  });

  it('should calculate elapsed time correctly', async () => {
    // Mock TimingUtils before creating tracker
    const mockGetCurrentTime = jest
      .fn()
      .mockReturnValueOnce(1000) // start time
      .mockReturnValueOnce(2000); // end time
    const mockGetElapsedTime = jest.fn().mockReturnValue(1000);

    (TimingUtils.getCurrentTime as jest.Mock) = mockGetCurrentTime;
    (TimingUtils.getElapsedTime as jest.Mock) = mockGetElapsedTime;

    tracker = new ActivationTracker(extensionContext, telemetryService);
    await tracker.markActivationStop();

    expect(mockGetCurrentTime).toHaveBeenCalledTimes(2);
    expect(mockGetElapsedTime).toHaveBeenCalledWith(1000);
    expect(telemetryService.sendActivationEventInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionActivationTime: 1000
      })
    );
  });

  it('should include loadStartDate when extension info is available', async () => {
    const mockLoadStartDate = new Date('2024-01-01T00:00:00Z');
    mockGetExtensionInfo.mockResolvedValue({
      loadStartDate: mockLoadStartDate,
      isActive: true,
      path: '/test/path',
      kind: 1,
      uri: { scheme: 'file', path: '/test/path' }
    });

    tracker = new ActivationTracker(extensionContext, telemetryService);
    await tracker.markActivationStop();

    expect(telemetryService.sendActivationEventInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        loadStartDate: mockLoadStartDate
      })
    );
  });

  it('should use real dates instead of performance.now() timestamps', async () => {
    const startTime = Date.now();
    tracker = new ActivationTracker(extensionContext, telemetryService);

    // Small delay to ensure different times
    await new Promise(resolve => setTimeout(resolve, 10));
    await tracker.markActivationStop();

    const call = (telemetryService.sendActivationEventInfo as jest.Mock).mock.calls[0][0] as {
      activateStartDate: Date;
      activateEndDate: Date;
    };

    // Verify dates are actual Date objects and reasonable
    expect(call.activateStartDate).toBeInstanceOf(Date);
    expect(call.activateEndDate).toBeInstanceOf(Date);
    expect(call.activateStartDate.getTime()).toBeGreaterThanOrEqual(startTime);
    expect(call.activateEndDate.getTime()).toBeGreaterThan(call.activateStartDate.getTime());

    // Verify dates are NOT in 1970 (which would indicate using performance.now())
    expect(call.activateStartDate.getFullYear()).toBeGreaterThan(2020);
    expect(call.activateEndDate.getFullYear()).toBeGreaterThan(2020);
  });
});
