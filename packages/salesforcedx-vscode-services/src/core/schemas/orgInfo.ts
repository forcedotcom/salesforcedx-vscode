/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** Org metadata shown by the org-display commands. Mirrors the org pkg's former `types/orgInfo.ts`. */
export const OrgInfoStruct = Schema.Struct({
  username: Schema.String,
  devHubId: Schema.String,
  id: Schema.String,
  createdBy: Schema.String,
  createdDate: Schema.String,
  expirationDate: Schema.String,
  // only present for scratch orgs
  status: Schema.String,
  edition: Schema.String,
  orgName: Schema.String,
  accessToken: Schema.String,
  instanceUrl: Schema.String,
  clientId: Schema.String,
  apiVersion: Schema.String,
  aliases: Schema.Array(Schema.String),
  connectionStatus: Schema.String,
  password: Schema.optional(Schema.String),
  namespace: Schema.optional(Schema.String)
});

export type OrgInfo = typeof OrgInfoStruct.Type;
