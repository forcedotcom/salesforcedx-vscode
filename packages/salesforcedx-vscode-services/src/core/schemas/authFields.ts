/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { OrgId } from './salesforceId';

const optional = <S extends Schema.Schema.Any>(schema: S) => Schema.optionalWith(schema, { as: 'Option' });

/**
 * Runtime subset of `Connection.getAuthInfoFields()` / `AuthInfo.getFields()`.
 * Not the CLI auth-file union — `@salesforce/core` decrypts those before they reach us.
 */
export const AuthFields = Schema.Struct({
  orgId: optional(OrgId),
  username: optional(Schema.String),
  instanceName: optional(Schema.Trim),
  devHubUsername: optional(Schema.String),
  tracksSource: optional(Schema.Boolean),
  isScratch: optional(Schema.Boolean),
  isSandbox: optional(Schema.Boolean),
  orgEdition: optional(Schema.String)
});
export type AuthFields = typeof AuthFields.Type;

export const authFieldsFrom = (fields: unknown): Option.Option<AuthFields> =>
  Schema.decodeUnknownOption(AuthFields)(fields);

export const authFieldsFromConnection = (connection: {
  readonly getAuthInfoFields: () => unknown;
}): Option.Option<AuthFields> => authFieldsFrom(connection.getAuthInfoFields());

export const orgIdFromConnection = (connection: { readonly getAuthInfoFields: () => unknown }): Option.Option<OrgId> =>
  Option.flatMap(authFieldsFromConnection(connection), fields => fields.orgId);
