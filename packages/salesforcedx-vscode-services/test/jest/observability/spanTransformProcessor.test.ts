/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'node:os';
import { isInternalUser } from '../../../src/observability/spanTransformProcessor';

describe('isInternalUser', () => {
  let hostnameSpy: jest.SpyInstance;

  beforeEach(() => {
    hostnameSpy = jest.spyOn(os, 'hostname').mockReturnValue('laptop.example.com');
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
