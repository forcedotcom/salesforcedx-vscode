/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expectTypeOf } from 'vitest';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { ExtensionActivationError, ExtensionNotFoundError, getExtensionExports } from '../../src/extensionExports';

const extensionId = 'publisher.extension';
const exports = { getValue: () => 'exported value' };
type ExtensionApi = typeof exports;

describe('getExtensionExports', () => {
  it('fails with the missing extension ID and a useful message', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

    const error = await Effect.runPromise(Effect.flip(getExtensionExports(extensionId)));

    expect(error).toBeInstanceOf(ExtensionNotFoundError);
    expect(error).toMatchObject({ extensionId, message: `Extension '${extensionId}' is not installed` });
  });

  it('returns typed exports without activating an already-active extension', async () => {
    const activate = vi.fn();
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: true,
      exports,
      activate
    } as unknown as vscode.Extension<ExtensionApi>);

    const result = await Effect.runPromise(getExtensionExports<ExtensionApi>(extensionId));

    expectTypeOf(result).toEqualTypeOf<ExtensionApi>();
    expect(result).toBe(exports);
    expect(result.getValue()).toBe('exported value');
    expect(activate).not.toHaveBeenCalled();
    expect(vscode.extensions.getExtension).toHaveBeenCalledExactlyOnceWith(extensionId);
  });

  it('returns the activation result rather than reading inactive exports', async () => {
    const activate = vi.fn().mockResolvedValue(exports);
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: false,
      get exports() {
        throw new Error('Exports are not available until activation completes');
      },
      activate
    } as unknown as vscode.Extension<ExtensionApi>);

    expect(await Effect.runPromise(getExtensionExports<ExtensionApi>(extensionId))).toBe(exports);
    expect(activate).toHaveBeenCalledOnce();
  });

  it.each([new Error('activation failed'), 'activation failed'])('preserves the activation cause %s', async cause => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive: false,
      activate: vi.fn().mockRejectedValue(cause)
    } as unknown as vscode.Extension<ExtensionApi>);

    const error = await Effect.runPromise(Effect.flip(getExtensionExports(extensionId)));

    expect(error).toBeInstanceOf(ExtensionActivationError);
    expect(error).toMatchObject({
      extensionId,
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
    } as unknown as vscode.Extension<ExtensionApi>);

    const error = await Effect.runPromise(Effect.flip(getExtensionExports(extensionId)));

    expect(error).toBeInstanceOf(ExtensionActivationError);
    expect(error).toMatchObject({ extensionId, cause });
  });

  it('looks up the extension when run and observes its current activation state', async () => {
    const effect = getExtensionExports(extensionId);
    const activate = vi.fn().mockResolvedValue(exports);
    const extension = { isActive: false, exports, activate };
    expect(vscode.extensions.getExtension).not.toHaveBeenCalled();
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(extension as unknown as vscode.Extension<ExtensionApi>);

    expect(await Effect.runPromise(effect)).toBe(exports);
    extension.isActive = true;
    expect(await Effect.runPromise(effect)).toBe(exports);
    expect(activate).toHaveBeenCalledOnce();
  });
});
