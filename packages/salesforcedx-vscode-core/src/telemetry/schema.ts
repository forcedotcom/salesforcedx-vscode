/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionPackageJsonSchema } from '@salesforce/effect-ext-utils';
import * as Schema from 'effect/Schema';

const requiredPackageJsonString = (message: string) =>
  Schema.propertySignature(
    Schema.Unknown.pipe(
      Schema.filter((value): value is string => typeof value === 'string', { message: () => message })
    )
  ).annotations({ missingMessage: () => message });

const BooleanString = Schema.transform(
  Schema.String.pipe(Schema.pattern(/^(?:true|1|yes|on|enabled|false|0|no|off|disabled)$/i)),
  Schema.Boolean,
  {
    strict: true,
    decode: value => /^(?:true|1|yes|on|enabled)$/i.test(value),
    encode: value => (value ? 'true' : 'false')
  }
);

export const extensionPackageJsonSchema = Schema.Struct({
  ...ExtensionPackageJsonSchema.fields,
  name: requiredPackageJsonString('Extension name is not defined in package.json'),
  version: requiredPackageJsonString('Extension version is not defined in package.json'),
  aiKey: Schema.optional(Schema.String),
  // original o11y (that is, sending most events and having them end up in splunk)
  enableO11y: Schema.optional(BooleanString),
  productFeatureId: Schema.optional(Schema.String.pipe(Schema.startsWith('aJC'))),
  // Enable routing Effect spans to App Insights customEvents table via LogRecords
  enableCustomEventsFromSpans: Schema.optional(Schema.Boolean)
});
