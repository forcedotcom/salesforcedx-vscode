/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';
import { pathSuffixWithin } from '../../../src/vscode/uriComparison';

describe('pathSuffixWithin', () => {
  it('returns the child suffix and keeps its segment casing', () => {
    expect(pathSuffixWithin(URI.file('/a/b'), URI.file('/a/b/c/D.ts'))).toBe('c/D.ts');
  });

  it('returns undefined when the child is the root or a sibling', () => {
    expect(pathSuffixWithin(URI.file('/a/b'), URI.file('/a/b'))).toBeUndefined();
    expect(pathSuffixWithin(URI.file('/a/b'), URI.file('/a/c/d'))).toBeUndefined();
  });

  it('matches a Windows file-drive prefix despite casing and keeps the suffix casing', () => {
    expect(
      pathSuffixWithin(URI.parse('file:///C:/proj/staging'), URI.parse('file:///c:/PROJ/staging/Foo/Bar.ts'))
    ).toBe('Foo/Bar.ts');
  });

  it('does not match posix paths that differ only by case', () => {
    expect(pathSuffixWithin(URI.file('/Users/Foo'), URI.file('/Users/foo/Bar.ts'))).toBeUndefined();
  });

  it('does not lowercase non-file schemes', () => {
    expect(pathSuffixWithin(URI.parse('memfs:/C:/Foo'), URI.parse('memfs:/c:/foo/Bar'))).toBeUndefined();
  });
});
