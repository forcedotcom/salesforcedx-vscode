/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import {
  ConnectionService,
  InactiveOrgOperationError,
  NoTargetOrgConfiguredError,
  authFieldsFromConnection,
  orgIdFromConnection,
  type ConnectionError,
  type OrgId
} from '@salesforce/vscode-services-v2';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { ConnectionHost } from './connectionHost.js';
import { OrgChanges } from './targetOrgRef.js';

export type MetadataOperationOrgSnapshot = {
  readonly connection: Connection;
  readonly orgId: OrgId;
  readonly orgGeneration: Effect.Success<OrgChanges['Service']['snapshot']>['orgGeneration'];
  readonly tracksSource: Effect.Success<OrgChanges['Service']['snapshot']>['org']['tracksSource'];
};

const makeMetadataOperationOrg = Effect.gen(function* () {
  const connections = yield* ConnectionService;
  const changes = yield* OrgChanges;
  const host = yield* ConnectionHost;
  const changedError = (orgId: OrgId) =>
    new InactiveOrgOperationError({ expectedOrgId: orgId, message: host.messages.orgChanged(orgId) });
  const capture = Effect.fn('MetadataOperationOrg.capture')(function* (
    expectedOrgId?: OrgId
  ): Effect.fn.Return<MetadataOperationOrgSnapshot, ConnectionError | InactiveOrgOperationError> {
    const connection: Connection = yield* expectedOrgId
      ? connections.getConnectionForOrg(expectedOrgId)
      : connections.getConnection();
    const orgId = expectedOrgId ?? Option.getOrUndefined(orgIdFromConnection(connection));
    if (!orgId)
      return yield* new NoTargetOrgConfiguredError({ message: 'No active org identity is available for metadata' });
    const snapshot = yield* changes.snapshot;
    const username =
      connection.getUsername() ??
      Option.getOrUndefined(Option.flatMap(authFieldsFromConnection(connection), fields => fields.username));
    if (snapshot.org.orgId !== orgId || snapshot.org.username?.toLowerCase() !== username?.toLowerCase())
      return yield* changedError(orgId);
    return { connection, orgId, orgGeneration: snapshot.orgGeneration, tracksSource: snapshot.org.tracksSource };
  });
  const validate = Effect.fn('MetadataOperationOrg.validate')(
    (org: Pick<Effect.Success<ReturnType<typeof capture>>, 'orgId' | 'orgGeneration'>) =>
      changes.commitIfCurrent(org.orgGeneration, changedError(org.orgId), Effect.void)
  );
  return { capture, validate };
});

/** Reads the existing org writer once for an operation; owns no independent org state or cache. */
export class MetadataOperationOrg extends Context.Service<
  MetadataOperationOrg,
  Effect.Success<typeof makeMetadataOperationOrg>
>()('@salesforce/vscode-services-v4-implementation/MetadataOperationOrg') {}
export const MetadataOperationOrgLayer = Layer.effect(MetadataOperationOrg, makeMetadataOperationOrg);
