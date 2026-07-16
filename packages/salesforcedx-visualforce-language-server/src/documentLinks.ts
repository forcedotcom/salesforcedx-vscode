/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { URI, Utils } from 'vscode-uri';

// Web-safe reference resolution for document links (no node path/url builtins).
// Preserves legacy `url.resolve` control flow — NOT a 1:1 WHATWG swap. Legacy was sequential:
// `if (base) ref = url.resolve(base, ref)`, THEN the root-relative + workspacePath check on the
// (possibly base-resolved) ref, THEN the final `url.resolve(document.uri, ref)`. Faithful port:
//   - resolve base+ref FIRST, keeping any root-relative shape so it can still reach the workspacePath
//     branch (a base-resolved root-relative ref like `<base href="/assets/">` + `foo.png` must join
//     workspacePath, not escape to `file:///assets/...`).
//   - root-relative (after base) + workspacePath: `Utils.joinPath(URI.file(workspacePath), ref)`
//     (was `URI.file(path.join(workspacePath, ref))`).
//   - else: `new URL(ref, documentUri)` (was `url.resolve(document.uri, ref)`), with base folded in via
//     the two-step `new URL(ref, new URL(base, documentUri))` since `new URL(ref, base)` throws on a
//     RELATIVE `<base href="docs/">`; try/catch falls back to resolving ref against documentUri so no
//     input regresses vs `url.resolve` (which never throws).
const SENTINEL_BASE = 'https://web-safe.invalid/';

const isAbsoluteUrl = (value: string): boolean => URL.canParse(value);

// Root-relative result of legacy `url.resolve(base, ref)`, else undefined. Root-relative iff ref is not
// absolute, base is not absolute, and (ref or base) starts with '/'.
const rootRelativeAfterBase = (ref: string, base?: string): string | undefined =>
  isAbsoluteUrl(ref) || (base && isAbsoluteUrl(base))
    ? undefined
    : ref.at(0) === '/'
      ? ref
      : base?.at(0) === '/'
        ? new URL(ref, new URL(base, SENTINEL_BASE)).pathname
        : undefined;

export const resolveReference = (workspacePath: string, documentUri: string, ref: string, base?: string): string => {
  const rootRelative = rootRelativeAfterBase(ref, base);
  if (rootRelative !== undefined) {
    return workspacePath
      ? Utils.joinPath(URI.file(workspacePath), rootRelative).toString()
      : new URL(rootRelative, documentUri).toString();
  }
  if (base) {
    try {
      return new URL(ref, new URL(base, documentUri)).toString();
    } catch {
      return new URL(ref, documentUri).toString();
    }
  }
  return new URL(ref, documentUri).toString();
};
