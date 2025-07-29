/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
// @ts-nocheck

/**
 * NOTE:
 * This test file uses dynamic imports to allow Jest to properly mock VS Code dependencies.
 * Due to TypeScript's ESM + moduleResolution=node16/nodenext behavior, dynamic imports require `.js` extensions,
 * but Jest cannot resolve TypeScript sources with `.js` in the path.
 *
 * We suppress TS and ESLint rules here to enable working dynamic imports *without* breaking the test runtime.
 * This is a known limitation in the TS + Jest ecosystem.
 */

import * as vscode from 'vscode';
import { AppInsights } from '../../../../src';
import * as Settings from '../../../../src/settings';
import { determineReporters } from '../../../../src/telemetry/reporters/determineReporters';
import { LogStream } from '../../../../src/telemetry/reporters/logStream';
import { LogStreamConfig } from '../../../../src/telemetry/reporters/logStreamConfig';
import { TelemetryFile } from '../../../../src/telemetry/reporters/telemetryFile';
import { TelemetryReporterConfig } from '../../../../src/telemetry/reporters/telemetryReporterConfig';

jest.mock('vscode');
const vscodeMocked = jest.mocked(vscode);

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
    // Mock Uri.file for LogStream
    vscodeMocked.Uri.file.mockImplementation(filePath => ({
      fsPath: filePath,
      scheme: 'file',
      authority: '',
      path: filePath,
      query: '',
      fragment: '',
      with: jest.fn(),
      toString: jest.fn().mockReturnValue(`file://${filePath}`),
      toJSON: jest.fn().mockReturnValue({ scheme: 'file', path: filePath })
    }));
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
      vscodeMocked.workspace.fs.writeFile.mockResolvedValue(undefined);
      LogStreamConfig.isEnabledFor = jest.fn().mockReturnValue(true);
      const reporters = determineReporters(config);
      expect(reporters).toHaveLength(2);
      expect(reporters[0]).toBeInstanceOf(AppInsights);
      expect(reporters[1]).toBeInstanceOf(LogStream);
    });
  });
});

describe('initializeO11yReporter', () => {
  const extName = 'test-ext';
  const o11yUploadEndpoint = 'https://o11y.salesforce.com/upload';
  const userId = 'user-abc';
  const version = '2.0.0';
  let O11yReporterMock: jest.Mock;
  let initializeMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Mock O11yReporter and its initialize method
    initializeMock = jest.fn().mockResolvedValue(undefined);
    O11yReporterMock = jest.fn().mockImplementation(() => ({
      initialize: initializeMock
    }));
    jest.doMock('../../../../src/telemetry/reporters/o11yReporter', () => ({
      O11yReporter: O11yReporterMock
    }));
    // Clear the require cache for determineReporters to pick up the new mock
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should initialize and add an O11yReporter instance', async () => {
    const { initializeO11yReporter } = await import('../../../../src/telemetry/reporters/determineReporters');
    await initializeO11yReporter(extName, o11yUploadEndpoint, userId, version);
    expect(O11yReporterMock).toHaveBeenCalledWith(extName, version, o11yUploadEndpoint, userId);
    expect(initializeMock).toHaveBeenCalledWith(extName);
  });

  it('should not re-initialize if already initialized', async () => {
    const { initializeO11yReporter } = await import('../../../../src/telemetry/reporters/determineReporters');
    await initializeO11yReporter(extName, o11yUploadEndpoint, userId, version);
    O11yReporterMock.mockClear();
    initializeMock.mockClear();
    await initializeO11yReporter(extName, o11yUploadEndpoint, userId, version);
    expect(O11yReporterMock).not.toHaveBeenCalled();
    expect(initializeMock).not.toHaveBeenCalled();
  });

  it('should wait for in-progress initialization if called concurrently', async () => {
    const { initializeO11yReporter } = await import('../../../../src/telemetry/reporters/determineReporters');
    let resolveInit: (() => void) | undefined;
    initializeMock.mockImplementation(
      () =>
        new Promise<void>(res => {
          resolveInit = res;
        })
    );
    const p1 = initializeO11yReporter(extName, o11yUploadEndpoint, userId, version);
    const p2 = initializeO11yReporter(extName, o11yUploadEndpoint, userId, version);
    if (resolveInit) {
      resolveInit();
    }
    await Promise.all([p1, p2]);
    expect(O11yReporterMock).toHaveBeenCalledTimes(1);
    expect(initializeMock).toHaveBeenCalledTimes(1);
  });

  it('should clean up if initialization fails', async () => {
    const { initializeO11yReporter } = await import('../../../../src/telemetry/reporters/determineReporters');
    initializeMock.mockRejectedValue(new Error('fail!'));
    await expect(initializeO11yReporter(extName, o11yUploadEndpoint, userId, version)).resolves.toBeUndefined();
    // Try again, should attempt to re-initialize
    initializeMock.mockResolvedValue(undefined);
    await initializeO11yReporter(extName, o11yUploadEndpoint, userId, version);
    expect(O11yReporterMock).toHaveBeenCalledTimes(2);
  });

  it('should add O11yReporter to reporters if initialized', async () => {
    const { initializeO11yReporter, determineReporters: reImportedDetermineReporters } = await import(
      '../../../../src/telemetry/reporters/determineReporters'
    );
    await initializeO11yReporter(extName, o11yUploadEndpoint, userId, version);
    const config = {
      extName,
      version,
      aiKey: 'ai-key',
      userId,
      reporterName: 'test-reporter',
      isDevMode: false
    };
    const reporters = reImportedDetermineReporters(config);
    // Should include the O11yReporter instance
    expect(reporters.some((r: any) => r && r.initialize === initializeMock)).toBe(true);
  });
});
