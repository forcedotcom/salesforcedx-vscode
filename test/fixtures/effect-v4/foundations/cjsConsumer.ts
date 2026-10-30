/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { comparisonPath, pathSuffixWithin } from '@salesforce/vscode-services-v2/uriComparison';
import type { URI } from 'vscode-uri';

export const compare = (root: URI, child: URI) => ({
  root: comparisonPath(root), suffix: pathSuffixWithin(root, child)
});
