/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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

export type FileProperties = S.Schema.Type<typeof FilePropertiesSchema>;
