/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const ApexSourceTypeSchema = Schema.Literal('ApexClass', 'ApexTrigger');
export type ApexSourceType = typeof ApexSourceTypeSchema.Type;

export type ApexSourceToolingIdentity = {
  readonly name: string;
  readonly namespacePrefix: string | null;
};

export const apexSourceToolingIdentity = (fullName: string): ApexSourceToolingIdentity => {
  const separatorIndex = fullName.indexOf('__');
  return separatorIndex === -1
    ? { name: fullName, namespacePrefix: null }
    : { name: fullName.slice(separatorIndex + '__'.length), namespacePrefix: fullName.slice(0, separatorIndex) };
};

export const apexSourceSoqlWhere = (identity: ApexSourceToolingIdentity): string =>
  `Name = '${escapeSoql(identity.name)}' AND NamespacePrefix = ${
    identity.namespacePrefix === null ? 'null' : `'${escapeSoql(identity.namespacePrefix)}'`
  }`;

const escapeSoql = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
