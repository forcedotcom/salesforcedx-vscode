/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Equivalence from 'effect/Equivalence';
import * as S from 'effect/Schema';

/** Schema for FileProperties (metadata.list result) */
export const FilePropertiesSchema = S.Struct({
  fullName: S.String,
  type: S.String,
  id: S.optional(S.String),
  createdById: S.optional(S.String),
  createdByName: S.optional(S.String),
  createdDate: S.optional(S.String),
  fileName: S.optional(S.String),
  lastModifiedById: S.optional(S.String),
  lastModifiedByName: S.optional(S.String),
  lastModifiedDate: S.optional(S.String),
  manageableState: S.optional(S.String),
  namespacePrefix: S.optional(S.String)
});

/** Equivalence for FileProperties keyed on fullName — for deduping listMetadata results. */
export const FilePropertiesByFullName = Equivalence.mapInput(
  Equivalence.string,
  (fp: S.Schema.Type<typeof FilePropertiesSchema>) => fp.fullName
);
