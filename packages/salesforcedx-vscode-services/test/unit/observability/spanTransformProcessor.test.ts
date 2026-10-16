/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MockInstance as VitestMockInstance } from 'vitest';
import * as os from 'node:os';
import {
  isInternalUser,
  setSpanCreationIdentity,
  SpanTransformProcessor
} from '../../../src/observability/spanTransformProcessor';

describe('isInternalUser', () => {
  let hostnameSpy: VitestMockInstance;

  beforeEach(() => {
    hostnameSpy = vi.spyOn(os, 'hostname').mockReturnValue('laptop.example.com');
  });

  it('should return true on Desktop when hostname ends with internal.salesforce.com', () => {
    hostnameSpy.mockReturnValue('machine.internal.salesforce.com');
    expect(isInternalUser('Desktop')).toBe('true');
  });

  it('should return false on Desktop when hostname does not match', () => {
    expect(isInternalUser('Desktop')).toBe('false');
  });

  it('should return undefined on Web', () => {
    expect(isInternalUser('Web')).toBeUndefined();
  });

  it('should return false on Desktop when os.hostname is unavailable', () => {
    hostnameSpy.mockReturnValue(undefined);
    expect(isInternalUser('Desktop')).toBe('false');
  });

  it('should return undefined when uiKindString is undefined', () => {
    hostnameSpy.mockReturnValue('machine.internal.salesforce.com');
    expect(isInternalUser(undefined)).toBeUndefined();
    expect(hostnameSpy).not.toHaveBeenCalled();
  });
});

describe('SpanTransformProcessor legacy identity', () => {
  it('removes live identity that is absent from the frozen send-time snapshot', () => {
    const attributes: Record<string, string | number> = { telemetrySource: 'legacy' };
    const span = {
      parentSpanContext: undefined,
      resource: { attributes: { 'extension.name': 'caller-ext', 'extension.version': '1.0.0' } },
      attributes,
      setAttribute: vi.fn((key: string, value: string | number) => {
        attributes[key] = value;
      })
    } as unknown as Parameters<SpanTransformProcessor['onStart']>[0];
    const processor = new SpanTransformProcessor({
      exporter: {} as never,
      getIdentitySnapshot: () => ({ orgId: 'live-org', telemetryClassification: 'nonGov' }) as never
    });

    processor.onStart(span, {} as Parameters<SpanTransformProcessor['onStart']>[1]);
    setSpanCreationIdentity(span, { telemetryClassification: 'unknown' });
    processor.onEnding(span);

    expect(attributes.orgId).toBeUndefined();
    expect(attributes.userId).toBeUndefined();
    expect(attributes.isSandbox).toBeUndefined();
    expect(attributes['common.vscodemachineid']).toEqual(expect.any(String));
  });
});
