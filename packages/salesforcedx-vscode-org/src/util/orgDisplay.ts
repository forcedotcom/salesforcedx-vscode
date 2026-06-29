/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthFields, AuthInfo, Connection, Org, OrgConfigProperties } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { getOrgRuntime } from '../extensionProvider';
import { OrgInfo } from '../types/orgInfo';
import { getConfigAggregatorEffect } from './configAggregatorEffect';
import {
  getConnectionStatusFromError,
  readAliasesByUsernameFromDiskEffect,
  resolveUsernameFromAliasEffect
} from './orgUtil';

type OrgQueryResult = {
  Id: string;
  Name: string;
  CreatedDate: string;
  CreatedBy: { Username: string };
  OrganizationType: string;
  InstanceName: string;
  IsSandbox: boolean;
  NamespacePrefix: string;
};

type ScratchOrgQueryResult = {
  Status: string;
  CreatedBy: { Username: string };
  CreatedDate: string;
  ExpirationDate: string;
  Edition: string;
  OrgName: string;
};

const messages = {
  no_username_provided: 'No username provided and no default username found in project config or state'
};

/**
 * No username was supplied and none could be resolved from project config/state.
 * @ExportTaggedError
 */
export class NoUsernameError extends Schema.TaggedError<NoUsernameError>()('NoUsernameError', {
  message: Schema.String
}) {}

/**
 * Connection/query to the resolved org failed. Carries the resolved username plus a string `cause`
 * derived from the caught error (never `any`) so the table can render a degraded OrgInfo.
 * @ExportTaggedError
 */
export class OrgInfoConnectionError extends Schema.TaggedError<OrgInfoConnectionError>()('OrgInfoConnectionError', {
  username: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String)
}) {}

/** Resolve username from provided username or project config. */
const resolveUsernameEffect = Effect.fn('orgDisplay.resolveUsername')(function* (username?: string) {
  const fromConfig = username
    ? undefined
    : (yield* getConfigAggregatorEffect).getPropertyValue<string>(OrgConfigProperties.TARGET_ORG);
  const usernameOrAlias = username ?? (typeof fromConfig === 'string' ? fromConfig : undefined);

  if (!usernameOrAlias) {
    return yield* new NoUsernameError({ message: messages.no_username_provided });
  }

  return yield* resolveUsernameFromAliasEffect(usernameOrAlias);
});

const getOrgInfoEffect = Effect.fn('orgDisplay.getOrgInfo')(function* (username?: string) {
  const resolvedUsername = yield* resolveUsernameEffect(username);

  return yield* Effect.tryPromise({
    try: async () => {
      const authInfo = await AuthInfo.create({ username: resolvedUsername });
      const connection = await Connection.create({ authInfo });
      const org = await Org.create({ connection });
      return { authInfo, connection, org };
    },
    catch: error =>
      new OrgInfoConnectionError({
        username: resolvedUsername,
        message: getConnectionStatusFromError(error, resolvedUsername),
        cause: error instanceof Error ? error.message : String(error)
      })
  }).pipe(
    Effect.flatMap(({ authInfo, connection, org }) =>
      getOrgInfoFromConnectionEffect(org, connection, authInfo, resolvedUsername)
    ),
    // graceful degradation: still render a populated OrgInfo with error/connection status for
    // offline/expired orgs. The failure stays typed up to this catch point (no untyped die).
    Effect.catchTag('OrgInfoConnectionError', err => buildErrorOrgInfoEffect(err.username, err.message))
  );
});

/** Promise wrapper for {@link getOrgInfoEffect}, used by the legacy `sf.org.display.default` executor. */
export const getOrgInfo = async (username?: string): Promise<OrgInfo> =>
  getOrgRuntime().runPromise(getOrgInfoEffect(username));

/** Create OrgInfo object with common fields and fallback values full of empty strings */
const createOrgInfo = (
  username: string,
  authFields: AuthFields | undefined,
  aliases: string[],
  connectionStatus: string,
  overrides: Partial<OrgInfo> = {}
): OrgInfo => ({
  username,
  devHubId: authFields?.devHubUsername ?? '',
  id: authFields?.orgId ?? '',
  createdBy: '',
  createdDate: '',
  expirationDate: authFields?.expirationDate ?? '',
  edition: '',
  orgName: '',
  accessToken: authFields?.accessToken ?? '',
  instanceUrl: authFields?.instanceUrl ?? '',
  clientId: authFields?.clientId ?? '',
  apiVersion: authFields?.instanceApiVersion ?? '',
  aliases,
  connectionStatus,
  password: '',
  status: connectionStatus,
  ...overrides
});

/** Get org info from an established connection */
const getOrgInfoFromConnectionEffect = Effect.fn('orgDisplay.getOrgInfoFromConnection')(function* (
  org: Org,
  connection: Connection,
  authInfo: AuthInfo,
  username: string
) {
  const authFields = authInfo.getFields(true);
  const aliases = yield* getAllAliasesEffect(username);

  // Check if this is a scratch org
  const isScratchOrg = Boolean(authFields.devHubUsername);

  // Get organization details via SOQL
  const orgQuery = yield* Effect.tryPromise({
    try: () =>
      connection.singleRecordQuery<OrgQueryResult>(
        'SELECT Id, Name, CreatedDate, CreatedBy.Username, OrganizationType, InstanceName, NamespacePrefix, IsSandbox FROM Organization'
      ),
    catch: error =>
      new OrgInfoConnectionError({
        username,
        message: getConnectionStatusFromError(error, username),
        cause: error instanceof Error ? error.message : String(error)
      })
  });

  const scratchOrgQuery =
    isScratchOrg && authFields.orgId ? yield* queryScratchOrgEffect(org, authFields.orgId) : undefined;
  const connectionStatus = yield* getConnectionStatusEffect(connection, username);

  // scratch org query results, when present, are preferred over org query results
  return createOrgInfo(username, authFields, aliases, connectionStatus, {
    id: authFields.orgId ?? orgQuery.Id,
    createdBy: scratchOrgQuery?.CreatedBy.Username ?? orgQuery.CreatedBy.Username,
    createdDate: scratchOrgQuery?.CreatedDate ?? orgQuery.CreatedDate,
    expirationDate: scratchOrgQuery?.ExpirationDate ?? authFields.expirationDate ?? '',
    edition: scratchOrgQuery?.Edition ?? getEdition(orgQuery),
    orgName: scratchOrgQuery?.OrgName ?? orgQuery.Name,
    ...(authFields.password ? { password: authFields.password } : {}),
    status: scratchOrgQuery?.Status ?? connectionStatus
  });
});

const getEdition = (orgQuery: OrgQueryResult): string => {
  if (orgQuery.IsSandbox) {
    return 'Sandbox';
  } else if (orgQuery.OrganizationType === 'Enterprise') {
    return 'Enterprise';
  } else if (orgQuery.OrganizationType === 'Professional') {
    return 'Professional';
  }
  return 'Developer';
};

const queryScratchOrgEffect = Effect.fn('orgDisplay.queryScratchOrg')(function* (org: Org, orgId: string) {
  return yield* Effect.tryPromise(async () => {
    const hubOrg = await org.getDevHubOrg();
    if (!hubOrg) {
      return undefined;
    }
    const hubConnection = hubOrg.getConnection();
    // Query the dev hub for scratch org information
    return await hubConnection.singleRecordQuery<ScratchOrgQueryResult>(
      `SELECT Status, CreatedBy.Username, CreatedDate, ExpirationDate, Edition, OrgName FROM ScratchOrgInfo WHERE ScratchOrg = '${orgId.substring(
        0,
        15
      )}'`
    );
  }).pipe(Effect.orElseSucceed(() => undefined));
});

/** Build OrgInfo with error/connection status when the connection fails (graceful degradation). */
const buildErrorOrgInfoEffect = Effect.fn('orgDisplay.buildErrorOrgInfo')(function* (
  username: string,
  connectionStatus: string
) {
  // Try to get basic auth info without creating a connection
  return yield* Effect.tryPromise(() => AuthInfo.create({ username })).pipe(
    Effect.flatMap(authInfo =>
      getAllAliasesEffect(username).pipe(
        Effect.map(aliases => createOrgInfo(username, authInfo.getFields(true), aliases, connectionStatus))
      )
    ),
    // If we can't even get auth info, use minimal info with error status
    Effect.orElseSucceed(() => createOrgInfo(username, undefined, [], connectionStatus))
  );
});

const getAllAliasesEffect = Effect.fn('orgDisplay.getAllAliases')(function* (username: string) {
  return (yield* readAliasesByUsernameFromDiskEffect()).get(username) ?? [];
});

/** Test connection to determine status */
const getConnectionStatusEffect = Effect.fn('orgDisplay.getConnectionStatus')(function* (
  conn: Connection,
  username: string
) {
  return yield* Effect.tryPromise({
    try: () => conn.identity(),
    catch: error => getConnectionStatusFromError(error, username)
  }).pipe(
    Effect.as('Connected'),
    Effect.catchAll(status => Effect.succeed(status))
  );
});
