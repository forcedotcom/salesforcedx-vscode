/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';

export const SalesforceId = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/)),
  Schema.brand('@services/SalesforceId')
);
export type SalesforceId = typeof SalesforceId.Type;

export const OrgId = SalesforceId.pipe(Schema.check(Schema.isPattern(/^00D/)), Schema.brand('@services/OrgId'));
export type OrgId = typeof OrgId.Type;

export const CliId = Schema.String.pipe(Schema.check(Schema.isUUID()), Schema.brand('@services/CliId'));
export type CliId = typeof CliId.Type;

const OptionalString = Schema.String.pipe(Schema.optional);
const OptionalOrgId = OrgId.pipe(Schema.optional);
const OptionalBoolean = Schema.Boolean.pipe(Schema.optional);

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
  // Preserve the legacy String wire contract; adding ID validation is not a V4 API migration.
  userId: OptionalString,
  cliId: Schema.optional(CliId),
  webUserId: OptionalString,
  orgEdition: OptionalString
});
export type DefaultOrgInfo = typeof DefaultOrgInfoSchema.Type;
