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
import * as vscode from 'vscode';
import {
  hasDefaultOrg,
  produceTestRunCodeLens,
  registerTestRunCodeLensProducer
} from '../../../src/codelens/testRunCodeLensProducer';

const range = { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } } as vscode.Range;

const lens = (command: string, arguments_: unknown[] = ['ExampleTest']) =>
  ({ range, command: { command, title: 'Run Test', arguments: arguments_ } }) as vscode.CodeLens;

describe('testRunCodeLensProducer', () => {
  it('accepts a default org with a resolved org ID', async () => {
    const targetOrgRef = await Effect.runPromise(SubscriptionRef.make({ orgId: '00D000000000001' }));
    const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed({
        services: { TargetOrgRef: () => Effect.succeed(targetOrgRef) }
      })
    } as unknown as ExtensionProviderService);
    await expect(Effect.runPromise(hasDefaultOrg().pipe(Effect.provide(extensionProviderLayer)))).resolves.toBe(true);
  });

  it.each([
    ['sf.apex.test.class.run.delegate', 'sf.apex.test.class.run'],
    ['sf.apex.test.method.run.delegate', 'sf.apex.test.method.run']
  ])('maps %s to %s without changing its range', (delegate: string, target: string) => {
    const result = produceTestRunCodeLens(lens(delegate));

    expect(result).toMatchObject({
      range,
      command: { command: target, title: '$(run) Run Test', arguments: ['ExampleTest'] }
    });
  });

  it.each([
    lens('unsupported.command'),
    lens('sf.apex.test.class.run.delegate', []),
    lens('sf.apex.test.class.run.delegate', [42]),
    lens('sf.apex.test.class.run.delegate', ['', 'another'])
  ])('suppresses malformed or unsupported lenses', (candidate: vscode.CodeLens) => {
    expect(produceTestRunCodeLens(candidate)).toBeNull();
  });

  it('registers class and method producers and suppresses them without a default org', async () => {
    const disposable = { dispose: vi.fn() };
    let registeredCallback:
      | ((candidate: vscode.CodeLens) => vscode.CodeLens | null | Promise<vscode.CodeLens | null>)
      | undefined;
    const register = vi.fn(
      (
        _: string,
        callback: (candidate: vscode.CodeLens) => vscode.CodeLens | null | Promise<vscode.CodeLens | null>
      ) => {
        registeredCallback = callback;
        return disposable;
      }
    );
    const context = { subscriptions: [] as vscode.Disposable[] } as vscode.ExtensionContext;

    await Effect.runPromise(
      registerTestRunCodeLensProducer(
        context,
        () => Promise.resolve(false),
        () => Effect.succeed({ client: {}, codeLens: { register, resolve: vi.fn() } })
      )
    );

    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenNthCalledWith(1, 'sf.apex.test.class.run.delegate', expect.any(Function));
    expect(register).toHaveBeenNthCalledWith(2, 'sf.apex.test.method.run.delegate', expect.any(Function));
    expect(context.subscriptions).toEqual([disposable, disposable]);
    await expect(registeredCallback?.(lens('sf.apex.test.class.run.delegate'))).resolves.toBeNull();
  });

  it('does not register producers when the language server is unavailable', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
    const context = { subscriptions: [] as vscode.Disposable[] } as vscode.ExtensionContext;

    await Effect.runPromise(registerTestRunCodeLensProducer(context));

    expect(context.subscriptions).toEqual([]);
  });

  it('does not register producers when language server activation fails', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: false,
      activate: vi.fn().mockRejectedValue(new Error('activation failed'))
    } as unknown as vscode.Extension<unknown>);
    const context = { subscriptions: [] as vscode.Disposable[] } as vscode.ExtensionContext;

    await Effect.runPromise(registerTestRunCodeLensProducer(context));

    expect(context.subscriptions).toEqual([]);
  });

  it('does not register producers when language server exports are incompatible', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports: { client: {}, codeLens: { register: 'not callable', resolve: vi.fn() } }
    } as unknown as vscode.Extension<unknown>);
    const context = { subscriptions: [] as vscode.Disposable[] } as vscode.ExtensionContext;

    await Effect.runPromise(registerTestRunCodeLensProducer(context));

    expect(context.subscriptions).toEqual([]);
  });
});
