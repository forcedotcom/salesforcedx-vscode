/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataReference } from './orgMetadataReference';
import * as Data from 'effect/Data';

export class OrgMetadataCatalogError extends Data.TaggedError('OrgMetadataCatalogError')<{
  readonly cause: Error;
  readonly message: string;
  readonly reference?: OrgMetadataReference;
}> {}
