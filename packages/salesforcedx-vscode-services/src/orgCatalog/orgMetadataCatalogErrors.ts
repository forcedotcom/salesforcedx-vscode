/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { OrgMetadataReference } from './orgMetadataReference';

export class OrgMetadataCatalogError extends Schema.TaggedError<OrgMetadataCatalogError>()('OrgMetadataCatalogError', {
  cause: Schema.instanceOf(Error),
  message: Schema.String,
  reference: Schema.optional(OrgMetadataReference)
}) {}
