/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SourceTracking } from '@salesforce/source-tracking';
import { ShadowRepo } from '@salesforce/source-tracking/lib/shared/local/localShadowRepo.js';
import { RemoteSourceTrackingService } from '@salesforce/source-tracking/lib/shared/remote/remoteSourceTrackingService.js';
// Match the SDK's native singleton key, including drive/trailing-slash normalization.
import { normalize } from 'node:path';

const instances = (constructor: object): Map<unknown, unknown> | undefined => {
  const value: unknown = Reflect.get(constructor, 'instanceMap');
  return value instanceof Map ? value : undefined;
};
const remoteService = (value: unknown): unknown =>
  typeof value === 'object' && value !== null && 'service' in value ? value.service : undefined;

/** Only evict entries acquired by this instance; never delete tracking files or a replacement owned elsewhere. */
export const trackingCacheOwnership = (tracking: SourceTracking, orgId: string) => {
  const projectPath = normalize(tracking.projectPath);
  const localInstances = instances(ShadowRepo);
  const remoteInstances = instances(RemoteSourceTrackingService);
  let ownedLocal: unknown;
  let ownedRemote: unknown;
  return {
    run: <A>(run: () => Promise<A>, caches: 'local' | 'remote' | 'both'): Promise<A> => {
      // Snapshot immediately before entering the SDK, not at lazy SourceTracking.create().
      // Its synchronous getInstance cache check occurs before the first await; no wrapper yield intervenes.
      const previousLocal = localInstances?.get(projectPath);
      const previousRemote = remoteService(remoteInstances?.get(orgId));
      const hadLocal: unknown = Reflect.get(tracking, 'localRepo');
      const hadRemote: unknown = Reflect.get(tracking, 'remoteSourceTrackingService');
      return run().finally(() => {
        const local: unknown = Reflect.get(tracking, 'localRepo');
        const remote: unknown = Reflect.get(tracking, 'remoteSourceTrackingService');
        if (caches !== 'remote' && hadLocal === undefined && previousLocal === undefined && local instanceof ShadowRepo)
          ownedLocal = local;
        if (
          caches !== 'local' &&
          hadRemote === undefined &&
          previousRemote === undefined &&
          remote instanceof RemoteSourceTrackingService
        )
          ownedRemote = remote;
      });
    },
    release: () => {
      if (ownedLocal instanceof ShadowRepo && localInstances?.get(projectPath) === ownedLocal)
        localInstances.delete(projectPath);
      if (
        ownedRemote instanceof RemoteSourceTrackingService &&
        remoteService(remoteInstances?.get(orgId)) === ownedRemote
      )
        remoteInstances?.delete(orgId);
    }
  };
};
