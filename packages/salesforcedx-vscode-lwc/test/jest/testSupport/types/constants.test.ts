/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { matchJestStackTraceLocation } from '../../../../src/testSupport/types/constants';

describe('matchJestStackTraceLocation', () => {
  it('extracts location from a frame with a function name', () => {
    const location = matchJestStackTraceLocation('at Object.<anonymous> (/path/to/file.js:10:5)');

    expect(location).toEqual({ file: '/path/to/file.js', line: 10, column: 5 });
  });

  it('extracts location from a bare frame with no function name', () => {
    const location = matchJestStackTraceLocation('at /path/to/file.js:10:5');

    expect(location).toEqual({ file: '/path/to/file.js', line: 10, column: 5 });
  });

  it('captures the full path when a bare frame contains literal parentheses', () => {
    const location = matchJestStackTraceLocation('at /path/foo(bar)/file.js:10:5');

    expect(location).toEqual({ file: '/path/foo(bar)/file.js', line: 10, column: 5 });
  });

  it('captures the full path when a named frame contains literal parentheses', () => {
    const location = matchJestStackTraceLocation('at new Foo (/path/Program Files (x86)/file.js:10:5)');

    expect(location).toEqual({ file: '/path/Program Files (x86)/file.js', line: 10, column: 5 });
  });

  it('extracts a Windows drive-letter path containing literal parentheses', () => {
    const location = matchJestStackTraceLocation('at new Foo (C:\\Program Files (x86)\\project\\foo.test.js:10:5)');

    expect(location).toEqual({ file: 'C:\\Program Files (x86)\\project\\foo.test.js', line: 10, column: 5 });
  });

  it('picks the first stack frame out of a multi-line message', () => {
    const location = matchJestStackTraceLocation(
      'TypeError: Cannot read properties of undefined\n' +
        '    at Object.<anonymous> (/project/foo.test.js:42:7)\n' +
        '    at Module._compile (node:internal/modules/cjs/loader:1000:1)'
    );

    expect(location).toEqual({ file: '/project/foo.test.js', line: 42, column: 7 });
  });

  it('returns undefined when there is no stack frame', () => {
    const location = matchJestStackTraceLocation('TypeError: Cannot read properties of undefined');

    expect(location).toBeUndefined();
  });
});
