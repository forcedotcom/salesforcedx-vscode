/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  isApexLspTelemetryAllowed,
  ALLOWED_APEX_LSP_TELEMETRY_FEATURES,
  BLOCKED_APEX_LSP_TELEMETRY_FEATURES,
  JORJE_LSP_TELEMETRY_FEATURES_FROM_SOURCE,
  JORJE_LSP_TELEMETRY_LEGACY_FEATURE_ALIASES
} from '../../../src/telemetry/apexLspTelemetryAllowlist';

describe('apexLspTelemetryAllowlist', () => {
  it('partitions every Jorje-sourced Feature into allowed xor blocked', () => {
    for (const feature of JORJE_LSP_TELEMETRY_FEATURES_FROM_SOURCE) {
      const allowed = ALLOWED_APEX_LSP_TELEMETRY_FEATURES.has(feature);
      const blocked = BLOCKED_APEX_LSP_TELEMETRY_FEATURES.has(feature);
      expect(allowed !== blocked).toBe(true);
    }
  });

  it('has no duplicate entries in JORJE inventory', () => {
    const unique = new Set(JORJE_LSP_TELEMETRY_FEATURES_FROM_SOURCE);
    expect(unique.size).toBe(JORJE_LSP_TELEMETRY_FEATURES_FROM_SOURCE.length);
  });

  it('keeps allowed and blocked disjoint', () => {
    for (const feature of ALLOWED_APEX_LSP_TELEMETRY_FEATURES) {
      expect(BLOCKED_APEX_LSP_TELEMETRY_FEATURES.has(feature)).toBe(false);
    }
  });

  it('includes legacy aliases only in allowed (not in Jorje source list)', () => {
    for (const feature of JORJE_LSP_TELEMETRY_LEGACY_FEATURE_ALIASES) {
      expect(JORJE_LSP_TELEMETRY_FEATURES_FROM_SOURCE).not.toContain(feature);
      expect(ALLOWED_APEX_LSP_TELEMETRY_FEATURES.has(feature)).toBe(true);
    }
  });

  it('allows listed Feature values', () => {
    for (const feature of ALLOWED_APEX_LSP_TELEMETRY_FEATURES) {
      expect(isApexLspTelemetryAllowed({ Feature: feature, Exception: 'None' })).toBe(true);
    }
  });

  it('rejects blocked Feature values', () => {
    for (const feature of BLOCKED_APEX_LSP_TELEMETRY_FEATURES) {
      expect(isApexLspTelemetryAllowed({ Feature: feature, Exception: 'None' })).toBe(false);
    }
  });

  it('rejects unknown Feature values', () => {
    expect(isApexLspTelemetryAllowed({ Feature: 'RenameTest', Exception: 'None' })).toBe(false);
  });

  it('rejects missing or invalid Feature', () => {
    expect(isApexLspTelemetryAllowed(undefined)).toBe(false);
    expect(isApexLspTelemetryAllowed({})).toBe(false);
    expect(isApexLspTelemetryAllowed({ Feature: '' })).toBe(false);
  });
});
