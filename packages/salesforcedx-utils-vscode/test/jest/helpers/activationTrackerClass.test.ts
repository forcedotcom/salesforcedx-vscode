/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionContext, ExtensionKind, Uri } from 'vscode';
import { ActivationTracker } from '../../../src/helpers/activationTracker';
import { getExtensionInfo } from '../../../src/helpers/activationTrackerUtils';
import { TelemetryService } from '../../../src/services/telemetry';

jest.mock('../../../src/helpers/activationTrackerUtils', () => ({
  getExtensionInfo: jest.fn()
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
      getEndHRTime: jest.fn(() => 3.141)
    } as unknown as TelemetryService;
  });

  it('should create activation info on construction', () => {
    tracker = new ActivationTracker(extensionContext, telemetryService);
    expect(tracker.activationInfo).toBeDefined();
  });

  it('should update activation info on markActivationStop', async () => {
    const mockExtensionInfo = {
      isActive: true,
      path: '/path/to/extension',
      kind: ExtensionKind.Workspace,
      uri: Uri.parse('file:///path/to/extension'),
      loadStartDate: new Date()
    };

    (getExtensionInfo as jest.Mock).mockResolvedValue(mockExtensionInfo);
    tracker = new ActivationTracker(extensionContext, telemetryService);
    await tracker.markActivationStop();

    expect(tracker.activationInfo).toEqual({
      startActivateHrTime: expect.arrayContaining([
        expect.any(Number),
        expect.any(Number)
      ]),
      activateStartDate: expect.any(Date),
      activateEndDate: expect.any(Date),
      extensionActivationTime: expect.any(Number),
      markEndTime: expect.any(Number),
      ...mockExtensionInfo
    });

    expect(telemetryService.sendActivationEventInfo).toHaveBeenCalledWith(
      tracker.activationInfo
    );
  });
});
