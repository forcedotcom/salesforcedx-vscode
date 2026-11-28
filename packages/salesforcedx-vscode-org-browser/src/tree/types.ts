/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import type { FilePropertiesSchema, MetadataTypeDescription } from '@salesforce/vscode-services/v2';
import type * as S from 'effect/Schema';

export type MetadataDescribeResultItem = MetadataTypeDescription;
export type CustomObjectField = Connection['sobject'] extends (name: string) => infer SObject
  ? SObject extends { describe: () => Promise<infer Desc> }
    ? Desc extends { fields: (infer F)[] }
      ? F
      : never
    : never
  : never;
export type MetadataListResultItem = S.Schema.Type<typeof FilePropertiesSchema>;
