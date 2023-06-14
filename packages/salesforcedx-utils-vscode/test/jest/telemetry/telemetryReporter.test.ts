/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { workspace } from 'vscode';
import { TelemetryReporter, WorkspaceContextUtil } from '../../../src';

describe('Telemetry Reporter', () => {
  describe('sendTelemetryEvent', () => {
    it('should send orgId to trackEvent', () => {});

    it('should send orgId to logStream.write', () => {});
  });

  describe('sendExceptionEvent', () => {
    let getInstanceMock: jest.SpyInstance;
    const dummyOrgId = '000dummyOrgId';
    const getMock = jest.fn().mockReturnValueOnce(true);
    const fakeConfig: any = { get: getMock };

    beforeEach(() => {
      getInstanceMock = jest
        .spyOn(WorkspaceContextUtil, 'getInstance')
        .mockReturnValue({
          orgId: dummyOrgId
        } as any);

      jest.spyOn(workspace, 'getConfiguration').mockReturnValue(fakeConfig);
    });

    it('should send orgId to trackException', () => {
      const telemetryReporter = new TelemetryReporter('', '', '');
      (telemetryReporter as any).userOptIn = true;
      const trackExceptionMock = jest.fn();
      (telemetryReporter as any).appInsightsClient = {
        trackException: trackExceptionMock
      };

      telemetryReporter.sendExceptionEvent(
        'Dummy Exception',
        'a dummy exception occurred'
      );
      expect(trackExceptionMock).toHaveBeenCalledTimes(1);
      expect(trackExceptionMock.mock.calls[0][0].properties.orgId).toEqual(
        dummyOrgId
      );
    });

    it('should send orgId to logStream.write', () => {});
  });
});
