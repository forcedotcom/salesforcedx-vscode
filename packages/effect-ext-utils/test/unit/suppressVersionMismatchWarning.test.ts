/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ChannelService,
  ExtensionContextService,
  type SalesforceVSCodeServicesApiV2
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { buildAllServicesLayer } from '../../src/allServicesLayer';

it('builds the V2 extension layer and preserves caller warning logs without V3 logger controls', async () => {
  const messages: string[] = [];
  const logs = Logger.layer([
    Logger.make(({ message }) => {
      messages.push(String(message));
    })
  ]);
  const channel = Layer.succeed(
    ChannelService,
    ChannelService.of({
      getChannel: Effect.succeed({} as vscode.OutputChannel),
      showChannel: Effect.void,
      clearChannel: Effect.void,
      appendToChannel: () => Effect.void
    })
  );
  const channelLayer = (displayName: string) => {
    expect(displayName).toBe('Caller Extension');
    return channel;
  };
  const context = {
    extension: { packageJSON: { name: 'caller', version: '1.0.0', displayName: 'Caller Extension' } },
    globalState: { get: () => undefined, update: () => Promise.resolve() }
  } as unknown as vscode.ExtensionContext;
  const api = {
    v2: {
      services: {
        prebuiltServicesLayer: logs,
        ExtensionContextServiceLayer: (value: vscode.ExtensionContext) => {
          expect(value).toBe(context);
          return Layer.succeed(
            ExtensionContextService,
            ExtensionContextService.of({
              scope: Scope.makeUnsafe(),
              getContext: Effect.succeed(context),
              getDisplayName: Effect.succeed('Caller Extension')
            })
          );
        },
        SdkLayerFor: () => Layer.empty,
        ChannelServiceLayer: channelLayer,
        ErrorHandlerServiceLayer: Layer.empty
      }
    }
  } as unknown as SalesforceVSCodeServicesApiV2;
  vi.spyOn(vscode.extensions, 'getExtension').mockReturnValue({ isActive: true, exports: api } as never);
  const runtime = ManagedRuntime.make(buildAllServicesLayer(context, 'fallback'));
  try {
    expect(await runtime.runPromise(ExtensionContextService.use(service => service.getDisplayName))).toBe(
      'Caller Extension'
    );
    await runtime.runPromise(Effect.logWarning('caller warning remains visible'));
    expect(messages).toContain('caller warning remains visible');
  } finally {
    await runtime.dispose();
  }
});
