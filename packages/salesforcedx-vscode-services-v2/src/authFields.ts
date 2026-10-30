/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { OrgId } from './defaultOrgInfo.js';

/** Runtime subset of decrypted SDK auth fields, not the CLI auth-file union. */
export const AuthFields = Schema.Struct({
  orgId: Schema.OptionFromOptional(OrgId),
  username: Schema.OptionFromOptional(Schema.String),
  alias: Schema.OptionFromOptional(Schema.String),
  instanceName: Schema.OptionFromOptional(Schema.Trim),
  devHubUsername: Schema.OptionFromOptional(Schema.String),
  tracksSource: Schema.OptionFromOptional(Schema.Boolean),
  isScratch: Schema.OptionFromOptional(Schema.Boolean),
  isSandbox: Schema.OptionFromOptional(Schema.Boolean),
  orgEdition: Schema.OptionFromOptional(Schema.String),
  expirationDate: Schema.OptionFromOptional(Schema.String)
});
export type AuthInfoFields = typeof AuthFields.Encoded;

export const authFieldsFrom = Schema.decodeUnknownOption(AuthFields);
export const authFieldsFromConnection = (connection: { readonly getAuthInfoFields: () => unknown }) =>
  authFieldsFrom(connection.getAuthInfoFields());
export const orgIdFrom = (fields: unknown) => Option.flatMap(authFieldsFrom(fields), auth => auth.orgId);
export const orgIdFromConnection = (connection: { readonly getAuthInfoFields: () => unknown }) =>
  orgIdFrom(connection.getAuthInfoFields());
