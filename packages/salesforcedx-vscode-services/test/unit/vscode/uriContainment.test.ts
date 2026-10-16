/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';
import { isUriEqualOrWithin, uriPathIncludesSegments } from '../../../src/vscode/uriContainment';

describe('isUriEqualOrWithin', () => {
  it('treats the same path as contained', () => {
    expect(isUriEqualOrWithin(URI.file('/foo'), URI.file('/foo'))).toBe(true);
  });

  it('contains a child path', () => {
    expect(isUriEqualOrWithin(URI.file('/foo'), URI.file('/foo/bar'))).toBe(true);
  });

  it('does not contain a sibling', () => {
    expect(isUriEqualOrWithin(URI.file('/foo'), URI.file('/foobar'))).toBe(false);
    expect(isUriEqualOrWithin(URI.file('/a/b'), URI.file('/a/c'))).toBe(false);
  });

  it('ignores a trailing slash', () => {
    expect(isUriEqualOrWithin(URI.file('/foo/'), URI.file('/foo'))).toBe(true);
    expect(isUriEqualOrWithin(URI.file('/foo'), URI.file('/foo/'))).toBe(true);
    expect(isUriEqualOrWithin(URI.file('/foo/'), URI.file('/foo/bar'))).toBe(true);
  });

  it('rejects a scheme mismatch', () => {
    expect(isUriEqualOrWithin(URI.file('/foo'), URI.parse('memfs:/foo'))).toBe(false);
  });

  it('rejects an authority mismatch', () => {
    expect(isUriEqualOrWithin(URI.parse('file://server/share'), URI.parse('file://other/share'))).toBe(false);
  });

  it('folds scheme and authority case because vscode-uri keeps field casing', () => {
    expect(URI.parse('File:///foo').scheme).toBe('File');
    expect(URI.parse('file://Server/share').authority).toBe('Server');
    expect(isUriEqualOrWithin(URI.parse('File:///foo/bar'), URI.parse('file:///foo/bar'))).toBe(true);
    expect(isUriEqualOrWithin(URI.parse('file://Server/share'), URI.parse('file://server/share/child'))).toBe(true);
  });

  it('treats Windows drive-letter case as contained', () => {
    expect(isUriEqualOrWithin(URI.parse('file:///C:/proj'), URI.parse('file:///c:/proj/file.ts'))).toBe(true);
    expect(isUriEqualOrWithin(URI.parse('file:///C:'), URI.parse('file:///c:/foo'))).toBe(true);
  });

  it('treats Windows path-segment case as contained', () => {
    expect(isUriEqualOrWithin(URI.parse('file:///C:/Users/Runner'), URI.parse('file:///c:/users/RUNNER/project'))).toBe(
      true
    );
  });

  it('keeps posix paths case-sensitive', () => {
    expect(isUriEqualOrWithin(URI.file('/Users/Foo'), URI.file('/Users/foo'))).toBe(false);
    expect(isUriEqualOrWithin(URI.file('/Users/Foo'), URI.file('/Users/foo/file.ts'))).toBe(false);
    expect(isUriEqualOrWithin(URI.file('/Users/Foo'), URI.file('/Users/Foo/file.ts'))).toBe(true);
  });

  it('does not lowercase non-file schemes', () => {
    expect(isUriEqualOrWithin(URI.parse('memfs:/C:/Foo'), URI.parse('memfs:/c:/foo/Bar'))).toBe(false);
    expect(isUriEqualOrWithin(URI.parse('memfs:/C:/Foo'), URI.parse('memfs:/C:/Foo/Bar'))).toBe(true);
  });
});

describe('uriPathIncludesSegments', () => {
  it('lowercases Windows file-drive segment checks only', () => {
    expect(uriPathIncludesSegments(URI.parse('file:///C:/Foo/Metadata-Shadow/a'), ['metadata-shadow'])).toBe(true);
    expect(uriPathIncludesSegments(URI.parse('memfs:/C:/Foo/Metadata-Shadow/a'), ['metadata-shadow'])).toBe(false);
    expect(uriPathIncludesSegments(URI.file('/Users/Foo/Metadata-Shadow/a'), ['metadata-shadow'])).toBe(false);
  });
});
