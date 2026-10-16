/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { shapeFrom } from '../../../src/context/workspaceOrgShape';

describe('shapeFrom', () => {
  it('returns Scratch when isScratch true', () => {
    expect(shapeFrom({ isScratch: true })).toBe('Scratch');
  });

  it('returns Sandbox when isSandbox true and isScratch false', () => {
    expect(shapeFrom({ isSandbox: true })).toBe('Sandbox');
  });

  it('prefers Scratch over Sandbox when both flags set (precedence)', () => {
    expect(shapeFrom({ isScratch: true, isSandbox: true })).toBe('Scratch');
  });

  it('returns Production when alias is set', () => {
    expect(shapeFrom({ alias: 'my-org' })).toBe('Production');
  });

  it('returns Production when only username is set', () => {
    expect(shapeFrom({ username: 'user@example.com' })).toBe('Production');
  });

  it('returns Undefined when nothing is populated', () => {
    expect(shapeFrom({})).toBe('Undefined');
  });
});
