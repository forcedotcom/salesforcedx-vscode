/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';

export const getPathWithSchema = (uri: URI): string => (uri.scheme === 'file' ? uri.fsPath : uri.toString());

// use this for cross-platform compatibility (windows, mac, browser)
export const uriToPath = (uri: URI): string => (uri.scheme === 'file' ? uri.fsPath : uri.path);
