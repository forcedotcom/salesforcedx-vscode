/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthFields, AuthInfo, Connection, Org } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { AliasService } from './alias';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { OrgInfo } from './schemas/orgInfo';
import { getOrgFromConnection } from './shared';

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

export class NoUsernameError extends Schema.TaggedError<NoUsernameError>()('NoUsernameError', {
  message: Schema.String
}) {}

/**
 * Connection/query to the resolved org failed. Carries the resolved username plus a status message
 * so the table can render a degraded OrgInfo.
 */
export class OrgInfoConnectionError extends Schema.TaggedError<OrgInfoConnectionError>()('OrgInfoConnectionError', {
  username: Schema.String,
  message: Schema.String
}) {}

/** Check if org should be removed based on error. Ported from org pkg `util/orgUtil.ts`. */
const shouldRemoveOrg = (err: unknown): boolean => {
  const lowerMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return ['invalid_login', 'no such org', 'namedorgnotfound', 'noauthinfofound'].some(msg => lowerMsg.includes(msg));
};

/** Map a caught error to a human connection status. Ported from org pkg `util/orgUtil.ts`. */
const getConnectionStatusFromError = (err: unknown, username?: string): string => {
  const message = err instanceof Error ? err.message : String(err);
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('maintenance')) return 'Down (Maintenance)';
  if (lowerMsg.includes('<html>') || lowerMsg.includes('<!doctype html>')) return 'Bad Response';
  if (
    ['expired access/refresh token', 'invalid_session_id', 'bad_oauth_token', 'refreshtokenautherror'].some(token =>
      lowerMsg.includes(token)
    )
  ) {
    return 'Unable to refresh session: expired access/refresh token';
  }
  if (shouldRemoveOrg(err)) {
    return username ? `Invalid org: ${username}` : 'Invalid org';
  }

  return message;
};

/** Build the typed connection failure from a caught (unknown) error. */
const connectionError = (username: string, error: unknown): OrgInfoConnectionError =>
  new OrgInfoConnectionError({ username, message: getConnectionStatusFromError(error, username) });

const getEdition = (orgQuery: OrgQueryResult): string =>
  Match.value(orgQuery).pipe(
    Match.when({ IsSandbox: true }, () => 'Sandbox'),
    Match.when({ OrganizationType: 'Enterprise' }, () => 'Enterprise'),
    Match.when({ OrganizationType: 'Professional' }, () => 'Professional'),
    Match.orElse(() => 'Developer')
  );

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

export class OrgInfoService extends Effect.Service<OrgInfoService>()('OrgInfoService', {
  accessors: true,
  dependencies: [ConnectionService.Default, AliasService.Default, ConfigService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const aliasService = yield* AliasService;
    const configService = yield* ConfigService;

    const getAllAliases = Effect.fn('OrgInfoService.getAllAliases')(function* (username: string) {
      const orgs = yield* aliasService.getAllAliases();
      return Object.entries(orgs)
        .filter(([, u]) => u === username)
        .map(([alias]) => alias);
    });

    /** Test connection to determine status */
    const getConnectionStatus = Effect.fn('OrgInfoService.getConnectionStatus')(function* (
      conn: Connection,
      username: string
    ) {
      return yield* Effect.tryPromise({
        try: () => conn.identity(),
        catch: error => getConnectionStatusFromError(error, username)
      }).pipe(Effect.match({ onSuccess: () => 'Connected', onFailure: status => status }));
    });

    const queryScratchOrg = Effect.fn('OrgInfoService.queryScratchOrg')(function* (org: Org, orgId: string) {
      return yield* Effect.tryPromise({
        try: async () => {
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
        },
        catch: error => connectionError(orgId, error)
      }).pipe(Effect.orElseSucceed(() => undefined));
    });

    /** Derive OrgInfo from an established connection. Shared by the default-org and per-username paths. */
    const getOrgInfoFromConnectionCore = Effect.fn('OrgInfoService.getOrgInfoFromConnectionCore')(function* (
      conn: Connection,
      username: string
    ) {
      const authInfo = conn.getAuthInfo();
      const authFields = authInfo.getFields(true);
      const aliases = yield* getAllAliases(username);

      // Check if this is a scratch org
      const isScratchOrg = Boolean(authFields.devHubUsername);

      // Get organization details via SOQL
      const orgQuery = yield* Effect.tryPromise({
        try: () =>
          conn.singleRecordQuery<OrgQueryResult>(
            'SELECT Id, Name, CreatedDate, CreatedBy.Username, OrganizationType, InstanceName, NamespacePrefix, IsSandbox FROM Organization'
          ),
        catch: error => connectionError(username, error)
      });

      const scratchOrgQuery =
        isScratchOrg && authFields.orgId
          ? yield* getOrgFromConnection(conn).pipe(
              Effect.mapError(e => connectionError(username, e.cause)),
              Effect.flatMap(org => queryScratchOrg(org, authFields.orgId!))
            )
          : undefined;
      const connectionStatus = yield* getConnectionStatus(conn, username);

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

    /** Build OrgInfo with error/connection status when the connection fails (graceful degradation). */
    const buildErrorOrgInfo = Effect.fn('OrgInfoService.buildErrorOrgInfo')(function* (
      username: string,
      connectionStatus: string
    ) {
      // Try to get basic auth info without creating a connection
      return yield* Effect.tryPromise({
        try: () => AuthInfo.create({ username }),
        catch: error => connectionError(username, error)
      }).pipe(
        Effect.flatMap(authInfo =>
          getAllAliases(username).pipe(
            Effect.map(aliases => createOrgInfo(username, authInfo.getFields(true), aliases, connectionStatus))
          )
        ),
        // If we can't even get auth info, use minimal info with error status
        Effect.orElseSucceed(() => createOrgInfo(username, undefined, [], connectionStatus))
      );
    });

    /** Resolve username from provided username or project config, then alias-resolve it. */
    const resolveUsername = Effect.fn('OrgInfoService.resolveUsername')(function* (username?: string) {
      const fromConfig = username ? undefined : yield* configService.getTargetOrg();
      const usernameOrAlias = username ?? fromConfig;

      if (!usernameOrAlias) {
        return yield* new NoUsernameError({
          message: 'No username provided and no default username found in project config or state'
        });
      }

      return yield* aliasService
        .getUsernameFromAlias(usernameOrAlias)
        .pipe(Effect.map(Option.getOrElse(() => usernameOrAlias)));
    });

    /**
     * Resolve `username` (or the project default) to an org, get a per-username `Connection`, and
     * derive `OrgInfo`. Connection creation/query failures (and web unsupported) degrade to an
     * error-status table rather than crashing org-display.
     */
    const getOrgInfoForUsername = Effect.fn('OrgInfoService.getOrgInfoForUsername')(function* (username?: string) {
      const resolvedUsername = yield* resolveUsername(username);

      return yield* connectionService.getConnectionForUsername(resolvedUsername).pipe(
        Effect.flatMap(conn => getOrgInfoFromConnectionCore(conn, resolvedUsername)),
        Effect.catchTags({
          OrgInfoConnectionError: err => buildErrorOrgInfo(err.username, err.message),
          // web has no username→connection path; degrade gracefully instead of a fromKey mis-parse
          UsernameConnectionNotSupportedOnWebError: err => buildErrorOrgInfo(resolvedUsername, err.message),
          FailedToCreateAuthInfoError: err =>
            buildErrorOrgInfo(resolvedUsername, getConnectionStatusFromError(err.cause, resolvedUsername)),
          FailedToCreateConnectionError: err =>
            buildErrorOrgInfo(resolvedUsername, getConnectionStatusFromError(err.cause, resolvedUsername))
        })
      );
    });

    /**
     * Derive `OrgInfo` from an already-established default-org `Connection` (from
     * `ConnectionService.getConnection()` — carries its own username). Connection/query failures
     * degrade to an error-status table identically to {@link getOrgInfoForUsername}.
     */
    const getOrgInfoFromConnection = Effect.fn('OrgInfoService.getOrgInfoFromConnection')(function* (conn: Connection) {
      const authInfo = conn.getAuthInfo();
      const username = conn.getUsername() ?? authInfo.getFields(true).username;
      if (!username) {
        return yield* new NoUsernameError({
          message: 'No username provided and no default username found in project config or state'
        });
      }

      return yield* getOrgInfoFromConnectionCore(conn, username).pipe(
        Effect.catchTag('OrgInfoConnectionError', err => buildErrorOrgInfo(err.username, err.message))
      );
    });

    return { getOrgInfoForUsername, getOrgInfoFromConnection };
  })
}) {}
