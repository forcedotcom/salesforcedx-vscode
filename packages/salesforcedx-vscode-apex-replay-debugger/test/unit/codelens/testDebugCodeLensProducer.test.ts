/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import {
  produceTestDebugCodeLens,
  registerTestDebugCodeLensProducer
} from '../../../src/codelens/testDebugCodeLensProducer';

const range = { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } } as vscode.Range;

const lens = (command: string, arguments_: unknown[] = ['ExampleTest']) =>
  ({ range, command: { command, title: 'Debug Test', arguments: arguments_ } }) as vscode.CodeLens;

describe('testDebugCodeLensProducer', () => {
  it.each([
    ['sf.apex.debug.class.run.delegate', 'sf.test.view.debugTests'],
    ['sf.apex.debug.method.run.delegate', 'sf.test.view.debugSingleTest']
  ])('maps %s to %s without changing its range', (delegate: string, target: string) => {
    const result = produceTestDebugCodeLens(lens(delegate));

    expect(result).toMatchObject({
      range,
      command: { command: target, title: '$(debug) Debug Test', arguments: [{ name: 'ExampleTest' }] }
    });
  });

  it.each([
    lens('unsupported.command'),
    lens('sf.apex.debug.class.run.delegate', []),
    lens('sf.apex.debug.class.run.delegate', [42]),
    lens('sf.apex.debug.class.run.delegate', ['', 'another'])
  ])('suppresses malformed or unsupported lenses', (candidate: vscode.CodeLens) => {
    expect(produceTestDebugCodeLens(candidate)).toBeNull();
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
      registerTestDebugCodeLensProducer(
        context,
        () => Promise.resolve(false),
        () => Effect.succeed({ codeLens: { register } })
      )
    );

    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenNthCalledWith(1, 'sf.apex.debug.class.run.delegate', expect.any(Function));
    expect(register).toHaveBeenNthCalledWith(2, 'sf.apex.debug.method.run.delegate', expect.any(Function));
    expect(context.subscriptions).toEqual([disposable, disposable]);
    await expect(registeredCallback?.(lens('sf.apex.debug.class.run.delegate'))).resolves.toBeNull();
  });

  it('does not register producers when the language server is unavailable', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
    const context = { subscriptions: [] as vscode.Disposable[] } as vscode.ExtensionContext;

    await Effect.runPromise(registerTestDebugCodeLensProducer(context));

    expect(context.subscriptions).toEqual([]);
  });

  it('does not register producers when language server activation fails', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: false,
      activate: vi.fn().mockRejectedValue(new Error('activation failed'))
    } as unknown as vscode.Extension<unknown>);
    const context = { subscriptions: [] as vscode.Disposable[] } as vscode.ExtensionContext;

    await Effect.runPromise(registerTestDebugCodeLensProducer(context));

    expect(context.subscriptions).toEqual([]);
  });

  it('does not register producers when language server exports are incompatible', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports: { codeLens: { register: 'not callable' } }
    } as unknown as vscode.Extension<unknown>);
    const context = { subscriptions: [] as vscode.Disposable[] } as vscode.ExtensionContext;

    await Effect.runPromise(registerTestDebugCodeLensProducer(context));

    expect(context.subscriptions).toEqual([]);
  });
});
