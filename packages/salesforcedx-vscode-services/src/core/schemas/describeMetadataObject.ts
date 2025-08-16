/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as S from 'effect/Schema';

const DescribeMetadataObjectSchema = S.Struct({
  childXmlNames: S.Array(S.String), // always present, not optional
  directoryName: S.String,
  inFolder: S.Boolean,
  metaFile: S.Boolean,
  suffix: S.optional(S.Union(S.String, S.Null)), // string | null | undefined
  xmlName: S.String
});

export type DescribeMetadataObject = S.Schema.Type<typeof DescribeMetadataObjectSchema>;
