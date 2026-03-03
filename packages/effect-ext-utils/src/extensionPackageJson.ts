/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** Fields from extension package.json used for channel, Sdk, o11y */
export const ExtensionPackageJsonSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  displayName: Schema.optional(Schema.String),
  o11yUploadEndpoint: Schema.optional(Schema.String)
});

export type ExtensionPackageJson = Schema.Schema.Type<typeof ExtensionPackageJsonSchema>;
