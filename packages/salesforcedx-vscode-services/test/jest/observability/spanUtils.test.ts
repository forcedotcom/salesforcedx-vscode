/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Attributes } from '@opentelemetry/api';
import { type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { workspace } from 'vscode';
import { isProductionTelemetryExportEnabled } from '../../../src/observability/appInsights';
import { isSpanValidForProductionTelemetry } from '../../../src/observability/spanUtils';

// isTelemetryExtensionConfigurationEnabled reads config.get; spy explicitly each test so results are
// independent of the shared default mock (resetMocks clears the spy between tests).
const spyConfig = (enabled: boolean): void => {
  jest.spyOn(workspace, 'getConfiguration').mockReturnValue({
    get: () => enabled
  } as unknown as ReturnType<typeof workspace.getConfiguration>);
};

// isSpanValidForProductionTelemetry only reads attributes + parentSpanContext (undefined => top-level)
const makeSpan = (attributes: Attributes): ReadableSpan =>
  ({ attributes, parentSpanContext: undefined }) as unknown as ReadableSpan;

describe('isSpanValidForProductionTelemetry', () => {
  it('drops a top-level span flagged telemetryIgnore', () => {
    expect(isSpanValidForProductionTelemetry(makeSpan({ telemetryIgnore: true }))).toBe(false);
  });

  it('keeps a top-level span without telemetryIgnore', () => {
    expect(isSpanValidForProductionTelemetry(makeSpan({}))).toBe(true);
  });

  it('drops a command span flagged telemetryIgnore (ignore wins over command)', () => {
    expect(isSpanValidForProductionTelemetry(makeSpan({ command: 'sf.some.command', telemetryIgnore: true }))).toBe(
      false
    );
  });
});

describe('isProductionTelemetryExportEnabled', () => {
  it('returns the telemetry setting value (true) when enabled and no localhost bypass', () => {
    spyConfig(true);
    expect(isProductionTelemetryExportEnabled()).toBe(true);
  });

  it('returns false when the telemetry setting is disabled and no localhost bypass', () => {
    spyConfig(false);
    expect(isProductionTelemetryExportEnabled()).toBe(false);
  });

  it('bypasses a disabled setting when o11yEndpoint is localhost (dev sink)', () => {
    spyConfig(false);
    expect(isProductionTelemetryExportEnabled('http://localhost:4318')).toBe(true);
  });

  it('does not bypass for a non-localhost o11yEndpoint when disabled', () => {
    spyConfig(false);
    expect(isProductionTelemetryExportEnabled('https://o11y.salesforce.com')).toBe(false);
  });
});
