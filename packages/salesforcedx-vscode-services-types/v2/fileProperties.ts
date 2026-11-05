/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Equivalence from 'effect/Equivalence';
import * as Schema from 'effect/Schema';

/** SDK wire fields are strings; canonical Salesforce ID validation does not apply here. */
export const FilePropertiesSchema = Schema.Struct({
  fullName: Schema.String,
  type: Schema.String,
  id: Schema.optional(Schema.String),
  createdById: Schema.optional(Schema.String),
  createdByName: Schema.optional(Schema.String),
  createdDate: Schema.optional(Schema.String),
  fileName: Schema.optional(Schema.String),
  lastModifiedById: Schema.optional(Schema.String),
  lastModifiedByName: Schema.optional(Schema.String),
  lastModifiedDate: Schema.optional(Schema.String),
  manageableState: Schema.optional(Schema.String),
  namespacePrefix: Schema.optional(Schema.String)
});
export const FilePropertiesByFullName = Equivalence.mapInput(
  Equivalence.String,
  (value: typeof FilePropertiesSchema.Type) => value.fullName
);
