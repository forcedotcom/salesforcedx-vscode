/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionContext } from 'vscode';
import { ActivationTracker } from '../../../src/helpers/activationTracker';
import { TimingUtils } from '../../../src/helpers/timingUtils';
import { TelemetryService } from '../../../src/services/telemetry';

jest.mock('../../../src/helpers/timingUtils', () => ({
  TimingUtils: {
    getCurrentTime: jest.fn(),
    getElapsedTime: jest.fn()
  }
}));

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
  let telemetryService: TelemetryService;
  let tracker: ActivationTracker;

  beforeEach(() => {
    extensionContext = {
      extension: {
        id: 'test.extension'
      }
    } as unknown as ExtensionContext;

    telemetryService = {
      sendActivationEventInfo: jest.fn(),
      sendExtensionActivationEvent: jest.fn(),
      getEndHRTime: jest.fn(() => 3.141)
    } as unknown as TelemetryService;

    // Set up default mock return values for TimingUtils
    (TimingUtils.getCurrentTime as jest.Mock).mockReturnValue(Date.now());
    (TimingUtils.getElapsedTime as jest.Mock).mockReturnValue(100);
  });

  it('should create activation tracker on construction', () => {
    tracker = new ActivationTracker(extensionContext, telemetryService);
    expect(tracker).toBeDefined();
  });

  it('should call sendActivationEventInfo on markActivationStop', () => {
    tracker = new ActivationTracker(extensionContext, telemetryService);
    tracker.markActivationStop();

    expect(telemetryService.sendActivationEventInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        startActivateHrTime: expect.any(Number),
        activateStartDate: expect.any(Date),
        activateEndDate: expect.any(Date),
        extensionActivationTime: expect.any(Number),
        markEndTime: expect.any(Number)
      })
    );
  });

  it('should calculate elapsed time correctly', () => {
    // Mock TimingUtils before creating tracker
    const mockGetCurrentTime = jest
      .fn()
      .mockReturnValueOnce(100) // start time
      .mockReturnValueOnce(150); // end time
    const mockGetElapsedTime = jest.fn().mockReturnValue(50);

    (TimingUtils.getCurrentTime as jest.Mock) = mockGetCurrentTime;
    (TimingUtils.getElapsedTime as jest.Mock) = mockGetElapsedTime;

    tracker = new ActivationTracker(extensionContext, telemetryService);
    tracker.markActivationStop();

    expect(telemetryService.sendActivationEventInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionActivationTime: 50
      })
    );
  });
});
