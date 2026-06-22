/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Repro for https://github.com/forcedotcom/salesforcedx-vscode/issues/4690
 *
 * Original bug (v57.2.1): "Debugging an individual LWC test doesn't work if the total
 * output exceeds 1024 characters." A long project path + long test name pushed the
 * assembled debug command line over 1024 chars and the debugger silently failed to attach.
 *
 * Root cause (per merged fix PR #4688): the --testNamePattern value was wrapped in extra
 * quotes, inflating output length. Fixed by dropping the quotes.
 *
 * These assertions document the current behavior. If the bug is still reproducible they fail.
 */

import { getTestNamePatternArgs } from '../../../../src/testSupport/testRunner/testRunner';

describe('issue #4690 repro - LWC debug test with long output', () => {
  it('does not wrap the testNamePattern value in surrounding quotes (PR #4688 root-cause fix)', () => {
    const testName = 'displays the correct number of tiles';
    const [flag, pattern] = getTestNamePatternArgs(testName);
    expect(flag).toBe('--testNamePattern');
    // the inflating quotes that caused the >1024 char overflow are gone
    expect(pattern.startsWith('"')).toBe(false);
    expect(pattern.endsWith('"')).toBe(false);
    expect(pattern).toBe(testName);
  });

  it('keeps testNamePattern as a discrete array arg even for very long test names (no 1024 char shell limit)', () => {
    // simulate the reporter's long ebikes test title, exaggerated past 1024 chars
    const longTestName = `displays the correct number of tiles ${'x'.repeat(1100)}`;
    const args = getTestNamePatternArgs(longTestName);
    // arg passed as a separate array element, not concatenated into one shell string
    expect(args).toHaveLength(2);
    expect(args[0]).toBe('--testNamePattern');
    expect(args[1]).toContain('x'.repeat(1100));
    // the value carries no length-inflating quote wrapping
    expect(args[1]).not.toContain('"');
  });

  it('still escapes regex symbols in the test name (regression guard)', () => {
    const [, pattern] = getTestNamePatternArgs('orderBuilder (filtered) tiles');
    expect(pattern).toBe('orderBuilder \\(filtered\\) tiles');
  });
});
