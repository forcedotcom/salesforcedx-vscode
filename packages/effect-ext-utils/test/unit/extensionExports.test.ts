/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { CallableSchema } from '../../src/callableSchema';
import { ExtensionActivationError, ExtensionNotFoundError, getExtensionExports } from '../../src/extensionExports';

const extensionId = 'publisher.extension';
const exports = { getValue: () => 'exported value', version: '1.0', additionalExport: true };
const ExtensionApiSchema = Schema.Struct({
  getValue: CallableSchema<typeof exports.getValue>(),
  version: Schema.String
});

describe('getExtensionExports', () => {
  it('fails with the missing extension ID and a useful message', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

    const error = await Effect.runPromise(Effect.flip(getExtensionExports({ extId: extensionId })));

    expect(error).toBeInstanceOf(ExtensionNotFoundError);
    expect(error).toMatchObject({ extId: extensionId, message: `Extension '${extensionId}' is not installed` });
  });

  it('returns the validated schema shape and ignores excess exports', async () => {
    const activate = vi.fn();
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports,
      activate
    } as unknown as vscode.Extension<unknown>);

    const result = await Effect.runPromise(getExtensionExports({ extId: extensionId, schema: ExtensionApiSchema }));

    expect(result).not.toBe(exports);
    expect(result.getValue()).toBe('exported value');
    expect(result).not.toHaveProperty('additionalExport');
    expect(activate).not.toHaveBeenCalled();
    expect(vscode.extensions.getExtension).toHaveBeenCalledExactlyOnceWith(extensionId);
  });

  it('returns unvalidated exports as unknown when no schema is supplied', async () => {
    const rawExports = 'opaque exports';
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports: rawExports
    } as unknown as vscode.Extension<unknown>);

    const result = await Effect.runPromise(getExtensionExports({ extId: extensionId }));

    expect(result).toBe(rawExports);
  });

  it.each([42, 'not callable', {}, undefined])(
    'reports a non-callable export %s with its property path',
    async value => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        isActive: true,
        exports: { getValue: value, version: '1.0' }
      } as unknown as vscode.Extension<unknown>);

      const error = await Effect.runPromise(
        Effect.flip(getExtensionExports({ extId: extensionId, schema: ExtensionApiSchema }))
      );

      expect(error).toMatchObject({ _tag: 'ParseError' });
      expect(String(error)).toContain('getValue');
      expect(String(error)).toContain('Function');
    }
  );

  it('does not invoke or wrap callable exports during decoding', async () => {
    const getValue = vi.fn((value: string) => Promise.resolve(value.length));
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports: { getValue }
    } as unknown as vscode.Extension<unknown>);

    const result = await Effect.runPromise(
      getExtensionExports({
        extId: extensionId,
        schema: Schema.Struct({ getValue: CallableSchema<typeof getValue>() })
      })
    );

    expect(getValue).not.toHaveBeenCalled();
    expect(result.getValue).toBe(getValue);
    expect(await result.getValue('hello')).toBe(5);
  });

  it('returns the activation result rather than reading inactive exports', async () => {
    const activate = vi.fn().mockResolvedValue(exports);
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: false,
      get exports() {
        throw new Error('Exports are not available until activation completes');
      },
      activate
    } as unknown as vscode.Extension<unknown>);

    expect(await Effect.runPromise(getExtensionExports({ extId: extensionId, schema: ExtensionApiSchema }))).toEqual({
      getValue: exports.getValue,
      version: exports.version
    });
    expect(activate).toHaveBeenCalledOnce();
  });

  it.each([new Error('activation failed'), 'activation failed'])('preserves the activation cause %s', async cause => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: false,
      activate: vi.fn().mockRejectedValue(cause)
    } as unknown as vscode.Extension<unknown>);

    const error = await Effect.runPromise(Effect.flip(getExtensionExports({ extId: extensionId })));

    expect(error).toBeInstanceOf(ExtensionActivationError);
    expect(error).toMatchObject({
      extId: extensionId,
      message: `Failed to activate extension '${extensionId}': activation failed`,
      cause
    });
  });

  it('captures a synchronous activation failure in the typed error channel', async () => {
    const cause = new Error('synchronous activation failure');
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: false,
      activate: () => {
        throw cause;
      }
    } as unknown as vscode.Extension<unknown>);

    const error = await Effect.runPromise(Effect.flip(getExtensionExports({ extId: extensionId })));

    expect(error).toBeInstanceOf(ExtensionActivationError);
    expect(error).toMatchObject({ extId: extensionId, cause });
  });

  it('looks up the extension when run and observes its current activation state', async () => {
    const effect = getExtensionExports({ extId: extensionId });
    const activate = vi.fn().mockResolvedValue(exports);
    const extension = { isActive: false, exports, activate };
    expect(vscode.extensions.getExtension).not.toHaveBeenCalled();
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(extension as unknown as vscode.Extension<unknown>);

    expect(await Effect.runPromise(effect)).toBe(exports);
    extension.isActive = true;
    expect(await Effect.runPromise(effect)).toBe(exports);
    expect(activate).toHaveBeenCalledOnce();
  });
});
