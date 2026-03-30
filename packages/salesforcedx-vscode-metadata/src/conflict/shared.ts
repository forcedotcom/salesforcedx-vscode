/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FileProperties, RetrieveResult } from '@salesforce/source-deploy-retrieve';

export const getFileProperties = (result: RetrieveResult): FileProperties[] =>
  Array.isArray(result.response.fileProperties) ? result.response.fileProperties : [result.response.fileProperties];
