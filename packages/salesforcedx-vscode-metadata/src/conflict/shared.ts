/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FileProperties, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Arr from 'effect/Array';

export const getFileProperties = (result: RetrieveResult): FileProperties[] =>
  Arr.ensure(result.response.fileProperties);
