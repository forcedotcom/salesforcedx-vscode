/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Utils, type URI } from 'vscode-uri';

/** Join baseUri with a path string (e.g. glob result). Normalizes backslashes for cross-platform. */
export const joinPathWithBase = (baseUri: URI, pathString: string): URI =>
  Utils.joinPath(baseUri, ...pathString.replaceAll('\\', '/').split('/').filter(Boolean));
