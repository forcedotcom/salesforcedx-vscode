/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AppInsights } from '../../../../src';
import * as Settings from '../../../../src/settings';
import { determineReporters } from '../../../../src/telemetry/reporters/determineReporters';
import { LogStream } from '../../../../src/telemetry/reporters/logStream';
import { LogStreamConfig } from '../../../../src/telemetry/reporters/logStreamConfig';
import { TelemetryFile } from '../../../../src/telemetry/reporters/telemetryFile';
import { TelemetryReporterConfig } from '../../../../src/telemetry/reporters/telemetryReporterConfig';

describe('determineReporters', () => {
  let config: TelemetryReporterConfig;

  beforeEach(() => {
    // local logging
    Settings.SettingsService.isAdvancedSettingEnabledFor = jest.fn().mockReturnValue(false);
    LogStreamConfig.isEnabledFor = jest.fn().mockReturnValue(false);
    config = {
      extName: 'salesforcedx-vscode',
      version: '1.0.0',
      aiKey: '1234567890',
      userId: 'user123',
      reporterName: 'salesforcedx-vscode',
      isDevMode: false
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return an array', () => {
    const reporters = determineReporters(config);
    expect(reporters).toBeInstanceOf(Array);
  });

  describe('in dev mode', () => {
    beforeEach(() => {
      config.isDevMode = true;
    });

    afterEach(() => {
      config.isDevMode = false;
    });

    it('should return no reporters', () => {
      const reporters = determineReporters(config);
      expect(reporters).toHaveLength(0);
    });

    it('should return TelemetryFile reporter when local logging is enabled', () => {
      Settings.SettingsService.isAdvancedSettingEnabledFor = jest.fn().mockReturnValue(true);
      const reporters = determineReporters(config);
      expect(reporters).toHaveLength(1);
      expect(reporters[0]).toBeInstanceOf(TelemetryFile);
    });
  });

  describe('not in dev mode', () => {
    it('should return AppInsights reporter when log stream is disabled', () => {
      const reporters = determineReporters(config);
      expect(reporters).toHaveLength(1);
      expect(reporters[0]).toBeInstanceOf(AppInsights);
    });

    it('should return AppInsights and LogStream reporters when not in dev mode and log stream is enabled', () => {
      LogStreamConfig.isEnabledFor = jest.fn().mockReturnValue(true);
      const reporters = determineReporters(config);
      expect(reporters).toHaveLength(2);
      expect(reporters[0]).toBeInstanceOf(AppInsights);
      expect(reporters[1]).toBeInstanceOf(LogStream);
    });
  });
});
