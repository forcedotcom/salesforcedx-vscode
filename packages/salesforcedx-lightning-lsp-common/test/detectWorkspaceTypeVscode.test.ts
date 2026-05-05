/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type { WorkspaceType } from '../src/shared';

const mockDetectWorkspaceHelper = jest.fn<Promise<WorkspaceType>, [string, unknown]>();
jest.mock('../src/shared', () => ({
  ...jest.requireActual('../src/shared'),
  detectWorkspaceHelper: (...args: [string, unknown]) => mockDetectWorkspaceHelper(...args)
}));

import { detectWorkspaceType } from '../src/detectWorkspaceTypeVscode';

const run = (workspaceRoots: string[]) => Effect.runPromise(detectWorkspaceType(workspaceRoots));

describe('detectWorkspaceType', () => {
  beforeEach(() => {
    mockDetectWorkspaceHelper.mockReset();
  });

  it('returns UNKNOWN for empty workspaceRoots', async () => {
    expect(await run([])).toBe('UNKNOWN');
    expect(mockDetectWorkspaceHelper).not.toHaveBeenCalled();
  });

  it('delegates to detectWorkspaceHelper for single root', async () => {
    mockDetectWorkspaceHelper.mockResolvedValueOnce('SFDX');
    expect(await run(['/root'])).toBe('SFDX');
    expect(mockDetectWorkspaceHelper).toHaveBeenCalledTimes(1);
    expect(mockDetectWorkspaceHelper).toHaveBeenCalledWith('/root', expect.anything());
  });

  it('returns CORE_PARTIAL when all roots are CORE_PARTIAL', async () => {
    mockDetectWorkspaceHelper.mockResolvedValue('CORE_PARTIAL');
    expect(await run(['/a', '/b', '/c'])).toBe('CORE_PARTIAL');
    expect(mockDetectWorkspaceHelper).toHaveBeenCalledTimes(3);
  });

  it('returns UNKNOWN when any root is not CORE_PARTIAL (multi-root)', async () => {
    mockDetectWorkspaceHelper.mockResolvedValueOnce('CORE_PARTIAL').mockResolvedValueOnce('SFDX');
    expect(await run(['/a', '/b'])).toBe('UNKNOWN');
  });

  it('short-circuits on first non-CORE_PARTIAL root', async () => {
    mockDetectWorkspaceHelper.mockResolvedValueOnce('UNKNOWN');
    expect(await run(['/a', '/b'])).toBe('UNKNOWN');
    expect(mockDetectWorkspaceHelper).toHaveBeenCalledTimes(1);
  });
});
