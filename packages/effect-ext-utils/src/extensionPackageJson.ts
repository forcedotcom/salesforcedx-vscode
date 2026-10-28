/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** Fields from extension package.json used for channel, Sdk, o11y */
export const ExtensionPackageJsonSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  publisher: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  displayName: Schema.optional(Schema.String),
  aiKey: Schema.optional(Schema.String),
  enableO11y: Schema.optional(Schema.Union(Schema.String, Schema.Boolean)),
  o11yUploadEndpoint: Schema.optional(Schema.String),
  otelConnectionString: Schema.optional(Schema.String),
  productFeatureId: Schema.optional(Schema.String),
  enableCustomEventsFromSpans: Schema.optional(Schema.Boolean)
});

export type ExtensionPackageJson = Schema.Schema.Type<typeof ExtensionPackageJsonSchema>;
