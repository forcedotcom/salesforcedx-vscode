/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { URI, Utils } from 'vscode-uri';
import { resolveReference } from '../../src/documentLinks';

describe('resolveReference (document link resolution)', () => {
  it('resolves a RELATIVE base href, then ref (legacy url.resolve two-step)', () => {
    // mirrors markup LS links.test.ts <base href="docs/"> + relative src; the case a naive
    // `new URL(ref, base)` swap would break (WHATWG throws on a relative base).
    expect(resolveReference(undefined, 'test://test', 'foo.png', 'docs/')).toBe('test://test/docs/foo.png');
  });

  it('resolves an ABSOLUTE base href', () => {
    expect(resolveReference(undefined, 'test://test', 'foo.png', 'http://www.example.com/page.html')).toBe(
      'http://www.example.com/foo.png'
    );
  });

  it('resolves a root-relative ref against workspacePath via Utils.joinPath', () => {
    const workspacePath = '/Users/me/proj';
    expect(resolveReference(workspacePath, 'test://test/a.page', '/x/y')).toBe(
      Utils.joinPath(URI.file(workspacePath), '/x/y').toString()
    );
  });

  it('routes a base-resolved root-relative ref through workspacePath (not escaping to fs root)', () => {
    // <base href="/assets/"> + relative ref: legacy resolved base FIRST (-> /assets/foo.png) then the
    // root-relative branch joined workspacePath. A base-branch early return would escape to
    // file:///assets/foo.png; this locks the workspace-anchored target.
    const workspacePath = '/ws';
    expect(resolveReference(workspacePath, 'file:///ws/pages/a.page', 'foo.png', '/assets/')).toBe(
      Utils.joinPath(URI.file(workspacePath), '/assets/foo.png').toString()
    );
  });

  it('resolves a doc-relative ref (no base, no workspacePath)', () => {
    expect(resolveReference(undefined, 'test://test/a.page', 'foo.png')).toBe('test://test/foo.png');
  });

  it('resolves against a memfs:// / web-scheme documentUri', () => {
    expect(resolveReference(undefined, 'memfs:/proj/a.page', 'sub/x.png')).toBe('memfs:/proj/sub/x.png');
    expect(resolveReference(undefined, 'vscode-vfs://host/proj/a.page', 'img.png')).toBe(
      'vscode-vfs://host/proj/img.png'
    );
  });

  it('falls back to ref-against-documentUri when base is unparseable (does not throw)', () => {
    expect(() => resolveReference(undefined, 'test://test/a.page', 'foo.png', '::bad::')).not.toThrow();
    expect(resolveReference(undefined, 'test://test/a.page', 'foo.png', '::bad::')).toBe('test://test/foo.png');
  });
});
