/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TelemetryReporterConfig } from '../../../../src/telemetry/reporters/telemetryReporterConfig';

describe('TelemetryReporterConfig', () => {
  let config: TelemetryReporterConfig;

  beforeEach(() => {
    config = {
      extName: 'test-extension-name',
      version: '1.0.0',
      aiKey: '1234567890',
      userId: 'user123',
      reporterName: 'test-extension-name',
      isDevMode: false
    };
  });

  it('config should be an object following TelemetryReporterConfig interface', () => {
    expect(typeof config).toBe('object');
  });

  it('config should have extName property of type string', () => {
    expect(config).toHaveProperty('extName');
    expect(typeof config.extName).toBe('string');
  });

  it('config should have version property of type string', () => {
    expect(config).toHaveProperty('version');
    expect(typeof config.version).toBe('string');
  });

  it('config should have aiKey property of type string', () => {
    expect(config).toHaveProperty('aiKey');
    expect(typeof config.aiKey).toBe('string');
  });

  it('config should have userId property of type string', () => {
    expect(config).toHaveProperty('userId');
    expect(typeof config.userId).toBe('string');
  });

  it('config should have reporterName property of type string', () => {
    expect(config).toHaveProperty('reporterName');
    expect(typeof config.reporterName).toBe('string');
  });

  it('config should have isDevMode property of type boolean', () => {
    expect(config).toHaveProperty('isDevMode');
    expect(typeof config.isDevMode).toBe('boolean');
  });

  it('should have the correct extension name', () => {
    expect(config).toHaveProperty('extName');
  });

  it('should have the correct version', () => {
    expect(config.version).toBe('1.0.0');
  });

  it('should have the correct AI key', () => {
    expect(config.aiKey).toBe('1234567890');
  });

  it('should have the correct user ID', () => {
    expect(config.userId).toBe('user123');
  });

  it('should have isDevMode false', () => {
    expect(config.isDevMode).toBe(false);
  });

  it('should have the updated isDevMode flag', () => {
    config.isDevMode = true;
    expect(config.isDevMode).toBe(true);
  });
});
