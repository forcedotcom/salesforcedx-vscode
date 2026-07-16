/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { URI, Utils } from 'vscode-uri';

// Web-safe reference resolution for document links (no node path/url builtins).
// Preserves legacy `url.resolve` semantics — NOT a 1:1 WHATWG swap:
//   - base branch: legacy did `url.resolve(document.uri, url.resolve(base, ref))`, tolerating a RELATIVE
//     `<base href="docs/">`. `new URL(ref, base)` throws when base is relative, so resolve base against
//     documentUri FIRST, then ref against that. try/catch falls back to resolving ref against documentUri
//     so no input regresses vs `url.resolve` (which never throws).
//   - root-relative + workspacePath: `Utils.joinPath(URI.file(workspacePath), ref)` (was URI.file(path.join(...))).
//   - else: `new URL(ref, documentUri)` (was `url.resolve(document.uri, ref)`).
export const resolveReference = (workspacePath: string, documentUri: string, ref: string, base?: string): string => {
  if (base) {
    try {
      return new URL(ref, new URL(base, documentUri)).toString();
    } catch {
      return new URL(ref, documentUri).toString();
    }
  }
  if (workspacePath && ref.at(0) === '/') {
    return Utils.joinPath(URI.file(workspacePath), ref).toString();
  }
  return new URL(ref, documentUri).toString();
};
