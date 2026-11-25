/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { ConnectionService } from 'salesforcedx-vscode-services/src/core/connectionService';
import { SettingsService } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import { URI } from 'vscode-uri';
import { resolveRunInputs } from '../../../src/commands/apexTestRunUtils';

describe('resolveRunInputs', () => {
  it('resolves the default org identity before resolving the org-scoped output directory', async () => {
    const targetOrgRef = await Effect.runPromise(
      SubscriptionRef.make<{ readonly orgId?: string; readonly username?: string }>({ username: 'user@example.com' })
    );
    const connection = { getAuthInfoFields: () => ({ orgId: '00D000000000001' }) };
    const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed({
        services: {
          SettingsService: Effect.succeed({ getValueOrElse: () => Effect.succeed(false) }),
          ConnectionService: {
            getConnection: () =>
              SubscriptionRef.set(targetOrgRef, { orgId: '00D000000000001', username: 'user@example.com' }).pipe(
                Effect.as(connection)
              )
          }
        }
      })
    } as unknown as ExtensionProviderService);
    const connectionLayer = Layer.succeed(ConnectionService, {
      getConnection: () =>
        SubscriptionRef.set(targetOrgRef, { orgId: '00D000000000001', username: 'user@example.com' }).pipe(
          Effect.as(connection)
        )
    } as unknown as InstanceType<typeof ConnectionService>);
    const settingsLayer = Layer.succeed(SettingsService, {
      getValueOrElse: () => Effect.succeed(false)
    } as unknown as InstanceType<typeof SettingsService>);

    const outputDir = Effect.gen(function* () {
      const { orgId } = yield* SubscriptionRef.get(targetOrgRef);
      return URI.file(`/tmp/${orgId}`);
    });

    const result = await Effect.runPromise(
      resolveRunInputs(async () => ({}) as never, outputDir).pipe(
        Effect.provide(Layer.mergeAll(extensionProviderLayer, connectionLayer, settingsLayer))
      )
    );

    expect(result.outputDir.path).toBe('/tmp/00D000000000001');
  });
});
