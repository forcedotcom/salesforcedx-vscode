/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionPackageJsonSchema } from '@salesforce/effect-ext-utils';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';

const requiredPackageJsonString = (message: string) => Schema.String.annotate({ message });

const BooleanString = Schema.String.check(
  Schema.isPattern(/^(?:true|1|yes|on|enabled|false|0|no|off|disabled)$/i)
).pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transform(value => /^(?:true|1|yes|on|enabled)$/i.test(value)),
    encode: SchemaGetter.transform(value => (value ? 'true' : 'false'))
  })
);

export const extensionPackageJsonSchema = Schema.Struct({
  ...ExtensionPackageJsonSchema.fields,
  name: requiredPackageJsonString('Extension name is not defined in package.json'),
  version: requiredPackageJsonString('Extension version is not defined in package.json'),
  // original o11y (that is, sending most events and having them end up in splunk)
  enableO11y: Schema.optional(BooleanString),
  productFeatureId: Schema.optional(Schema.String.check(Schema.isPattern(/^aJC/)))
});
