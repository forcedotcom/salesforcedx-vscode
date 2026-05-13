/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fileBadge } from '../../../../src/testSupport/testExplorer/testResultsOutput';
import { LwcJestTestFileResult } from '../../../../src/testSupport/types';

const makeFileResult = (overrides: Partial<LwcJestTestFileResult>): LwcJestTestFileResult =>
  ({
    status: 'passed',
    startTime: 0,
    endTime: 0,
    name: 'file.test.js',
    assertionResults: [],
    ...overrides
  }) as LwcJestTestFileResult;

describe('testResultsOutput.fileBadge', () => {
  it('returns the PASS badge when Jest reports the file as passed and no assertions failed', () => {
    const badge = fileBadge(
      makeFileResult({
        status: 'passed',
        assertionResults: [{ status: 'passed' } as never, { status: 'passed' } as never]
      })
    );
    expect(badge).toContain(' PASS ');
    expect(badge).not.toContain(' FAIL ');
  });

  it('returns the FAIL badge when Jest reports the file as failed', () => {
    const badge = fileBadge(makeFileResult({ status: 'failed' }));
    expect(badge).toContain(' FAIL ');
    expect(badge).not.toContain(' PASS ');
  });

  it('returns the FAIL badge when any assertion failed even if the file status is not explicitly "failed"', () => {
    const badge = fileBadge(
      makeFileResult({
        status: 'passed' as LwcJestTestFileResult['status'],
        assertionResults: [{ status: 'passed' } as never, { status: 'failed' } as never]
      })
    );
    expect(badge).toContain(' FAIL ');
  });

  it('returns the PASS badge when a single test passed and the rest are skipped (filtered via --testNamePattern)', () => {
    const badge = fileBadge(
      makeFileResult({
        status: 'passed',
        assertionResults: [
          { status: 'passed' } as never,
          { status: 'skipped' } as never,
          { status: 'pending' } as never
        ]
      })
    );
    expect(badge).toContain(' PASS ');
    expect(badge).not.toContain(' FAIL ');
  });

  it('returns the PASS badge when every assertion is skipped/pending and no test actually failed', () => {
    // This is the regression case: a file whose tests are entirely filtered out by --testNamePattern
    // used to be mislabeled as FAIL because the previous ternary treated any non-"passed" status as FAIL.
    const badge = fileBadge(
      makeFileResult({
        status: 'skipped' as unknown as LwcJestTestFileResult['status'],
        assertionResults: [
          { status: 'skipped' } as never,
          { status: 'pending' } as never,
          { status: 'todo' } as never
        ]
      })
    );
    expect(badge).toContain(' PASS ');
    expect(badge).not.toContain(' FAIL ');
  });

  it('handles missing assertionResults gracefully and treats an unknown non-failed status as PASS', () => {
    const badge = fileBadge(
      makeFileResult({
        status: 'empty' as unknown as LwcJestTestFileResult['status'],
        assertionResults: undefined as unknown as LwcJestTestFileResult['assertionResults']
      })
    );
    expect(badge).toContain(' PASS ');
    expect(badge).not.toContain(' FAIL ');
  });
});
