/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Attributes } from '@opentelemetry/api';
import { type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { isSpanValidForProductionTelemetry } from '../../../src/observability/spanUtils';

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
