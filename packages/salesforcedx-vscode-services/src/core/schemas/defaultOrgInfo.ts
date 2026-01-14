/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const DefaultOrgInfoSchema = Schema.Struct({
  orgId: Schema.optional(Schema.String),
  devHubOrgId: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
  devHubUsername: Schema.optional(Schema.String),
  tracksSource: Schema.optional(Schema.Boolean),
  isScratch: Schema.optional(Schema.Boolean),
  isSandbox: Schema.optional(Schema.Boolean),
  // the actual userID from the salesforce org
  userId: Schema.optional(Schema.String),
  cliId: Schema.optional(Schema.String),
  webUserId: Schema.optional(Schema.String)
});
