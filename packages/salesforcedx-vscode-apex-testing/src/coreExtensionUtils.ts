/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { getApexTestingRuntime } from './services/extensionProvider';

type DefaultOrgInfo = { orgId?: string; username?: string };

/**
 * Gets the current default org info from Services (defaultOrgRef).
 * Has orgId/username when a connection has been established; avoids file read for cache keys.
 */
export const getDefaultOrgInfo = async (): Promise<DefaultOrgInfo> =>
  getApexTestingRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const ref = yield* api.services.TargetOrgRef();
      const current = yield* SubscriptionRef.get(ref);
      return { orgId: current.orgId, username: current.username };
    })
  );

const getConnectionData = async (): Promise<{
  accessToken: string;
  instanceUrl: string;
  apiVersion: string;
  username: string;
  orgId: string;
}> =>
  getApexTestingRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      return yield* api.services.ConnectionService.getConnectionData();
    })
  );

/**
 * Gets a Connection to the target org using the Services extension.
 * This works in both web and desktop environments.
 */
export const getConnection = async (): Promise<Connection> => {
  const data = await getConnectionData();
  const isWeb = process.env.ESBUILD_PLATFORM === 'web';
  // Mirror the services extension: desktop resolves a refreshing connection
  // from the username (auth store present); web uses the access token
  // directly (no auth store). See services connectionService.ts.
  const authInfo = isWeb
    ? await AuthInfo.create({
        accessTokenOptions: { accessToken: data.accessToken, loginUrl: data.instanceUrl, instanceUrl: data.instanceUrl }
      })
    : await AuthInfo.create({ username: data.username });
  return Connection.create({
    authInfo,
    ...(data.apiVersion ? { connectionOptions: { version: data.apiVersion } } : {})
  });
};
