/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConnectionService, InactiveOrgOperationError, type OrgId } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import { ConnectionHost } from '../connectionHost.js';
import { captureOrgContext } from '../metadataOperationOrg.js';
import { OrgChanges } from '../targetOrgRef.js';

export type CatalogOrg = { readonly orgId: OrgId; readonly orgGeneration: number };
/** Capture one committed user/org epoch; revalidate it after I/O and atomically at bounded publication. */
export const makeOrgCatalogOrg = Effect.gen(function* () {
  const connections = yield* ConnectionService;
  const changes = yield* OrgChanges;
  const host = yield* ConnectionHost;
  const changedError = (orgId: OrgId) =>
    new InactiveOrgOperationError({ expectedOrgId: orgId, message: host.messages.orgChanged(orgId) });
  const capture = Effect.fn('OrgCatalog.captureOrg')(function* (expectedOrgId?: OrgId) {
    const snapshot = yield* captureOrgContext(
      connections,
      changes,
      host,
      expectedOrgId,
      'No active org identity is available for the metadata catalog'
    );
    return { orgId: snapshot.orgId, orgGeneration: snapshot.orgGeneration };
  });
  const commit = <A, E, R>(org: CatalogOrg, program: Effect.Effect<A, E, R>) =>
    changes.commitIfCurrent(org.orgGeneration, changedError(org.orgId), program);
  return { capture, commit, validate: (org: CatalogOrg) => commit(org, Effect.void) };
});
