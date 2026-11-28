/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';

const SalesforceId = Schema.String.pipe(
  Schema.pattern(/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/),
  Schema.brand('@services/SalesforceId')
);
const OrgId = SalesforceId.pipe(Schema.startsWith('00D'), Schema.brand('@services/OrgId'));
const CliId = Schema.UUID.pipe(Schema.brand('@services/CliId'));
const OptionalString = Schema.optional(Schema.String);
const OptionalOrgId = Schema.optional(OrgId);
const OptionalBoolean = Schema.optional(Schema.Boolean);

export const DefaultOrgInfoSchema = Schema.Struct({
  aliases: Schema.String.pipe(Schema.Array, Schema.optional),
  orgId: OptionalOrgId,
  instanceName: OptionalString,
  devHubOrgId: OptionalOrgId,
  username: OptionalString,
  alias: OptionalString,
  devHubUsername: OptionalString,
  tracksSource: OptionalBoolean,
  isScratch: OptionalBoolean,
  isSandbox: OptionalBoolean,
  // Preserve the legacy String wire contract; do not introduce stricter ID validation.
  userId: OptionalString,
  cliId: Schema.optional(CliId),
  webUserId: OptionalString,
  orgEdition: OptionalString
});
export type DefaultOrgInfo = typeof DefaultOrgInfoSchema.Type;
